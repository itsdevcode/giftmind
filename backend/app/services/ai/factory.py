from app.core.config import Settings
from app.services.ai.base import AIProvider
from app.services.ai.mock import MockAIProvider
from app.services.ai.ollama import OllamaAIProvider


def get_ai_provider(settings: Settings) -> AIProvider:
    """Factory creating the appropriate AIProvider instance according to application settings."""
    if settings.AI_PROVIDER == "mock" or settings.APP_ENV == "testing":
        return MockAIProvider(model_name=settings.OLLAMA_MODEL)
    return OllamaAIProvider(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
    )
