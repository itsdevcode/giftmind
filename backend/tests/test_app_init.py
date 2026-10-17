from app.core.config import Settings
from app.main import create_app


def test_app_initialization_defaults() -> None:
    """Test creating FastAPI app with custom settings."""
    custom_settings = Settings(
        APP_NAME="Custom GiftMind",
        APP_ENV="staging",
        DEBUG=False,
    )
    app = create_app(settings=custom_settings)
    assert app.title == "Custom GiftMind"
    assert app.openapi_url == "/api/v1/openapi.json"


def test_app_production_disables_docs() -> None:
    """In production mode without DEBUG, docs and OpenAPI URLs should be disabled."""
    prod_settings = Settings(
        APP_NAME="GiftMind API Prod",
        APP_ENV="production",
        DEBUG=False,
        JWT_SECRET_KEY="super-strong-production-signing-secret-key-at-least-32-bytes",
        AI_PROVIDER="ollama",
    )
    app = create_app(settings=prod_settings)
    assert app.openapi_url is None
    assert app.docs_url is None
