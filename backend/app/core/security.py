import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import Settings

# Initialize Argon2id password hasher with secure defaults
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if the password hash needs to be upgraded to current security parameters."""
    try:
        return _ph.check_needs_rehash(hashed_password)
    except Exception:
        return True


def create_access_token(
    user_id: str,
    settings: Settings,
    expires_delta: timedelta | None = None,
) -> tuple[str, datetime]:
    """Create a short-lived signed JWT access token.

    Returns:
        (token_string, expires_at_datetime)
    """
    now = datetime.now(UTC)
    if expires_delta is not None:
        expires_at = now + expires_delta
    else:
        expires_at = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "type": "access",
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_at


def decode_access_token(token: str, settings: Settings) -> dict[str, Any] | None:
    """Decode and validate a JWT access token.

    Returns the payload dictionary or None if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def generate_secure_token() -> str:
    """Generate a high-entropy URL-safe random token string."""
    return secrets.token_urlsafe(48)


def hash_token(raw_token: str) -> str:
    """Compute a SHA-256 hash of a raw token for secure database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_csrf_token(
    session_id: str,
    settings: Settings,
    expires_in_seconds: int = 3600 * 24 * 7,
) -> str:
    """Create a session-bound, cryptographically signed CSRF token.

    Format: raw_entropy.expiry_timestamp.signature
    Signature: HMAC-SHA256(secret, f"{session_id}:{raw_entropy}:{expiry_timestamp}")
    """
    import hmac

    raw_entropy = secrets.token_urlsafe(32)
    expires_at = int(datetime.now(UTC).timestamp()) + expires_in_seconds
    msg = f"{session_id}:{raw_entropy}:{expires_at}".encode()
    sig = hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return f"{raw_entropy}.{expires_at}.{sig}"


def verify_csrf_token(
    token: str,
    session_id: str,
    settings: Settings,
) -> bool:
    """Verify that a CSRF token is authentic, unexpired, and bound to the specific session."""
    import hmac

    parts = token.split(".")
    if len(parts) != 3:
        return False
    raw_entropy, expires_at_str, signature = parts
    try:
        expires_at = int(expires_at_str)
    except ValueError:
        return False

    now = int(datetime.now(UTC).timestamp())
    if now > expires_at:
        return False

    expected_msg = f"{session_id}:{raw_entropy}:{expires_at}".encode()
    expected_sig = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"), expected_msg, hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_sig)
