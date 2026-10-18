import asyncio
import logging
import time
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_settings, get_current_user
from app.core.config import Settings
from app.core.tasks import task_manager
from app.db.session import get_db
from app.models.gift_project import GiftProject
from app.models.recipient import Recipient
from app.models.recommendation import (
    GiftRecommendation,
    GiftRecommendationGeneration,
    RecommendationGenerationStatus,
)
from app.models.user import User
from app.schemas.recommendation import (
    GiftRecommendationGenerationRead,
    GiftRecommendationRead,
)
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderError,
    AIProviderUnavailableError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.factory import get_ai_provider
from app.services.ai.prompts import PROMPT_VERSION, RecommendationPromptInput

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gift-projects/{project_id}/recommendations", tags=["Gift Recommendations"]
)


async def _execute_generation_worker(
    generation_id: uuid.UUID,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    prompt_input: RecommendationPromptInput,
    budget_min: Decimal,
    budget_max: Decimal,
    currency: str,
    settings: Settings,
    session_factory,
) -> None:
    """Asynchronous background worker task that generates AI gift recommendations and persists results."""
    ai_provider = get_ai_provider(settings)
    start_time = time.monotonic()
    logger.info(
        "Starting background recommendation generation (gen_id=%s, project_id=%s, user_id=%s, provider=%s, model=%s)",
        generation_id,
        project_id,
        user_id,
        ai_provider.provider_name,
        ai_provider.model_name,
    )
    try:
        raw_output = await ai_provider.generate_gift_recommendations(prompt_input)

        # Validate budget bounds on generated recommendations
        for idea in raw_output.recommendations:
            if idea.estimated_budget < budget_min or idea.estimated_budget > budget_max:
                raise ValueError(
                    f"Generated gift idea '{idea.title}' budget (${idea.estimated_budget}) "
                    f"exceeds project boundaries [${budget_min}, ${budget_max}]."
                )

        async with session_factory() as session:
            gen = await session.get(GiftRecommendationGeneration, generation_id)
            if not gen or gen.status != RecommendationGenerationStatus.pending:
                logger.warning(
                    "Generation %s is no longer pending (current: %s); aborting background write.",
                    generation_id,
                    getattr(gen, "status", None),
                )
                return

            db_recommendations = [
                GiftRecommendation(
                    generation_id=generation_id,
                    gift_project_id=project_id,
                    title=idea.title,
                    description=idea.description,
                    category=idea.category,
                    personalization_reason=idea.personalization_reason,
                    estimated_budget=idea.estimated_budget,
                    currency=currency,
                    presentation_idea=idea.presentation_idea,
                )
                for idea in raw_output.recommendations
            ]
            session.add_all(db_recommendations)
            gen.status = RecommendationGenerationStatus.succeeded
            gen.error_message = None
            gen.updated_at = datetime.now(UTC)
            await session.commit()
            elapsed = time.monotonic() - start_time
            logger.info(
                "Background recommendation generation succeeded (gen_id=%s, project_id=%s, elapsed=%.2fs)",
                generation_id,
                project_id,
                elapsed,
            )

    except asyncio.CancelledError:
        logger.warning(
            "Background recommendation generation task was cancelled (gen_id=%s, project_id=%s)",
            generation_id,
            project_id,
        )
        try:
            async with session_factory() as session:
                gen = await session.get(GiftRecommendationGeneration, generation_id)
                if gen and gen.status == RecommendationGenerationStatus.pending:
                    gen.status = RecommendationGenerationStatus.failed
                    gen.error_message = (
                        "Recommendation generation was interrupted or cancelled. Please retry."
                    )
                    gen.updated_at = datetime.now(UTC)
                    await session.commit()
        except Exception as cancel_db_err:
            logger.warning(
                "Failed to update cancelled generation %s status to failed: %s",
                generation_id,
                cancel_db_err,
            )
        raise

    except Exception as exc:
        elapsed = time.monotonic() - start_time
        category = type(exc).__name__
        if isinstance(exc, AIModelNotFoundError):
            error_message = "The configured AI model was not found on the inference host."
        elif isinstance(exc, AIAuthenticationError):
            error_message = "The AI inference service authentication failed. Please verify API key configuration."
        elif isinstance(exc, AIRateLimitError):
            error_message = "The AI recommendation service is currently busy. Please wait a moment and try again."
        elif isinstance(exc, AIInferenceTimeoutError):
            error_message = "The AI inference request timed out. Please try again."
        elif isinstance(exc, AIProviderUnavailableError):
            error_message = (
                "The AI inference service is temporarily unavailable. Please try again shortly."
            )
        elif isinstance(exc, (AIResponseValidationError, AIProviderError)):
            error_message = "The AI service returned an invalid or malformed recommendation output. Please retry."
        elif isinstance(exc, ValueError):
            error_message = str(exc)
        else:
            error_message = "An unexpected error occurred while communicating with the AI service. Please try again."

        logger.error(
            "Background recommendation generation failed (gen_id=%s, project_id=%s, provider=%s, elapsed=%.2fs, category=%s, err=%s)",
            generation_id,
            project_id,
            ai_provider.provider_name,
            elapsed,
            category,
            error_message,
        )
        try:
            async with session_factory() as session:
                gen = await session.get(GiftRecommendationGeneration, generation_id)
                if gen and gen.status == RecommendationGenerationStatus.pending:
                    gen.status = RecommendationGenerationStatus.failed
                    gen.error_message = error_message
                    gen.updated_at = datetime.now(UTC)
                    await session.commit()
                else:
                    logger.warning(
                        "Generation %s is no longer pending (current: %s); skipping error transition.",
                        generation_id,
                        getattr(gen, "status", None),
                    )
        except Exception as db_err:
            logger.critical(
                "Failed to update generation %s status to failed: %s", generation_id, db_err
            )


@router.post(
    "/generate",
    response_model=GiftRecommendationGenerationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized AI gift recommendations for a gift project",
)
async def generate_recommendations(
    project_id: uuid.UUID,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
    background: Annotated[
        bool, Query(description="Run generation asynchronously in the background")
    ] = False,
) -> GiftRecommendationGenerationRead:
    """Generate exactly 3 personalized, budget-aware gift recommendations using AI for an owned project."""
    # 1. Enforce project ownership and acquire row-level lock on the project
    project_res = await db.execute(
        select(GiftProject)
        .where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
        .with_for_update()
    )
    project = project_res.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    # 2. Check for active pending generation; recover stale/abandoned ones
    active_gen_res = await db.execute(
        select(GiftRecommendationGeneration).where(
            GiftRecommendationGeneration.gift_project_id == project_id,
            GiftRecommendationGeneration.status == RecommendationGenerationStatus.pending,
        )
    )
    active_gen = active_gen_res.scalar_one_or_none()
    if active_gen is not None:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            active_gen.created_at
            if active_gen.created_at.tzinfo
            else active_gen.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            logger.warning(
                "Marking stale pending generation %s as failed (created %s)",
                active_gen.id,
                active_gen.created_at,
            )
            active_gen.status = RecommendationGenerationStatus.failed
            active_gen.error_message = "Generation timed out or was abandoned by client."
            await db.commit()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A recommendation generation is currently in progress for this gift project.",
            )

    # 3. Retrieve recipient details
    recipient_res = await db.execute(
        select(Recipient).where(
            Recipient.id == project.recipient_id,
            Recipient.user_id == current_user.id,
        )
    )
    recipient = recipient_res.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient associated with this gift project was not found.",
        )

    # 4. Prepare AI provider and prompt input
    ai_provider = get_ai_provider(settings)
    prompt_input = RecommendationPromptInput(
        recipient_name=recipient.name,
        relationship=recipient.relationship_type,
        interests=recipient.interests or [],
        notes=recipient.notes,
        occasion=project.occasion,
        occasion_date=project.occasion_date,
        budget_min=project.budget_min,
        budget_max=project.budget_max,
        currency=project.currency,
    )

    # 5. Atomically claim generation slot using PostgreSQL-enforced partial unique index
    generation = GiftRecommendationGeneration(
        gift_project_id=project.id,
        user_id=current_user.id,
        provider=ai_provider.provider_name,
        model=ai_provider.model_name,
        prompt_version=PROMPT_VERSION,
        status=RecommendationGenerationStatus.pending,
    )
    db.add(generation)
    try:
        await db.commit()
        await db.refresh(generation)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A recommendation generation is currently in progress for this gift project.",
        ) from None

    # 6. If background execution is enabled (production default):
    if background:
        session_factory = getattr(request.app.state, "session_factory", None)
        if session_factory is None:
            logger.error(
                "Background recommendation worker dispatch failed: session_factory is not configured on app state (project_id=%s, gen_id=%s)",
                project.id,
                generation.id,
            )
            generation.status = RecommendationGenerationStatus.failed
            generation.error_message = (
                "Background worker dispatch failed due to server configuration. Please try again."
            )
            generation.updated_at = datetime.now(UTC)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to schedule background recommendation generation. Please try again.",
            )

        worker_coro = _execute_generation_worker(
            generation_id=generation.id,
            project_id=project.id,
            user_id=current_user.id,
            prompt_input=prompt_input,
            budget_min=project.budget_min,
            budget_max=project.budget_max,
            currency=project.currency,
            settings=settings,
            session_factory=session_factory,
        )
        try:
            task_manager.spawn(
                worker_coro,
                name=f"rec-gen-{generation.id}",
            )
        except Exception as spawn_exc:
            try:
                worker_coro.close()
            except Exception:
                pass
            logger.error(
                "Failed to spawn background recommendation generation task (project_id=%s, gen_id=%s): %s",
                project.id,
                generation.id,
                type(spawn_exc).__name__,
            )
            generation.status = RecommendationGenerationStatus.failed
            generation.error_message = "Background worker dispatch failed. Please try again."
            generation.updated_at = datetime.now(UTC)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to schedule background recommendation generation. Please try again.",
            ) from None

        return GiftRecommendationGenerationRead(
            id=generation.id,
            gift_project_id=generation.gift_project_id,
            user_id=generation.user_id,
            provider=generation.provider,
            model=generation.model,
            prompt_version=generation.prompt_version,
            status=generation.status.value,
            error_message=None,
            created_at=generation.created_at,
            recommendations=[],
        )

    # 7. Synchronous fallback execution (for testing and direct CLI integrations)
    try:
        raw_output = await ai_provider.generate_gift_recommendations(prompt_input)
    except AIModelNotFoundError as err:
        logger.warning("AI model not found: %s", err.model_name)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = (
            f"The configured AI model '{err.model_name}' was not found on the inference host."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=generation.error_message,
        ) from None
    except AIAuthenticationError as err:
        logger.error("AI authentication failure: %s", err.message)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = (
            "The AI inference service authentication failed. Please verify API key configuration."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI inference service is currently misconfigured. Please contact support.",
        ) from None
    except AIRateLimitError as err:
        logger.warning("AI rate limit hit: %s", err.message)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = "The AI service rate limit was exceeded."
        await db.commit()
        headers = {}
        if err.retry_after is not None:
            headers["Retry-After"] = str(int(err.retry_after))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI recommendation service is currently busy. Please wait a moment and try again.",
            headers=headers if headers else None,
        ) from None
    except AIInferenceTimeoutError as err:
        logger.warning("AI inference timeout: %s", err.message)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = "The AI inference request timed out."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI inference request timed out. Please try again.",
        ) from None
    except AIProviderUnavailableError as err:
        logger.warning("AI provider unavailable: %s", err.message)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = "The AI inference service is temporarily unavailable."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI inference service is temporarily unavailable. Please try again shortly.",
        ) from None
    except (AIResponseValidationError, AIProviderError) as err:
        logger.warning("AI validation/provider failure: %s", type(err).__name__)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = (
            "The AI service returned an invalid or malformed recommendation output."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service returned an invalid or malformed output. Please try again.",
        ) from None
    except Exception as err:
        logger.error("Unexpected error during AI generation: %s", type(err).__name__)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = (
            "An unexpected error occurred while communicating with the AI service."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating gift recommendations. Please try again.",
        ) from None

    # Validate budget bounds on generated recommendations
    for idea in raw_output.recommendations:
        if idea.estimated_budget < project.budget_min or idea.estimated_budget > project.budget_max:
            logger.warning(
                "Recommendation '%s' budget %.2f violates project budget [%.2f, %.2f]",
                idea.title,
                idea.estimated_budget,
                project.budget_min,
                project.budget_max,
            )
            generation.status = RecommendationGenerationStatus.failed
            generation.error_message = (
                f"Generated gift idea '{idea.title}' budget (${idea.estimated_budget}) "
                f"exceeds project boundaries [${project.budget_min}, ${project.budget_max}]."
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI model generated an idea outside the specified budget constraints. Please retry.",
            )

    # Persist exactly 3 recommendations atomically
    db_recommendations = [
        GiftRecommendation(
            generation_id=generation.id,
            gift_project_id=project.id,
            title=idea.title,
            description=idea.description,
            category=idea.category,
            personalization_reason=idea.personalization_reason,
            estimated_budget=idea.estimated_budget,
            currency=project.currency,
            presentation_idea=idea.presentation_idea,
        )
        for idea in raw_output.recommendations
    ]
    for r in db_recommendations:
        db.add(r)

    generation.status = RecommendationGenerationStatus.succeeded
    await db.commit()
    await db.refresh(generation)

    read_items = [GiftRecommendationRead.model_validate(r) for r in db_recommendations]
    return GiftRecommendationGenerationRead(
        id=generation.id,
        gift_project_id=generation.gift_project_id,
        user_id=generation.user_id,
        provider=generation.provider,
        model=generation.model,
        prompt_version=generation.prompt_version,
        status=generation.status.value,
        error_message=generation.error_message,
        created_at=generation.created_at,
        recommendations=read_items,
    )


@router.get(
    "",
    response_model=GiftRecommendationGenerationRead,
    summary="Get the latest recommendations for a gift project",
)
async def get_latest_recommendations(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> GiftRecommendationGenerationRead:
    """Retrieve the latest recommendation batch for an owned gift project."""
    # 1. Enforce project ownership
    project_res = await db.execute(
        select(GiftProject).where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
    )
    project = project_res.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    # 2. Find latest generation
    gen_res = await db.execute(
        select(GiftRecommendationGeneration)
        .where(GiftRecommendationGeneration.gift_project_id == project_id)
        .order_by(GiftRecommendationGeneration.created_at.desc())
        .limit(1)
    )
    generation = gen_res.scalar_one_or_none()
    if generation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recommendations have been generated for this gift project yet.",
        )

    # Check for stale pending generation
    if generation.status == RecommendationGenerationStatus.pending:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            generation.created_at
            if generation.created_at.tzinfo
            else generation.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            generation.status = RecommendationGenerationStatus.failed
            generation.error_message = "Generation timed out. Please retry."
            generation.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(generation)

    # 3. Retrieve recommendations if succeeded
    recs = []
    if generation.status == RecommendationGenerationStatus.succeeded:
        recs_res = await db.execute(
            select(GiftRecommendation)
            .where(GiftRecommendation.generation_id == generation.id)
            .order_by(GiftRecommendation.created_at.asc(), GiftRecommendation.id.asc())
        )
        recs = recs_res.scalars().all()

    return GiftRecommendationGenerationRead(
        id=generation.id,
        gift_project_id=generation.gift_project_id,
        user_id=generation.user_id,
        provider=generation.provider,
        model=generation.model,
        prompt_version=generation.prompt_version,
        status=generation.status.value,
        error_message=generation.error_message,
        created_at=generation.created_at,
        recommendations=[GiftRecommendationRead.model_validate(r) for r in recs],
    )


@router.get(
    "/{generation_id}",
    response_model=GiftRecommendationGenerationRead,
    summary="Get status and recommendations for a specific generation batch",
)
async def get_generation_status(
    project_id: uuid.UUID,
    generation_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> GiftRecommendationGenerationRead:
    """Retrieve status and recommendations for a specific generation batch."""
    # 1. Enforce project ownership
    project_res = await db.execute(
        select(GiftProject).where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
    )
    if project_res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    # 2. Retrieve generation
    gen_res = await db.execute(
        select(GiftRecommendationGeneration).where(
            GiftRecommendationGeneration.id == generation_id,
            GiftRecommendationGeneration.gift_project_id == project_id,
            GiftRecommendationGeneration.user_id == current_user.id,
        )
    )
    generation = gen_res.scalar_one_or_none()
    if generation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation generation batch not found.",
        )

    # Stale recovery if pending
    if generation.status == RecommendationGenerationStatus.pending:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            generation.created_at
            if generation.created_at.tzinfo
            else generation.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            generation.status = RecommendationGenerationStatus.failed
            generation.error_message = "Generation timed out. Please retry."
            generation.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(generation)

    recs = []
    if generation.status == RecommendationGenerationStatus.succeeded:
        recs_res = await db.execute(
            select(GiftRecommendation)
            .where(GiftRecommendation.generation_id == generation.id)
            .order_by(GiftRecommendation.created_at.asc(), GiftRecommendation.id.asc())
        )
        recs = recs_res.scalars().all()

    return GiftRecommendationGenerationRead(
        id=generation.id,
        gift_project_id=generation.gift_project_id,
        user_id=generation.user_id,
        provider=generation.provider,
        model=generation.model,
        prompt_version=generation.prompt_version,
        status=generation.status.value,
        error_message=generation.error_message,
        created_at=generation.created_at,
        recommendations=[GiftRecommendationRead.model_validate(r) for r in recs],
    )
