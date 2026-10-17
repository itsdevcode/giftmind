import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_jwt_secret_validation_rejects_default() -> None:
    """Settings in production should reject placeholder or default JWT secret."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_NAME="GiftMind API",
            APP_ENV="production",
            DEBUG=False,
            JWT_SECRET_KEY="insecure-change-me-in-production-jwt-secret-key-32bytes-min!",
        )
    assert "JWT_SECRET_KEY is set to an insecure default/placeholder" in str(exc_info.value)


def test_production_jwt_secret_validation_rejects_short_secret() -> None:
    """Settings in production should reject JWT secret shorter than 32 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_NAME="GiftMind API",
            APP_ENV="production",
            DEBUG=False,
            JWT_SECRET_KEY="short-secret-12345",
        )
    assert "at least 32 characters" in str(exc_info.value)


def test_production_jwt_secret_validation_rejects_common_placeholders() -> None:
    """Settings in production should reject known obvious secret placeholders."""
    for bad_secret in [
        "changeme-please-change-this-secret-now-12345",
        "secret-key-placeholder-which-is-long-enough-32bytes",
    ]:
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_NAME="GiftMind API",
                APP_ENV="production",
                DEBUG=False,
                JWT_SECRET_KEY=bad_secret,
            )
        assert "insecure default/placeholder" in str(exc_info.value)


def test_production_jwt_secret_validation_accepts_strong_secret() -> None:
    """Settings in production succeeds with sufficiently strong secret and valid AI config."""
    settings = Settings(
        APP_NAME="GiftMind API",
        APP_ENV="production",
        DEBUG=False,
        JWT_SECRET_KEY="a-very-strong-production-signing-secret-that-exceeds-32-bytes-safely!",
        AI_PROVIDER="google",
        GOOGLE_API_KEY="valid-google-production-api-key",
    )
    assert settings.APP_ENV == "production"
    assert settings.JWT_SECRET_KEY.startswith("a-very-strong")


def test_production_rejects_missing_google_api_key() -> None:
    """Settings in production rejects empty GOOGLE_API_KEY when AI_PROVIDER='google'."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_NAME="GiftMind API",
            APP_ENV="production",
            DEBUG=False,
            JWT_SECRET_KEY="a-very-strong-production-signing-secret-that-exceeds-32-bytes-safely!",
            AI_PROVIDER="google",
            GOOGLE_API_KEY="",
        )
    assert "GOOGLE_API_KEY must be configured in production" in str(exc_info.value)


def test_production_rejects_mock_ai_provider() -> None:
    """Settings in production rejects AI_PROVIDER='mock'."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_NAME="GiftMind API",
            APP_ENV="production",
            DEBUG=False,
            JWT_SECRET_KEY="a-very-strong-production-signing-secret-that-exceeds-32-bytes-safely!",
            AI_PROVIDER="mock",
        )
    assert "AI_PROVIDER='mock' is not allowed in production" in str(exc_info.value)


def test_development_allows_default_secret() -> None:
    """Development environment permits the default placeholder secret for ease of local dev."""
    settings = Settings(
        APP_NAME="GiftMind API",
        APP_ENV="development",
        DEBUG=True,
    )
    assert settings.APP_ENV == "development"
