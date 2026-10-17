"""Model registry strategy.

Import all domain models here so Alembic autogenerate
can discover their metadata through Base.metadata.
"""

from app.db.session import Base
from app.models.gift_project import GiftProject, GiftProjectStatus
from app.models.recipient import Recipient
from app.models.recommendation import (
    GiftRecommendation,
    GiftRecommendationGeneration,
    RecommendationGenerationStatus,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Recipient",
    "GiftProject",
    "GiftProjectStatus",
    "RefreshToken",
    "GiftRecommendationGeneration",
    "GiftRecommendation",
    "RecommendationGenerationStatus",
]
