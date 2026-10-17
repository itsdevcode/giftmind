import enum
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.recipient import Recipient
    from app.models.user import User


class GiftProjectStatus(enum.StrEnum):
    """Lifecycle status of a gift project."""

    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"


class GiftProject(Base):
    """Gift project domain model representing a curated gift initiative."""

    __tablename__ = "gift_projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recipients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    occasion: Mapped[str] = mapped_column(String(100), nullable=False)
    occasion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget_min: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    budget_max: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    status: Mapped[GiftProjectStatus] = mapped_column(
        SAEnum(
            GiftProjectStatus,
            name="gift_project_status",
            values_callable=lambda obj: [e.value for e in obj],
            native_enum=True,
        ),
        nullable=False,
        default=GiftProjectStatus.draft,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="gift_projects")
    recipient: Mapped["Recipient"] = relationship("Recipient", back_populates="gift_projects")

    __table_args__ = (
        CheckConstraint(
            "budget_min >= 0",
            name="ck_gift_projects_budget_min_non_negative",
        ),
        CheckConstraint(
            "budget_max >= budget_min",
            name="ck_gift_projects_budget_max_gte_min",
        ),
        Index("ix_gift_projects_user_id_created_at", "user_id", "created_at"),
        Index("ix_gift_projects_status", "status"),
    )
