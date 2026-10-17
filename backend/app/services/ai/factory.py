from app.core.config import Settings
from app.services.ai.base import AIProvider
from app.services.ai.google_gemma import GoogleGemmaAIProvider
from app.services.ai.mock import MockAIProvider


def get_ai_provider(settings: Settings) -> AIProvider:
    """Factory creating the appropriate AIProvider instance according to application settings."""
    if settings.AI_PROVIDER == "mock" or settings.APP_ENV == "testing":
        return MockAIProvider(model_name=settings.GEMMA_MODEL)
    return GoogleGemmaAIProvider(
        api_key=settings.GOOGLE_API_KEY,
        model=settings.GEMMA_MODEL,
        timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
    )
