"""Model registry strategy.

Import all domain models here as they are developed so Alembic autogenerate
can discover their metadata through Base.metadata.
"""

from app.db.session import Base

__all__ = ["Base"]
