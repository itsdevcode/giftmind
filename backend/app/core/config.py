from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """GiftMind application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "GiftMind API"
    APP_ENV: Literal["development", "testing", "staging", "production"] = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # PostgreSQL Database URL (asyncpg format by default)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/giftmind",
        description="Async database connection string",
    )

    # Database Pool Configuration
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_ECHO: bool = False

    # CORS configuration: comma-separated list of origins or list of strings
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Authentication & Security Configuration
    JWT_SECRET_KEY: str = Field(
        default="giftmind-insecure-dev-secret-key-change-in-production-min32bytes!",
        description="Secret key for signing JWT tokens",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookie Settings
    AUTH_COOKIE_NAME: str = "giftmind_refresh_token"
    AUTH_COOKIE_PATH: str = "/api/v1/auth"
    AUTH_COOKIE_DOMAIN: str | None = None
    AUTH_COOKIE_SECURE: bool | None = (
        None  # None = dynamically deduced (True if production else False)
    )
    AUTH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    # CSRF Settings
    CSRF_COOKIE_NAME: str = "giftmind_csrf_token"
    CSRF_HEADER_NAME: str = "x-csrf-token"

    # AI Provider & Inference Configuration
    AI_PROVIDER: Literal["google", "mock"] = "google"
    GOOGLE_API_KEY: str = Field(
        default="",
        description="Server-side API key for Google-hosted Gemma inference via google-genai",
    )
    GEMMA_MODEL: str = "gemma-4-26b-a4b-it"
    AI_REQUEST_TIMEOUT_SECONDS: float = 90.0

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Enforce strict cryptographic secret standards in production environments."""
        insecure_placeholders = {
            "giftmind-insecure-dev-secret-key-change-in-production-min32bytes!",
            "change-this-to-a-secure-random-32-byte-secret-in-production",
            "secret",
            "changeme",
            "default",
            "test-secret-key-for-testing-purposes-only-32bytes!",
        }

        if self.APP_ENV == "production":
            val = (self.JWT_SECRET_KEY or "").strip()
            if not val:
                raise ValueError("JWT_SECRET_KEY must be configured in production.")
            lower_val = val.lower()
            if (
                val in insecure_placeholders
                or "change" in lower_val
                or "placeholder" in lower_val
                or "insecure" in lower_val
                or "secret" == lower_val
            ):
                raise ValueError(
                    "JWT_SECRET_KEY is set to an insecure default/placeholder and cannot be used in production."
                )
            if len(val) < 32:
                raise ValueError(
                    f"JWT_SECRET_KEY must be at least 32 characters long in production (current length: {len(val)})."
                )

            if self.AI_PROVIDER == "mock":
                raise ValueError(
                    "AI_PROVIDER='mock' is not allowed in production. Configure a real inference provider (e.g. 'google')."
                )

            if self.AI_PROVIDER == "google":
                api_key = (self.GOOGLE_API_KEY or "").strip()
                if not api_key:
                    raise ValueError(
                        "GOOGLE_API_KEY must be configured in production when AI_PROVIDER='google'."
                    )

        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton to avoid repeated disk or env reads."""
    return Settings()
