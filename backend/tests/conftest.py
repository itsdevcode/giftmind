import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing isolated test settings.
    Uses DATABASE_URL from environment (e.g. PostgreSQL in CI) or falls back to in-memory sqlite.
    """
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    return Settings(
        APP_NAME="GiftMind API [Test]",
        APP_ENV="testing",
        DEBUG=True,
        DATABASE_URL=db_url,
        CORS_ORIGINS=["http://testserver"],
    )


@pytest.fixture
async def client(test_settings: Settings) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client fixture with the created FastAPI application."""
    test_app = create_app(settings=test_settings)
    async with test_app.router.lifespan_context(test_app):
        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            yield ac
