import asyncio

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_concurrent_refresh_token_rotation_allows_only_one_success(
    client: AsyncClient,
) -> None:
    """When two concurrent requests try to consume the exact same refresh token,
    PostgreSQL row locking (SELECT ... FOR UPDATE) ensures only one transaction
    succeeds and rotates the token, while the concurrent request receives 401.
    """
    reg_payload = {
        "name": "Concurrent Tester",
        "email": "concurrency@example.com",
        "password": "Password123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    refresh_token = reg_res.cookies.get("giftmind_refresh_token")
    csrf_token = reg_res.cookies.get("giftmind_csrf_token")
    assert refresh_token is not None
    assert csrf_token is not None

    # Construct two simultaneous requests with the identical cookie and CSRF header
    async def make_refresh_request():
        return await client.post(
            "/api/v1/auth/refresh",
            cookies={"giftmind_refresh_token": refresh_token},
            headers={"x-csrf-token": csrf_token},
        )

    res1, res2 = await asyncio.gather(make_refresh_request(), make_refresh_request())

    status_codes = sorted([res1.status_code, res2.status_code])
    # Exactly one request must succeed with 200 OK and the other must fail with 401 Unauthorized
    assert status_codes == [200, 401]


@pytest.mark.asyncio
async def test_concurrent_registration_with_same_email(
    client: AsyncClient,
) -> None:
    """Simultaneous registration requests with identical or different-cased emails
    safely resolve via database unique constraint race handling: exactly one succeeds (201)
    and the other receives 409 Conflict without unhandled 500 exceptions.
    """
    payload_a = {
        "name": "Racer One",
        "email": "racer@example.com",
        "password": "Password123!",
    }
    payload_b = {
        "name": "Racer Two",
        "email": "RACER@EXAMPLE.COM",
        "password": "Password123!",
    }

    async def register_user(payload):
        return await client.post("/api/v1/auth/register", json=payload)

    res1, res2 = await asyncio.gather(register_user(payload_a), register_user(payload_b))

    status_codes = sorted([res1.status_code, res2.status_code])
    # Under concurrent execution: exactly one 201 and one 409
    assert status_codes == [201, 409]
