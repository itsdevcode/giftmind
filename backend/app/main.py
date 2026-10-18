import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.v1.router import router as api_v1_router
from app.core.config import Settings, get_settings
from app.core.tasks import task_manager
from app.db.session import create_engine_and_sessionmaker
from app.models.recommendation import (
    GiftRecommendationGeneration,
    RecommendationGenerationStatus,
)
from app.models.story import StoryKeepsake, StoryKeepsakeStatus
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)


async def recover_orphaned_generations(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Recover any orphaned pending generations/stories left behind by an unexpected server shutdown."""
    async with session_factory() as session:
        await session.execute(
            update(GiftRecommendationGeneration)
            .where(GiftRecommendationGeneration.status == RecommendationGenerationStatus.pending)
            .values(
                status=RecommendationGenerationStatus.failed,
                error_message="Generation was interrupted due to a server restart. Please retry.",
                updated_at=datetime.now(UTC),
            )
        )
        await session.execute(
            update(StoryKeepsake)
            .where(StoryKeepsake.status == StoryKeepsakeStatus.pending)
            .values(
                status=StoryKeepsakeStatus.failed,
                error_message="Story generation was interrupted due to a server restart. Please retry.",
                updated_at=datetime.now(UTC),
            )
        )
        await session.commit()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory for GiftMind API."""
    if settings is None:
        settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Application lifespan manager for startup and graceful shutdown."""
        # Reset background task manager state on application startup
        task_manager.reset()

        # Initialize engine and sessionmaker strictly scoped to this application instance
        engine, session_factory = create_engine_and_sessionmaker(settings)
        app.state.engine = engine
        app.state.session_factory = session_factory
        app.state.task_manager = task_manager

        # Recover any orphaned pending generations/stories left behind by previous unexpected server shutdown
        if not settings.DATABASE_URL.startswith("sqlite"):
            try:
                await recover_orphaned_generations(session_factory)
            except Exception as exc:
                logger.warning("Could not execute startup pending generation recovery: %s", exc)

        yield

        # Shutdown actions: cleanly cancel active background tasks and close database engine
        await task_manager.shutdown(timeout=5.0)
        await engine.dispose()

    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="Turn Memories Into Meaningful Gifts - GiftMind API",
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
        if settings.DEBUG or settings.APP_ENV != "production"
        else None,
        docs_url=f"{settings.API_V1_STR}/docs"
        if settings.DEBUG or settings.APP_ENV != "production"
        else None,
        redoc_url=f"{settings.API_V1_STR}/redoc"
        if settings.DEBUG or settings.APP_ENV != "production"
        else None,
        lifespan=lifespan,
    )

    # Store settings in app state for reliable access
    app.state.settings = settings

    # CORS configuration
    if settings.cors_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Global Exception Handler for unhandled exceptions
    # Always returns a sanitized JSON response (no exception leakage even in DEBUG)
    # Server-side logs contain full trace for debugging.
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred.",
                }
            },
        )

    # Health Check endpoint
    @app.get(
        "/health",
        response_model=HealthResponse,
        summary="Service Health Check",
        tags=["Health"],
    )
    async def health_check() -> HealthResponse:
        return HealthResponse(status="ok", service="giftmind-api")

    # Centralized API v1 router registration
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
