import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.gift_project import GiftProjectStatus


class GiftProjectBase(BaseModel):
    """Base schema for gift project fields."""

    recipient_id: uuid.UUID
    title: Annotated[str, StringConstraints(min_length=1, max_length=255, strip_whitespace=True)]
    occasion: Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]
    occasion_date: date | None = None
    budget_min: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2)
    budget_max: Decimal = Field(ge=Decimal("0.00"), decimal_places=2)
    currency: Annotated[str, StringConstraints(min_length=3, max_length=3, to_upper=True)] = "USD"
    status: GiftProjectStatus = GiftProjectStatus.draft

    @model_validator(mode="after")
    def validate_budget_bounds(self) -> "GiftProjectBase":
        if self.budget_max < self.budget_min:
            raise ValueError("budget_max must be greater than or equal to budget_min")
        return self


class GiftProjectCreate(GiftProjectBase):
    """Payload schema for creating a gift project."""

    pass


class GiftProjectUpdate(BaseModel):
    """Payload schema for updating a gift project."""

    recipient_id: uuid.UUID | None = None
    title: (
        Annotated[str, StringConstraints(min_length=1, max_length=255, strip_whitespace=True)]
        | None
    ) = None
    occasion: (
        Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]
        | None
    ) = None
    occasion_date: date | None = None
    budget_min: Decimal | None = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    budget_max: Decimal | None = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    currency: (
        Annotated[str, StringConstraints(min_length=3, max_length=3, to_upper=True)] | None
    ) = None
    status: GiftProjectStatus | None = None

    @model_validator(mode="after")
    def validate_budget_bounds(self) -> "GiftProjectUpdate":
        if self.budget_min is not None and self.budget_max is not None:
            if self.budget_max < self.budget_min:
                raise ValueError("budget_max must be greater than or equal to budget_min")
        return self


class GiftProjectRead(BaseModel):
    """Response schema for gift project details."""

    id: uuid.UUID
    user_id: uuid.UUID
    recipient_id: uuid.UUID
    title: str
    occasion: str
    occasion_date: date | None
    budget_min: Decimal
    budget_max: Decimal
    currency: str
    status: GiftProjectStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GiftProjectListResponse(BaseModel):
    """Paginated list response for gift projects."""

    items: list[GiftProjectRead]
    total: int
    limit: int
    offset: int
