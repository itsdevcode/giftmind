import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


@pytest.mark.asyncio
async def test_health_check_returns_200(client: AsyncClient) -> None:
    """GET /health must return status 200 with the specified JSON payload."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "giftmind-api",
    }


@pytest.mark.asyncio
async def test_unhandled_exception_returns_sanitized_response_in_debug() -> None:
    """Unexpected errors must return sanitized responses, never leaking internals even with DEBUG=True."""
    settings = Settings(
        APP_ENV="development",
        DEBUG=True,
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
    )
    app = create_app(settings=settings)

    @app.get("/trigger-error")
    async def trigger_error():
        raise RuntimeError("Secret internal database credentials or stack trace")

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
            response = await test_client.get("/trigger-error")
            assert response.status_code == 500
            data = response.json()
            assert data == {
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred.",
                }
            }
            # Crucial assertion: internal error string must not be leaked
            assert "Secret" not in response.text
            assert "database credentials" not in response.text
