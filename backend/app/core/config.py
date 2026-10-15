from functools import lru_cache
from typing import Literal

from pydantic import Field
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


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton to avoid repeated disk or env reads."""
    return Settings()
