import pytest
from httpx import AsyncClient

from app.core.config import Settings
from app.core.rate_limit import auth_rate_limiter
from app.core.security import create_csrf_token


@pytest.mark.asyncio
async def test_auth_rate_limiting_exceeded_returns_429(client: AsyncClient) -> None:
    """When a client exceeds the auth rate limit (10 attempts per minute),
    subsequent attempts return HTTP 429 with a Retry-After header.
    """
    auth_rate_limiter.reset()

    # Send 10 login requests (allowed)
    for i in range(10):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": f"ratelimit{i}@example.com", "password": "WrongPassword123!"},
        )
        assert res.status_code == 401, f"Request {i} expected 401, got {res.status_code}"

    # 11th request must trigger rate limit 429
    limited_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "ratelimit11@example.com", "password": "WrongPassword123!"},
    )
    assert limited_res.status_code == 429
    assert "Too many authentication attempts" in limited_res.json()["detail"]
    assert "Retry-After" in limited_res.headers


@pytest.mark.asyncio
async def test_csrf_token_validation_scenarios(
    client: AsyncClient, test_settings: Settings
) -> None:
    """Test comprehensive CSRF protections:
    - Missing CSRF header returns 403
    - Invalid/tampered CSRF header returns 403
    - Expired CSRF header returns 403
    - Cross-session CSRF token (token generated for session A used on session B) returns 403
    """
    # Register user A
    res_a = await client.post(
        "/api/v1/auth/register",
        json={"name": "User Alpha", "email": "alpha@example.com", "password": "Password123!"},
    )
    assert res_a.status_code == 201
    refresh_token_a = res_a.cookies["giftmind_refresh_token"]
    csrf_token_a = res_a.cookies["giftmind_csrf_token"]

    # Register user B (second session)
    res_b = await client.post(
        "/api/v1/auth/register",
        json={"name": "User Beta", "email": "beta@example.com", "password": "Password123!"},
    )
    assert res_b.status_code == 201
    refresh_token_b = res_b.cookies["giftmind_refresh_token"]
    csrf_token_b = res_b.cookies["giftmind_csrf_token"]
    assert refresh_token_b is not None
    assert csrf_token_b is not None

    # 1. Missing CSRF header with cookie present
    res_missing = await client.post(
        "/api/v1/auth/refresh",
        cookies={"giftmind_refresh_token": refresh_token_a},
    )
    assert res_missing.status_code == 403

    # 2. Tampered signature CSRF token
    tampered_csrf = csrf_token_a[:-5] + "12345"
    res_tampered = await client.post(
        "/api/v1/auth/refresh",
        cookies={"giftmind_refresh_token": refresh_token_a},
        headers={"x-csrf-token": tampered_csrf},
    )
    assert res_tampered.status_code == 403

    # 3. Expired CSRF token (created with negative delta)
    expired_csrf = create_csrf_token(
        session_id=refresh_token_a,
        settings=test_settings,
        expires_in_seconds=-60,
    )
    res_expired = await client.post(
        "/api/v1/auth/refresh",
        cookies={"giftmind_refresh_token": refresh_token_a},
        headers={"x-csrf-token": expired_csrf},
    )
    assert res_expired.status_code == 403

    # 4. Cross-session CSRF token: using session B's CSRF token with session A's refresh cookie
    res_cross = await client.post(
        "/api/v1/auth/refresh",
        cookies={"giftmind_refresh_token": refresh_token_a},
        headers={"x-csrf-token": csrf_token_b},
    )
    assert res_cross.status_code == 403
    assert "cross-session" in res_cross.json()["detail"].lower()


@pytest.mark.asyncio
async def test_case_insensitive_email_normalization(client: AsyncClient) -> None:
    """Registering with 'Alice@Example.Com' and logging in with 'alice@example.com' works seamlessly,
    and attempting to register 'ALICE@EXAMPLE.COM' returns 409 Conflict.
    """
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice Norm",
            "email": " Alice.Norm@Example.COM ",
            "password": "Password123!",
        },
    )
    assert res.status_code == 201
    assert res.json()["user"]["email"] == "alice.norm@example.com"

    # Login with lowercase stripped email
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice.norm@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    # Duplicate registration with different casing returns 409
    dup_res = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice Duplicate",
            "email": "ALICE.NORM@EXAMPLE.COM",
            "password": "Password123!",
        },
    )
    assert dup_res.status_code == 409
