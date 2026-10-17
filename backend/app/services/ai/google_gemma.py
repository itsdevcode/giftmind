import asyncio
import json
import logging
import re
from typing import Any

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.schemas.recommendation import RawGiftRecommendationOutput
from app.schemas.story import RawStoryOutput, StoryPromptInput
from app.services.ai.base import AIProvider
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderError,
    AIProviderUnavailableError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.prompts import (
    SYSTEM_PROMPT,
    RecommendationPromptInput,
    build_recommendation_prompt,
)
from app.services.ai.story_prompts import (
    STORY_SYSTEM_PROMPT,
    build_story_prompt,
)

logger = logging.getLogger(__name__)


def _extract_json_block(text: str) -> str:
    """Extract a JSON object string from raw LLM output, handling markdown code fences if present."""
    text = text.strip()
    if not text:
        return ""

    # Match ```json ... ``` or ``` ... ``` code fence
    fence_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    match = re.search(fence_pattern, text)
    if match:
        return match.group(1).strip()

    # If first char is '{' and last is '}', return as-is
    if text.startswith("{") and text.endswith("}"):
        return text

    # Try finding outermost '{' and '}'
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace : last_brace + 1].strip()

    return text


class GoogleGemmaAIProvider(AIProvider):
    """Production AI provider integrating with Google-hosted Gemma 4 open-weight model via official google-genai SDK."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemma-4-26b-a4b-it",
        timeout_seconds: float = 90.0,
        client: genai.Client | None = None,
    ) -> None:
        self._api_key = (api_key or "").strip()
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._client = client

    @property
    def provider_name(self) -> str:
        return "google"

    @property
    def model_name(self) -> str:
        return self._model

    def _get_client(self) -> genai.Client:
        if self._client is not None:
            return self._client
        if not self._api_key:
            raise AIAuthenticationError(
                "GOOGLE_API_KEY is missing or empty. Please set a valid Google API key in the environment."
            )
        return genai.Client(api_key=self._api_key)

    async def verify_connection(self) -> dict[str, Any]:
        """Check if Google Gemini API is reachable and verify model availability."""
        if not self._api_key:
            return {
                "provider": "google",
                "available": False,
                "error": "GOOGLE_API_KEY is not configured",
            }

        try:
            client = self._get_client()
            # Test model retrieval via SDK's async models API
            # Timeout safely to avoid hanging health checks
            async with asyncio.timeout(10.0):
                model_info = await client.aio.models.get(model=self._model)

            return {
                "provider": "google",
                "available": True,
                "model": self._model,
                "model_display_name": getattr(model_info, "display_name", self._model),
            }
        except TimeoutError:
            return {
                "provider": "google",
                "available": False,
                "error": "Connection timed out while querying model metadata.",
            }
        except errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code in (401, 403):
                return {
                    "provider": "google",
                    "available": False,
                    "error": "Authentication failed. Check that GOOGLE_API_KEY is valid.",
                }
            if code == 404:
                return {
                    "provider": "google",
                    "available": False,
                    "error": f"Model '{self._model}' was not found on Google API host.",
                }
            return {
                "provider": "google",
                "available": False,
                "error": f"Google API error ({code}): {exc.message}",
            }
        except Exception as exc:
            return {
                "provider": "google",
                "available": False,
                "error": f"Connection check failed: {type(exc).__name__}",
            }

    async def generate_gift_recommendations(
        self,
        prompt_input: RecommendationPromptInput,
    ) -> RawGiftRecommendationOutput:
        """Call hosted Gemma model with bounded exponential backoff on retryable errors and strict Pydantic validation."""
        if not self._api_key and self._client is None:
            raise AIAuthenticationError(
                "GOOGLE_API_KEY is missing. Please configure a valid API key to use hosted Gemma."
            )

        client = self._get_client()
        prompt = build_recommendation_prompt(prompt_input)

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
            top_p=0.9,
            response_mime_type="application/json",
        )

        max_retries = 2
        base_backoff = 1.0

        for attempt in range(max_retries + 1):
            try:
                logger.info(
                    "Initiating hosted Gemma generation for model '%s' (attempt %d/%d)",
                    self._model,
                    attempt + 1,
                    max_retries + 1,
                )

                async with asyncio.timeout(self._timeout_seconds):
                    response = await client.aio.models.generate_content(
                        model=self._model,
                        contents=prompt,
                        config=config,
                    )

                raw_text = (response.text or "").strip()
                if not raw_text:
                    raise AIResponseValidationError("Hosted Gemma returned an empty response.")

                json_text = _extract_json_block(raw_text)

                try:
                    parsed_data = json.loads(json_text)
                except json.JSONDecodeError as err:
                    logger.warning("Failed to parse hosted Gemma output as JSON: %s", err)
                    raise AIResponseValidationError(
                        "The model output could not be parsed as JSON."
                    ) from err

                try:
                    validated_output = RawGiftRecommendationOutput.model_validate(parsed_data)
                    return validated_output
                except ValidationError as val_err:
                    logger.warning("Model output failed schema validation: %s", val_err)
                    first_err = val_err.errors()[0]["msg"] if val_err.errors() else str(val_err)
                    raise AIResponseValidationError(
                        f"The model output did not match the expected schema: {first_err}"
                    ) from val_err

            except TimeoutError as err:
                logger.error(
                    "Hosted Gemma inference request timed out after %.1fs",
                    self._timeout_seconds,
                )
                raise AIInferenceTimeoutError(
                    f"AI inference request timed out after {self._timeout_seconds}s."
                ) from err

            except errors.APIError as exc:
                code = getattr(exc, "code", None)
                msg = getattr(exc, "message", str(exc))

                # 401 / 403: Authentication or permission error (non-retryable)
                if code in (401, 403):
                    logger.error("Hosted Gemma authentication failed: HTTP %s", code)
                    raise AIAuthenticationError(
                        "Google API key authentication failed. Please verify your credentials."
                    ) from exc

                # 404: Model not found (non-retryable)
                if code == 404:
                    logger.error("Hosted Gemma model '%s' not found: %s", self._model, msg)
                    raise AIModelNotFoundError(self._model) from exc

                # 429: Rate limit / quota exceeded
                if code == 429:
                    logger.warning("Google API rate limit exceeded: %s", msg)
                    retry_after: float | None = None
                    # Try to extract retry-after from error details or response headers
                    if hasattr(exc, "response") and exc.response is not None:
                        headers = getattr(exc.response, "headers", {})
                        if "retry-after" in headers:
                            try:
                                retry_after = float(headers["retry-after"])
                            except (ValueError, TypeError):
                                pass

                    if attempt < max_retries:
                        backoff = (
                            retry_after
                            if retry_after is not None
                            else (base_backoff * (2**attempt))
                        )
                        backoff = min(backoff, 8.0)
                        logger.info("Retrying after %.1fs due to rate limit...", backoff)
                        await asyncio.sleep(backoff)
                        continue

                    raise AIRateLimitError(
                        "AI service rate limit exceeded. Please try again shortly.",
                        retry_after=retry_after,
                    ) from exc

                # 500 / 503 / 504: Server errors (retryable)
                if code in (500, 502, 503, 504):
                    logger.warning(
                        "Google API server error %d on attempt %d: %s", code, attempt + 1, msg
                    )
                    if attempt < max_retries:
                        backoff = base_backoff * (2**attempt)
                        logger.info("Retrying after %.1fs due to server error...", backoff)
                        await asyncio.sleep(backoff)
                        continue
                    raise AIProviderUnavailableError(
                        f"Google AI service is temporarily unavailable (status {code})."
                    ) from exc

                # Other API errors (non-retryable 4xx)
                logger.error("Google API client error %s: %s", code, msg)
                raise AIProviderError(f"Google AI service error: {msg}") from exc

            except (
                AIResponseValidationError,
                AIInferenceTimeoutError,
                AIAuthenticationError,
                AIModelNotFoundError,
            ):
                raise

            except Exception as exc:
                logger.error("Unexpected error in hosted Gemma provider: %s", type(exc).__name__)
                raise AIProviderError(
                    f"Unexpected AI provider error: {type(exc).__name__}"
                ) from exc

        raise AIProviderUnavailableError(
            "Exhausted retries while communicating with Google AI service."
        )

    async def generate_story_keepsake(
        self,
        prompt_input: StoryPromptInput,
    ) -> RawStoryOutput:
        """Call hosted Gemma model to generate a structured personalized narrative keepsake."""
        if not self._api_key and self._client is None:
            raise AIAuthenticationError(
                "GOOGLE_API_KEY is missing. Please configure a valid API key to use hosted Gemma."
            )

        client = self._get_client()
        prompt = build_story_prompt(prompt_input)

        config = types.GenerateContentConfig(
            system_instruction=STORY_SYSTEM_PROMPT,
            temperature=0.75,
            top_p=0.95,
            response_mime_type="application/json",
        )

        max_retries = 2
        base_backoff = 1.0

        for attempt in range(max_retries + 1):
            try:
                logger.info(
                    "Initiating hosted Gemma story generation for model '%s' (attempt %d/%d)",
                    self._model,
                    attempt + 1,
                    max_retries + 1,
                )

                async with asyncio.timeout(self._timeout_seconds):
                    response = await client.aio.models.generate_content(
                        model=self._model,
                        contents=prompt,
                        config=config,
                    )

                raw_text = (response.text or "").strip()
                if not raw_text:
                    raise AIResponseValidationError("Hosted Gemma returned an empty story response.")

                json_text = _extract_json_block(raw_text)

                try:
                    parsed_data = json.loads(json_text)
                except json.JSONDecodeError as err:
                    logger.warning("Failed to parse hosted Gemma story output as JSON: %s", err)
                    raise AIResponseValidationError(
                        "The model story output could not be parsed as JSON."
                    ) from err

                try:
                    validated_output = RawStoryOutput.model_validate(parsed_data)
                    return validated_output
                except ValidationError as val_err:
                    logger.warning("Story output failed schema validation: %s", val_err)
                    first_err = val_err.errors()[0]["msg"] if val_err.errors() else str(val_err)
                    raise AIResponseValidationError(
                        f"The model story output did not match the expected schema: {first_err}"
                    ) from val_err

            except TimeoutError as err:
                logger.error(
                    "Hosted Gemma story inference request timed out after %.1fs",
                    self._timeout_seconds,
                )
                raise AIInferenceTimeoutError(
                    f"AI story inference request timed out after {self._timeout_seconds}s."
                ) from err

            except errors.APIError as exc:
                code = getattr(exc, "code", None)
                msg = getattr(exc, "message", str(exc))

                if code in (401, 403):
                    logger.error("Hosted Gemma authentication failed: HTTP %s", code)
                    raise AIAuthenticationError(
                        "Google API authentication failed. Verify that GOOGLE_API_KEY is valid."
                    ) from exc

                if code == 404:
                    logger.error("Hosted Gemma model '%s' not found: HTTP 404", self._model)
                    raise AIModelNotFoundError(
                        f"Configured model '{self._model}' was not found on Google API host."
                    ) from exc

                if code == 429:
                    logger.warning(
                        "Google API rate limit (429) hit on attempt %d: %s", attempt + 1, msg
                    )
                    retry_after = None
                    if hasattr(exc, "response") and exc.response is not None:
                        headers = getattr(exc.response, "headers", {})
                        if "retry-after" in headers:
                            try:
                                retry_after = float(headers["retry-after"])
                            except (ValueError, TypeError):
                                pass

                    if attempt < max_retries:
                        backoff = (
                            retry_after
                            if retry_after is not None
                            else (base_backoff * (2**attempt))
                        )
                        backoff = min(backoff, 8.0)
                        logger.info("Retrying story generation after %.1fs due to rate limit...", backoff)
                        await asyncio.sleep(backoff)
                        continue

                    raise AIRateLimitError(
                        "AI service rate limit exceeded. Please try again shortly.",
                        retry_after=retry_after,
                    ) from exc

                if code in (500, 502, 503, 504):
                    logger.warning(
                        "Google API server error %d on attempt %d: %s", code, attempt + 1, msg
                    )
                    if attempt < max_retries:
                        backoff = base_backoff * (2**attempt)
                        logger.info("Retrying story generation after %.1fs due to server error...", backoff)
                        await asyncio.sleep(backoff)
                        continue
                    raise AIProviderUnavailableError(
                        f"Google AI service is temporarily unavailable (status {code})."
                    ) from exc

                logger.error("Google API client error %s: %s", code, msg)
                raise AIProviderError(f"Google AI service error: {msg}") from exc

            except (
                AIResponseValidationError,
                AIInferenceTimeoutError,
                AIAuthenticationError,
                AIModelNotFoundError,
            ):
                raise

            except Exception as exc:
                logger.error("Unexpected error in hosted Gemma story generation: %s", type(exc).__name__)
                raise AIProviderError(
                    f"Unexpected AI provider error: {type(exc).__name__}"
                ) from exc

        raise AIProviderUnavailableError(
            "Exhausted retries while communicating with Google AI service."
        )
