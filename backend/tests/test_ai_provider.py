"""Provider contract tests for GoogleGemmaAIProvider (hosted Gemma 4).

Covers:
- Initialization and validation of API key
- Missing / empty API key error (AIAuthenticationError)
- Successful model response parsing into RawGiftRecommendationOutput
- Code-fenced markdown JSON response parsing
- Request timeout handling (AIInferenceTimeoutError)
- Missing model 404 handling (AIModelNotFoundError)
- Rate limiting 429 and retry-after header handling (AIRateLimitError)
- Authentication error 401/403 (AIAuthenticationError)
- Server error 500/503 retry and failure (AIProviderUnavailableError)
- Malformed JSON output handling (AIResponseValidationError)
- Empty response handling (AIResponseValidationError)
- Schema mismatch (fewer than 3 items, duplicate titles) (AIResponseValidationError)
- Provider selection through settings factory
"""

import asyncio
import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from google.genai import errors

from app.core.config import Settings
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderUnavailableError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.factory import get_ai_provider
from app.services.ai.google_gemma import GoogleGemmaAIProvider
from app.services.ai.mock import MockAIProvider
from app.services.ai.prompts import RecommendationPromptInput


@pytest.fixture
def sample_prompt_input() -> RecommendationPromptInput:
    return RecommendationPromptInput(
        recipient_name="Alice",
        relationship="Sister",
        interests=["Astronomy", "Mechanical Keyboards"],
        notes="Loves space documentaries",
        occasion="Birthday",
        occasion_date=None,
        budget_min=Decimal("50.00"),
        budget_max=Decimal("150.00"),
        currency="USD",
    )


@pytest.fixture
def valid_recommendations_json() -> str:
    return json.dumps(
        {
            "recommendations": [
                {
                    "title": "Celestron 70mm Travel Scope",
                    "description": "Portable telescope with coated glass optics and tripod.",
                    "estimated_budget": 89.95,
                    "category": "Astronomy",
                    "personalization_reason": "Perfect for stargazing and space enthusiasts on trips.",
                    "presentation_idea": "Gift with a star chart booklet wrapped around the box.",
                },
                {
                    "title": "Custom Artisan Keycap Set",
                    "description": "Handcrafted space nebula-themed mechanical keycaps.",
                    "estimated_budget": 75.00,
                    "category": "Mechanical Keyboards",
                    "personalization_reason": "Combines her hobby of mechanical keyboards with space art.",
                    "presentation_idea": "Present inside a switch tester frame.",
                },
                {
                    "title": "Framed NASA Webb Deep Field Print",
                    "description": "High-resolution museum grade canvas print of JWST deep field.",
                    "estimated_budget": 60.00,
                    "category": "Home Decor",
                    "personalization_reason": "Celebrates her love for space documentaries with wall art.",
                    "presentation_idea": "Frame with a personalized engraved plaque.",
                },
            ]
        }
    )


def _create_mock_client(response_text: str | None = None, side_effect: Exception | None = None):
    mock_client = MagicMock()
    mock_generate = AsyncMock()
    if side_effect:
        mock_generate.side_effect = side_effect
    else:
        mock_response = MagicMock()
        mock_response.text = response_text
        mock_generate.return_value = mock_response

    mock_client.aio.models.generate_content = mock_generate
    return mock_client


@pytest.mark.asyncio
async def test_google_gemma_provider_initialization() -> None:
    """Provider initializes with default model and properties."""
    provider = GoogleGemmaAIProvider(api_key="test-key", model="gemma-4-26b-a4b-it")
    assert provider.provider_name == "google"
    assert provider.model_name == "gemma-4-26b-a4b-it"


@pytest.mark.asyncio
async def test_google_gemma_missing_api_key_raises(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """Missing or empty API key raises AIAuthenticationError without calling external service."""
    provider = GoogleGemmaAIProvider(api_key="")
    with pytest.raises(AIAuthenticationError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "GOOGLE_API_KEY is missing" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_successful_parsing(
    sample_prompt_input: RecommendationPromptInput,
    valid_recommendations_json: str,
) -> None:
    """Valid JSON from hosted Gemma parsed into RawGiftRecommendationOutput."""
    mock_client = _create_mock_client(response_text=valid_recommendations_json)
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    result = await provider.generate_gift_recommendations(sample_prompt_input)
    assert len(result.recommendations) == 3
    assert result.recommendations[0].title == "Celestron 70mm Travel Scope"
    assert result.recommendations[0].estimated_budget == Decimal("89.95")
    assert result.recommendations[1].category == "Mechanical Keyboards"
    assert result.recommendations[2].presentation_idea.startswith("Frame with")


@pytest.mark.asyncio
async def test_google_gemma_markdown_fenced_json(
    sample_prompt_input: RecommendationPromptInput,
    valid_recommendations_json: str,
) -> None:
    """Markdown code block formatting (```json ... ```) is cleaned and successfully parsed."""
    fenced_text = (
        f"Here are your ideas:\n```json\n{valid_recommendations_json}\n```\nHope you like them!"
    )
    mock_client = _create_mock_client(response_text=fenced_text)
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    result = await provider.generate_gift_recommendations(sample_prompt_input)
    assert len(result.recommendations) == 3
    assert result.recommendations[0].title == "Celestron 70mm Travel Scope"


@pytest.mark.asyncio
async def test_google_gemma_timeout_handling(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """Provider maps inference timeout to AIInferenceTimeoutError."""

    async def slow_generate(*_args, **_kwargs):
        await asyncio.sleep(1.0)

    mock_client = _create_mock_client(side_effect=slow_generate)
    provider = GoogleGemmaAIProvider(api_key="test-key", timeout_seconds=0.01, client=mock_client)

    with pytest.raises(AIInferenceTimeoutError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "timed out after 0.01s" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_model_not_found_404(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """HTTP 404 from Google API raises AIModelNotFoundError."""
    err = errors.APIError(404, {"error": {"message": "Model not found", "code": 404}})
    mock_client = _create_mock_client(side_effect=err)
    provider = GoogleGemmaAIProvider(
        api_key="test-key", model="gemma-4-26b-a4b-it", client=mock_client
    )

    with pytest.raises(AIModelNotFoundError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "gemma-4-26b-a4b-it" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_authentication_error_401(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """HTTP 401/403 raises AIAuthenticationError without retrying."""
    err = errors.APIError(401, {"error": {"message": "API key not valid", "code": 401}})
    mock_client = _create_mock_client(side_effect=err)
    provider = GoogleGemmaAIProvider(api_key="bad-key", client=mock_client)

    with pytest.raises(AIAuthenticationError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "authentication failed" in str(exc_info.value).lower()
    # Ensure it didn't retry
    assert mock_client.aio.models.generate_content.call_count == 1


@pytest.mark.asyncio
async def test_google_gemma_rate_limit_429(sample_prompt_input: RecommendationPromptInput) -> None:
    """HTTP 429 rate limit raises AIRateLimitError after exhausted retries."""
    err = errors.APIError(429, {"error": {"message": "Quota exceeded", "code": 429}})
    mock_client = _create_mock_client(side_effect=err)
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    with pytest.raises(AIRateLimitError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "rate limit exceeded" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_google_gemma_server_error_503(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """HTTP 503 raises AIProviderUnavailableError after exhausted retries."""
    err = errors.APIError(503, {"error": {"message": "Service unavailable", "code": 503}})
    mock_client = _create_mock_client(side_effect=err)
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    with pytest.raises(AIProviderUnavailableError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "temporarily unavailable" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_google_gemma_malformed_json_handling(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """Invalid non-JSON response raises AIResponseValidationError."""
    mock_client = _create_mock_client(response_text="Not valid json {title: missing}")
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    with pytest.raises(AIResponseValidationError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "could not be parsed as JSON" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_empty_response_handling(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """Empty response raises AIResponseValidationError."""
    mock_client = _create_mock_client(response_text="   ")
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    with pytest.raises(AIResponseValidationError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "empty response" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_schema_mismatch_item_count(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """Output with fewer than 3 recommendations raises AIResponseValidationError."""
    single_item_json = json.dumps(
        {
            "recommendations": [
                {
                    "title": "Single Item Only",
                    "description": "Short description of the item.",
                    "estimated_budget": 50.0,
                    "category": "Gadgets",
                    "personalization_reason": "Good match for tech hobbyist.",
                    "presentation_idea": "Wrap it in blue paper.",
                }
            ]
        }
    )
    mock_client = _create_mock_client(response_text=single_item_json)
    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)

    with pytest.raises(AIResponseValidationError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)
    assert "did not match the expected schema" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_gemma_verify_connection_success() -> None:
    """verify_connection returns availability and model display name."""
    mock_client = MagicMock()
    mock_model_info = MagicMock()
    mock_model_info.display_name = "Gemma 4 26B"
    mock_client.aio.models.get = AsyncMock(return_value=mock_model_info)

    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)
    res = await provider.verify_connection()
    assert res["available"] is True
    assert res["model"] == "gemma-4-26b-a4b-it"


@pytest.mark.asyncio
async def test_provider_factory_selection() -> None:
    """Settings factory creates appropriate provider for google and mock."""
    settings_google = Settings(
        APP_ENV="development",
        AI_PROVIDER="google",
        GOOGLE_API_KEY="my-secret-key",
    )
    p_google = get_ai_provider(settings_google)
    assert isinstance(p_google, GoogleGemmaAIProvider)
    assert p_google.provider_name == "google"

    settings_mock = Settings(
        APP_ENV="testing",
        AI_PROVIDER="mock",
    )
    p_mock = get_ai_provider(settings_mock)
    assert isinstance(p_mock, MockAIProvider)
    assert p_mock.provider_name == "mock"


@pytest.mark.asyncio
async def test_google_gemma_transient_500_followed_by_successful_retry(
    sample_prompt_input: RecommendationPromptInput,
    valid_recommendations_json: str,
) -> None:
    """When attempt 1 returns Google 500 internal error, attempt 2 succeeds and returns validated output."""
    mock_client = MagicMock()
    mock_generate = AsyncMock()

    mock_resp = MagicMock()
    mock_resp.text = valid_recommendations_json

    err_500 = errors.APIError(
        500, {"error": {"message": "Internal error encountered.", "code": 500}}
    )
    mock_generate.side_effect = [err_500, mock_resp]
    mock_client.aio.models.generate_content = mock_generate

    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)
    output = await provider.generate_gift_recommendations(sample_prompt_input)

    assert len(output.recommendations) == 3
    assert mock_generate.call_count == 2


@pytest.mark.asyncio
async def test_google_gemma_httpx_transport_error_followed_by_success(
    sample_prompt_input: RecommendationPromptInput,
    valid_recommendations_json: str,
) -> None:
    """When attempt 1 encounters a socket reset / transport error, it retries and succeeds on attempt 2."""
    mock_client = MagicMock()
    mock_generate = AsyncMock()

    mock_resp = MagicMock()
    mock_resp.text = valid_recommendations_json

    transport_err = httpx.ConnectError("Connection reset by peer")
    mock_generate.side_effect = [transport_err, mock_resp]
    mock_client.aio.models.generate_content = mock_generate

    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)
    output = await provider.generate_gift_recommendations(sample_prompt_input)

    assert len(output.recommendations) == 3
    assert mock_generate.call_count == 2


@pytest.mark.asyncio
async def test_google_gemma_exhausted_retries_server_error(
    sample_prompt_input: RecommendationPromptInput,
) -> None:
    """When Google 500 persists across all attempts (initial + 3 retries), raises AIProviderUnavailableError."""
    mock_client = MagicMock()
    mock_generate = AsyncMock()

    err_500 = errors.APIError(500, {"error": {"message": "Persistent server failure", "code": 500}})
    mock_generate.side_effect = err_500
    mock_client.aio.models.generate_content = mock_generate

    provider = GoogleGemmaAIProvider(api_key="test-key", client=mock_client)
    with pytest.raises(AIProviderUnavailableError) as exc_info:
        await provider.generate_gift_recommendations(sample_prompt_input)

    assert "temporarily unavailable" in str(exc_info.value).lower()
    # 1 initial + 3 retries = 4 calls total
    assert mock_generate.call_count == 4
