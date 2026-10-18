import enum
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.gift_project import GiftProject
    from app.models.user import User


class RecommendationGenerationStatus(enum.StrEnum):
    """Execution status of an AI recommendation generation run."""

    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"


class GiftRecommendationGeneration(Base):
    """Batch generation event triggered by a user for a gift project."""

    __tablename__ = "gift_recommendation_generations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    gift_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gift_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")
    status: Mapped[RecommendationGenerationStatus] = mapped_column(
        SAEnum(
            RecommendationGenerationStatus,
            name="recommendation_generation_status",
            values_callable=lambda obj: [e.value for e in obj],
            native_enum=True,
        ),
        nullable=False,
        default=RecommendationGenerationStatus.pending,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    gift_project: Mapped["GiftProject"] = relationship(
        "GiftProject", back_populates="recommendation_generations"
    )
    user: Mapped["User"] = relationship("User")
    recommendations: Mapped[list["GiftRecommendation"]] = relationship(
        "GiftRecommendation",
        back_populates="generation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="GiftRecommendation.created_at.asc(), GiftRecommendation.id.asc()",
    )

    __table_args__ = (
        Index(
            "ix_gift_recommendation_generations_project_created",
            "gift_project_id",
            "created_at",
        ),
        Index(
            "uq_gift_recommendation_generations_project_pending",
            "gift_project_id",
            unique=True,
            postgresql_where=(status == RecommendationGenerationStatus.pending),
            sqlite_where=(status == RecommendationGenerationStatus.pending),
        ),
    )


class GiftRecommendation(Base):
    """An individual structured gift idea produced by an AI generation."""

    __tablename__ = "gift_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    generation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gift_recommendation_generations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gift_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gift_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    personalization_reason: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    presentation_idea: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    generation: Mapped["GiftRecommendationGeneration"] = relationship(
        "GiftRecommendationGeneration", back_populates="recommendations"
    )
    gift_project: Mapped["GiftProject"] = relationship(
        "GiftProject", back_populates="recommendations"
    )

    __table_args__ = (
        Index(
            "ix_gift_recommendations_project_created",
            "gift_project_id",
            "created_at",
        ),
    )
