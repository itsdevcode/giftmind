"""Provider contract tests for OllamaAIProvider.

Covers:
- Successful response parsing into RawGiftRecommendationOutput
- Request timeouts (AIInferenceTimeoutError)
- Missing model 404 (AIModelNotFoundError)
- Malformed JSON output (AIResponseValidationError)
- Empty response handling (AIResponseValidationError)
- Schema mismatch validation (AIResponseValidationError)
- Server unavailability / connection error (AIProviderUnavailableError)
"""

import json
from decimal import Decimal

import httpx
import pytest

from app.services.ai.exceptions import (
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderUnavailableError,
    AIResponseValidationError,
)
from app.services.ai.ollama import OllamaAIProvider
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


@pytest.mark.asyncio
async def test_ollama_provider_successful_parsing(sample_prompt_input: RecommendationPromptInput):
    """Test that a valid Ollama response is properly parsed into RawGiftRecommendationOutput."""
    mock_payload = {
        "response": json.dumps(
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
    }

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/generate"
        body = json.loads(request.content)
        assert body["model"] == "gemma2:2b"
        assert body["format"] == "json"
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(
            base_url="http://test-ollama:11434",
            model="gemma2:2b",
            http_client=client,
        )
        result = await provider.generate_gift_recommendations(sample_prompt_input)
        assert len(result.recommendations) == 3
        assert result.recommendations[0].title == "Celestron 70mm Travel Scope"
        assert result.recommendations[0].estimated_budget == Decimal("89.95")
        assert result.recommendations[1].category == "Mechanical Keyboards"
        assert result.recommendations[2].presentation_idea.startswith("Frame with")


@pytest.mark.asyncio
async def test_ollama_provider_model_not_found(sample_prompt_input: RecommendationPromptInput):
    """Test 404 response triggers AIModelNotFoundError."""

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "model 'gemma2:2b' not found"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client, model="gemma2:2b")
        with pytest.raises(AIModelNotFoundError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "gemma2:2b" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_timeout_handling(sample_prompt_input: RecommendationPromptInput):
    """Test httpx.TimeoutException maps to AIInferenceTimeoutError."""

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Read timed out")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client, timeout_seconds=15.0)
        with pytest.raises(AIInferenceTimeoutError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "timed out after 15.0s" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_malformed_json_handling(
    sample_prompt_input: RecommendationPromptInput,
):
    """Test invalid JSON response triggers AIResponseValidationError."""
    mock_payload = {"response": "Not valid JSON at all: {foo: bar}"}

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client)
        with pytest.raises(AIResponseValidationError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "could not be parsed as JSON" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_empty_response_handling(
    sample_prompt_input: RecommendationPromptInput,
):
    """Test empty string in 'response' triggers AIResponseValidationError."""
    mock_payload = {"response": "   "}

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client)
        with pytest.raises(AIResponseValidationError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "empty response" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_schema_mismatch(sample_prompt_input: RecommendationPromptInput):
    """Test schema mismatch (e.g. fewer than 3 items or duplicate titles) triggers AIResponseValidationError."""
    mock_payload = {
        "response": json.dumps(
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
    }

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client)
        with pytest.raises(AIResponseValidationError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "did not match the expected schema" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_connection_failure(sample_prompt_input: RecommendationPromptInput):
    """Test connection error raises AIProviderUnavailableError."""

    async def mock_handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test-ollama:11434"
    ) as client:
        provider = OllamaAIProvider(http_client=client, base_url="http://test-ollama:11434")
        with pytest.raises(AIProviderUnavailableError) as exc_info:
            await provider.generate_gift_recommendations(sample_prompt_input)
        assert "Unable to connect to Ollama" in str(exc_info.value)
