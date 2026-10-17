import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import decode_access_token, verify_csrf_token
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_settings(request: Request) -> Settings:
    """Retrieve application settings from request app state."""
    return request.app.state.settings


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """FastAPI dependency for verifying access token and returning current active user.

    Raises 401 if missing, invalid, expired, or user not found.
    Raises 403 if user account is deactivated.
    """
    settings: Settings = request.app.state.settings

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token, settings)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token subject missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


async def verify_csrf(request: Request) -> None:
    """FastAPI dependency to verify session-bound HMAC CSRF token on state-changing cookie requests.

    Validates that:
    1. A refresh token cookie exists (the authenticated session).
    2. A CSRF token header (or fallback cookie) is provided.
    3. The CSRF token signature matches HMAC-SHA256(JWT_SECRET_KEY, session_id:entropy:expiry).
    4. The CSRF token is not expired and binds strictly to this refresh token.
    """
    settings: Settings = request.app.state.settings
    raw_refresh_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    csrf_token = request.headers.get(settings.CSRF_HEADER_NAME)

    if not raw_refresh_token or not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing CSRF token.",
        )

    if not verify_csrf_token(csrf_token, raw_refresh_token, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid, expired, or cross-session CSRF token.",
        )
