import os
from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import Settings
from app.main import create_app
from app.models import Base


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing isolated test settings.
    Uses DATABASE_URL from environment (e.g. PostgreSQL in CI or local) or falls back to in-memory sqlite.
    """
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    return Settings(
        APP_NAME="GiftMind API [Test]",
        APP_ENV="testing",
        DEBUG=True,
        DATABASE_URL=db_url,
        CORS_ORIGINS=["http://testserver"],
        JWT_SECRET_KEY="test-secret-key-for-testing-purposes-only-32bytes!",
        ACCESS_TOKEN_EXPIRE_MINUTES=15,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        AUTH_COOKIE_SECURE=False,
    )


@pytest.fixture
async def test_app(test_settings: Settings) -> AsyncGenerator[FastAPI, None]:
    """FastAPI application fixture with database tables initialized and cleaned for each test."""
    app_instance = create_app(settings=test_settings)
    async with app_instance.router.lifespan_context(app_instance):
        engine = app_instance.state.engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Clean tables so each test starts with a clean database state
            if not test_settings.DATABASE_URL.startswith("sqlite"):
                await conn.execute(
                    text("TRUNCATE TABLE gift_projects, recipients, refresh_tokens, users CASCADE")
                )
            else:
                for table in reversed(Base.metadata.sorted_tables):
                    await conn.execute(table.delete())
        yield app_instance


@pytest.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client fixture with the created FastAPI application."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
