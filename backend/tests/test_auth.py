import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_token
from app.models.refresh_token import RefreshToken
from app.models.user import User


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, test_app) -> None:
    """Register a new user, assert 201 response, cookies set, and database state persisted."""
    payload = {
        "name": "Alice Developer",
        "email": "alice@example.com",
        "password": "SecurePassword123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["name"] == "Alice Developer"
    assert data["user"]["is_active"] is True
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify cookies
    assert "giftmind_refresh_token" in response.cookies
    assert "giftmind_csrf_token" in response.cookies

    # Assert database state
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        user_res = await session.execute(select(User).where(User.email == "alice@example.com"))
        user = user_res.scalar_one_or_none()
        assert user is not None
        assert user.name == "Alice Developer"
        assert user.password_hash.startswith("$argon2")


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    """Duplicate email registration must return 409 Conflict."""
    payload = {
        "name": "Bob Duplicate",
        "email": "bob@example.com",
        "password": "SecurePassword123!",
    }
    first_res = await client.post("/api/v1/auth/register", json=payload)
    assert first_res.status_code == 201

    second_res = await client.post("/api/v1/auth/register", json=payload)
    assert second_res.status_code == 409
    assert "already exists" in second_res.json()["detail"]


@pytest.mark.asyncio
async def test_login_success_and_password_verification(client: AsyncClient) -> None:
    """User can log in with correct credentials and receive fresh tokens."""
    reg_payload = {
        "name": "Charlie Tester",
        "email": "charlie@example.com",
        "password": "CorrectPassword123!",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Attempt login with correct password
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "charlie@example.com", "password": "CorrectPassword123!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "charlie@example.com"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    """Login with wrong password or unknown email returns 401."""
    # Unknown email
    res1 = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "Password123!"},
    )
    assert res1.status_code == 401

    # Wrong password
    reg_payload = {
        "name": "David WrongPass",
        "email": "david@example.com",
        "password": "CorrectPassword123!",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    res2 = await client.post(
        "/api/v1/auth/login",
        json={"email": "david@example.com", "password": "WrongPassword123!"},
    )
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_login_deactivated_account(client: AsyncClient, test_app) -> None:
    """Deactivated account cannot log in and returns 403."""
    reg_payload = {
        "name": "Deactivated User",
        "email": "deactivated@example.com",
        "password": "Password123!",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Deactivate in database
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        user_res = await session.execute(
            select(User).where(User.email == "deactivated@example.com")
        )
        user = user_res.scalar_one()
        user.is_active = False
        await session.commit()

    # Try login
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "deactivated@example.com", "password": "Password123!"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_revocation(client: AsyncClient, test_app) -> None:
    """Refresh token endpoint rotates tokens, revokes the previous token, and requires CSRF."""
    reg_payload = {
        "name": "Eve Rotator",
        "email": "eve@example.com",
        "password": "Password123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    refresh_token_cookie_1 = reg_res.cookies.get("giftmind_refresh_token")
    csrf_token = reg_res.cookies.get("giftmind_csrf_token")
    assert refresh_token_cookie_1 is not None
    assert csrf_token is not None

    # 1. Missing CSRF header should return 403
    client.cookies.set("giftmind_refresh_token", refresh_token_cookie_1)
    client.cookies.set("giftmind_csrf_token", csrf_token)
    csrf_fail_res = await client.post("/api/v1/auth/refresh")
    assert csrf_fail_res.status_code == 403

    # 2. Valid refresh request with CSRF header
    refresh_res_1 = await client.post(
        "/api/v1/auth/refresh",
        headers={"x-csrf-token": csrf_token},
    )
    assert refresh_res_1.status_code == 200
    refresh_token_cookie_2 = refresh_res_1.cookies.get("giftmind_refresh_token")
    csrf_token_2 = refresh_res_1.cookies.get("giftmind_csrf_token")
    assert refresh_token_cookie_2 is not None
    assert refresh_token_cookie_2 != refresh_token_cookie_1

    # Verify first refresh token in DB is now marked revoked
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        first_hash = hash_token(refresh_token_cookie_1)
        res = await session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == first_hash)
        )
        token_1_db = res.scalar_one()
        assert token_1_db.is_revoked is True

    # 3. Replaying revoked refresh token (replay attack detection)
    client.cookies.set("giftmind_refresh_token", refresh_token_cookie_1)
    client.cookies.set("giftmind_csrf_token", csrf_token_2)
    replay_res = await client.post(
        "/api/v1/auth/refresh",
        headers={"x-csrf-token": csrf_token_2},
    )
    assert replay_res.status_code == 401
    assert "Revoked" in replay_res.json()["detail"]


@pytest.mark.asyncio
async def test_logout_revokes_token_and_clears_cookies(client: AsyncClient, test_app) -> None:
    """Logout endpoint marks refresh token revoked and clears auth cookies."""
    reg_payload = {
        "name": "Frank Logout",
        "email": "frank@example.com",
        "password": "Password123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    refresh_token = reg_res.cookies.get("giftmind_refresh_token")
    csrf_token = reg_res.cookies.get("giftmind_csrf_token")

    client.cookies.set("giftmind_refresh_token", refresh_token)
    client.cookies.set("giftmind_csrf_token", csrf_token)

    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers={"x-csrf-token": csrf_token},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "logged_out"

    # Assert token revoked in database
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        t_hash = hash_token(refresh_token)
        res = await session.execute(select(RefreshToken).where(RefreshToken.token_hash == t_hash))
        tok = res.scalar_one()
        assert tok.is_revoked is True


@pytest.mark.asyncio
async def test_get_users_me(client: AsyncClient) -> None:
    """Authenticated user can fetch own profile with valid bearer token."""
    reg_payload = {
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "password": "Password123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    access_token = reg_res.json()["access_token"]

    # Request without token -> 401
    unauth_res = await client.get("/api/v1/users/me")
    assert unauth_res.status_code == 401

    # Request with invalid token -> 401
    invalid_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    assert invalid_res.status_code == 401

    # Request with valid bearer token
    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "grace@example.com"
    assert me_data["name"] == "Grace Hopper"
    assert me_data["is_active"] is True
