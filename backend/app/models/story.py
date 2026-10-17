import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
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


class StoryKeepsakeStatus(enum.StrEnum):
    """Lifecycle / execution status of a story keepsake generation."""

    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"


class MemoryAnswer(Base):
    """Guided memory interview response answering a specific prompt for a gift project."""

    __tablename__ = "memory_answers"

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
    gift_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gift_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_key: Mapped[str] = mapped_column(String(50), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
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
    user: Mapped["User"] = relationship("User")
    gift_project: Mapped["GiftProject"] = relationship(
        "GiftProject", back_populates="memory_answers"
    )

    __table_args__ = (
        UniqueConstraint(
            "gift_project_id",
            "question_key",
            name="uq_memory_answers_project_question",
        ),
        Index("ix_memory_answers_project_id", "gift_project_id"),
    )


class StoryKeepsake(Base):
    """Personalized narrative keepsake generated from recipient memories."""

    __tablename__ = "story_keepsakes"

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
    gift_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gift_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    dedication: Mapped[str] = mapped_column(Text, nullable=False)
    story_body: Mapped[str] = mapped_column(Text, nullable=False)
    closing_message: Mapped[str] = mapped_column(Text, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")
    status: Mapped[StoryKeepsakeStatus] = mapped_column(
        SAEnum(
            StoryKeepsakeStatus,
            name="story_keepsake_status",
            values_callable=lambda obj: [e.value for e in obj],
            native_enum=True,
        ),
        nullable=False,
        default=StoryKeepsakeStatus.pending,
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
    user: Mapped["User"] = relationship("User")
    gift_project: Mapped["GiftProject"] = relationship(
        "GiftProject", back_populates="story_keepsakes"
    )

    __table_args__ = (
        Index("ix_story_keepsakes_project_created", "gift_project_id", "created_at"),
        Index(
            "uq_story_keepsakes_project_pending",
            "gift_project_id",
            unique=True,
            postgresql_where=(status == StoryKeepsakeStatus.pending),
        ),
    )
