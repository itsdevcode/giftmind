from collections.abc import AsyncGenerator
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import Settings


class Base(DeclarativeBase):
    """SQLAlchemy Declarative Base class for all domain models."""

    pass


def create_engine_and_sessionmaker(
    settings: Settings,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Initialize an async database engine and sessionmaker from settings.

    Ensures no global/shared state is stored, allowing separate application
    instances to manage independent database engines and connection pools.
    """
    engine_kwargs: dict[str, Any] = {
        "echo": settings.DB_ECHO or settings.DEBUG,
        "future": True,
    }

    # SQLite async connection (used for light/smoke testing) does not support pool_size
    if not settings.DATABASE_URL.startswith("sqlite"):
        engine_kwargs.update(
            {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_timeout": settings.DB_POOL_TIMEOUT,
                "pool_recycle": settings.DB_POOL_RECYCLE,
                "pool_pre_ping": True,
            }
        )

    engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
    sessionmaker_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    return engine, sessionmaker_factory


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding database sessions scoped to application state.

    The session factory is retrieved from `request.app.state.session_factory`.
    Does NOT automatically commit transactions on success; callers/endpoints must
    define explicit transactional boundaries (e.g. `await session.commit()`).
    """
    session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
