import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class RecipientBase(BaseModel):
    """Base schema for recipient data."""

    name: Annotated[str, StringConstraints(min_length=1, max_length=255, strip_whitespace=True)]
    relationship: Annotated[
        str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)
    ]
    interests: list[
        Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]
    ] = Field(
        default_factory=list,
    )
    notes: str | None = Field(default=None, max_length=5000)


class RecipientCreate(RecipientBase):
    """Payload schema for creating a recipient."""

    pass


class RecipientUpdate(BaseModel):
    """Payload schema for updating a recipient."""

    name: (
        Annotated[str, StringConstraints(min_length=1, max_length=255, strip_whitespace=True)]
        | None
    ) = None
    relationship: (
        Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]
        | None
    ) = None
    interests: (
        list[Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]]
        | None
    ) = None
    notes: str | None = Field(default=None, max_length=5000)


class RecipientRead(RecipientBase):
    """Response schema for recipient details."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecipientListResponse(BaseModel):
    """Paginated list response for recipients."""

    items: list[RecipientRead]
    total: int
    limit: int
    offset: int
