from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing isolated test settings with in-memory test database."""
    return Settings(
        APP_NAME="GiftMind API [Test]",
        APP_ENV="testing",
        DEBUG=True,
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        CORS_ORIGINS=["http://testserver"],
    )


@pytest.fixture
async def app_instance(test_settings: Settings):
    """Fixture providing an initialized FastAPI app with running lifespan."""
    test_app = create_app(settings=test_settings)
    async with test_app.router.lifespan_context(test_app):
        yield test_app


@pytest.fixture
async def client(app_instance) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client fixture with the created FastAPI application running lifespan."""
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
