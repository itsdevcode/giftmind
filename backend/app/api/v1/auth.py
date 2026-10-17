from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_settings, verify_csrf
from app.core.config import Settings
from app.core.security import (
    create_access_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.user import TokenResponse, UserLogin, UserRead, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookies(
    response: Response,
    settings: Settings,
    raw_refresh_token: str,
    csrf_token: str,
) -> None:
    """Helper to set secure refresh token cookie and CSRF cookie."""
    is_secure = (
        settings.AUTH_COOKIE_SECURE
        if settings.AUTH_COOKIE_SECURE is not None
        else (settings.APP_ENV == "production")
    )
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600

    # HttpOnly refresh token cookie scoped to /api/v1/auth
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=raw_refresh_token,
        max_age=refresh_max_age,
        expires=refresh_max_age,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=is_secure,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )

    # CSRF cookie readable by frontend for Double-Submit protection
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=refresh_max_age,
        expires=refresh_max_age,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=is_secure,
        httponly=False,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def _clear_auth_cookies(
    response: Response,
    settings: Settings,
) -> None:
    """Helper to clear refresh token and CSRF cookies."""
    is_secure = (
        settings.AUTH_COOKIE_SECURE
        if settings.AUTH_COOKIE_SECURE is not None
        else (settings.APP_ENV == "production")
    )
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=is_secure,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=is_secure,
        httponly=False,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


async def _issue_tokens_for_user(
    user: User,
    response: Response,
    db: AsyncSession,
    settings: Settings,
) -> TokenResponse:
    """Helper to create access token, generate rotated refresh token, persist in DB, and set cookies."""
    access_token, expires_at = create_access_token(str(user.id), settings)

    raw_refresh_token = generate_secure_token()
    token_hash = hash_token(raw_refresh_token)
    csrf_token = generate_secure_token()

    refresh_expiry = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        is_revoked=False,
        expires_at=refresh_expiry,
    )
    db.add(db_refresh_token)
    await db.commit()

    _set_auth_cookies(response, settings, raw_refresh_token, csrf_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserRead.model_validate(user),
        csrf_token=csrf_token,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: UserRegister,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> TokenResponse:
    """Register a new user account with Argon2id password hashing and return auth credentials."""
    # Check duplicate email
    normalized_email = payload.email.lower()
    existing = await db.execute(select(User).where(User.email == normalized_email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # Hash password with Argon2id
    pw_hash = hash_password(payload.password)

    user = User(
        name=payload.name,
        email=normalized_email,
        password_hash=pw_hash,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # Populates user.id before issuing tokens

    return await _issue_tokens_for_user(user, response, db, settings)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue tokens",
)
async def login(
    payload: UserLogin,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> TokenResponse:
    """Validate credentials and return fresh access token and HttpOnly refresh cookie."""
    normalized_email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return await _issue_tokens_for_user(user, response, db, settings)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue new access token",
)
async def refresh_token(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
    _csrf: Annotated[None, Depends(verify_csrf)],
) -> TokenResponse:
    """Rotate refresh token: revoke used token, generate new refresh token and access token."""
    raw_cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if not raw_cookie_token:
        _clear_auth_cookies(response, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cookie missing.",
        )

    token_hash = hash_token(raw_cookie_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored_token = result.scalar_one_or_none()

    if stored_token is None:
        _clear_auth_cookies(response, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    # Detect reused or revoked token
    if stored_token.is_revoked:
        _clear_auth_cookies(response, settings)
        # Potential token theft: Revoke all tokens for this user for security
        user_tokens = await db.execute(
            select(RefreshToken).where(RefreshToken.user_id == stored_token.user_id)
        )
        for t in user_tokens.scalars():
            t.is_revoked = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked refresh token presented. All sessions terminated.",
        )

    # Check expiration
    if stored_token.expires_at < datetime.now(UTC):
        stored_token.is_revoked = True
        await db.commit()
        _clear_auth_cookies(response, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
        )

    # Revoke current token upon successful rotation
    stored_token.is_revoked = True

    # Check user active status
    user_result = await db.execute(select(User).where(User.id == stored_token.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        await db.commit()
        _clear_auth_cookies(response, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    return await _issue_tokens_for_user(user, response, db, settings)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke refresh token and clear cookies",
)
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
    _csrf: Annotated[None, Depends(verify_csrf)],
) -> dict[str, str]:
    """Revoke stored refresh token and clear authentication cookies."""
    raw_cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if raw_cookie_token:
        token_hash = hash_token(raw_cookie_token)
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored_token = result.scalar_one_or_none()
        if stored_token:
            stored_token.is_revoked = True
            await db.commit()

    _clear_auth_cookies(response, settings)
    return {"status": "logged_out"}
