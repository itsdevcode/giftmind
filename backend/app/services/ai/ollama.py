import json
import logging
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.recommendation import RawGiftRecommendationOutput
from app.services.ai.base import AIProvider
from app.services.ai.exceptions import (
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderUnavailableError,
    AIResponseValidationError,
)
from app.services.ai.prompts import (
    SYSTEM_PROMPT,
    RecommendationPromptInput,
    build_recommendation_prompt,
)

logger = logging.getLogger(__name__)


class OllamaAIProvider(AIProvider):
    """Production AI provider integrating with local Ollama inference server."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "gemma2:2b",
        timeout_seconds: float = 45.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._client = http_client

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(self._timeout_seconds, connect=10.0),
        )

    async def verify_connection(self) -> dict[str, Any]:
        """Check if Ollama server is alive and whether the requested model is present."""
        client = self._get_client()
        should_close = self._client is None
        try:
            res = await client.get("/api/tags")
            if res.status_code != 200:
                return {
                    "provider": "ollama",
                    "available": False,
                    "error": f"Ollama returned HTTP {res.status_code}",
                }
            data = res.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            # Match model name with or without tag (e.g. gemma2:2b or gemma2:2b-latest)
            has_model = any(
                m == self._model or m.startswith(f"{self._model}:") or self._model.startswith(m)
                for m in models
            )
            return {
                "provider": "ollama",
                "available": True,
                "model": self._model,
                "model_installed": has_model,
                "installed_models": models,
            }
        except httpx.ConnectError:
            return {
                "provider": "ollama",
                "available": False,
                "error": f"Could not connect to Ollama at {self._base_url}",
            }
        except Exception as e:
            return {
                "provider": "ollama",
                "available": False,
                "error": f"Connection check failed: {type(e).__name__}",
            }
        finally:
            if should_close:
                await client.aclose()

    async def generate_gift_recommendations(
        self,
        prompt_input: RecommendationPromptInput,
    ) -> RawGiftRecommendationOutput:
        """Call Ollama /api/generate with structured JSON mode and Gemma prompt."""
        prompt = build_recommendation_prompt(prompt_input)
        payload = {
            "model": self._model,
            "system": SYSTEM_PROMPT,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            },
        }

        client = self._get_client()
        should_close = self._client is None
        try:
            logger.info("Initiating Ollama generation for model '%s'", self._model)
            response = await client.post("/api/generate", json=payload)

            if response.status_code == 404:
                raise AIModelNotFoundError(self._model)
            if response.status_code != 200:
                logger.error("Ollama returned non-200 status: %d", response.status_code)
                raise AIProviderUnavailableError(
                    f"Ollama inference server returned unexpected status code {response.status_code}."
                )

            res_json = response.json()
            raw_response_text = res_json.get("response", "").strip()

            if not raw_response_text:
                raise AIResponseValidationError("Ollama returned an empty response.")

            try:
                parsed_data = json.loads(raw_response_text)
            except json.JSONDecodeError as err:
                logger.warning("Failed to parse Ollama output as JSON: %s", err)
                raise AIResponseValidationError(
                    "The model output could not be parsed as JSON."
                ) from err

            # Validate against Pydantic schema
            try:
                validated_output = RawGiftRecommendationOutput.model_validate(parsed_data)
                return validated_output
            except ValidationError as val_err:
                logger.warning("Model output failed schema validation: %s", val_err)
                raise AIResponseValidationError(
                    f"The model output did not match the expected schema: {val_err.errors()[0]['msg']}"
                ) from val_err

        except httpx.TimeoutException as err:
            logger.error("Ollama inference request timed out after %.1fs", self._timeout_seconds)
            raise AIInferenceTimeoutError(
                f"AI inference request timed out after {self._timeout_seconds}s."
            ) from err
        except httpx.ConnectError as err:
            logger.error("Failed to connect to Ollama at %s", self._base_url)
            raise AIProviderUnavailableError(
                f"Unable to connect to Ollama at {self._base_url}."
            ) from err
        finally:
            if should_close:
                await client.aclose()
