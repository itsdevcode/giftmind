import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints


class UserBase(BaseModel):
    """Base user schema properties."""

    name: Annotated[str, StringConstraints(min_length=1, max_length=255, strip_whitespace=True)]
    email: EmailStr


class UserRegister(UserBase):
    """Payload schema for user registration."""

    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]


class UserLogin(BaseModel):
    """Payload schema for user login."""

    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class UserRead(UserBase):
    """Response schema for public/me user details."""

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Response schema for token issuance."""

    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserRead
    csrf_token: str
