import logging
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_settings, get_current_user
from app.api.v1.memories import _check_sufficient_input
from app.core.config import Settings
from app.core.tasks import task_manager
from app.db.session import get_db
from app.models.gift_project import GiftProject
from app.models.recipient import Recipient
from app.models.story import MemoryAnswer, StoryKeepsake, StoryKeepsakeStatus
from app.models.user import User
from app.schemas.story import (
    StoryKeepsakeRead,
    StoryKeepsakeUpdateRequest,
    StoryPromptInput,
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
from app.services.ai.story_prompts import STORY_PROMPT_VERSION
from app.services.pdf.keepsake import generate_story_keepsake_pdf

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gift-projects/{project_id}/story",
    tags=["Story Keepsake"],
)


async def _execute_story_worker(
    story_id: uuid.UUID,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    prompt_input: StoryPromptInput,
    settings: Settings,
    session_factory,
) -> None:
    """Asynchronous background worker task that generates AI story keepsake and persists results."""
    ai_provider = get_ai_provider(settings)
    start_time = time.monotonic()
    logger.info(
        "Starting background story keepsake generation (story_id=%s, project_id=%s, user_id=%s, provider=%s, model=%s)",
        story_id,
        project_id,
        user_id,
        ai_provider.provider_name,
        ai_provider.model_name,
    )
    try:
        raw_story = await ai_provider.generate_story_keepsake(prompt_input)

        async with session_factory() as session:
            story = await session.get(StoryKeepsake, story_id)
            if not story or story.status != StoryKeepsakeStatus.pending:
                logger.warning(
                    "Story %s is no longer pending; aborting background write.", story_id
                )
                return

            story.title = raw_story.title
            story.dedication = raw_story.dedication
            story.story_body = raw_story.story_body
            story.closing_message = raw_story.closing_message
            story.status = StoryKeepsakeStatus.succeeded
            story.error_message = None
            story.updated_at = datetime.now(UTC)
            await session.commit()
            elapsed = time.monotonic() - start_time
            logger.info(
                "Background story generation succeeded (story_id=%s, project_id=%s, elapsed=%.2fs)",
                story_id,
                project_id,
                elapsed,
            )

    except Exception as exc:
        elapsed = time.monotonic() - start_time
        category = type(exc).__name__
        if isinstance(exc, AIModelNotFoundError):
            error_message = (
                f"The configured AI model '{exc.model_name}' was not found on the inference host."
            )
        elif isinstance(exc, AIAuthenticationError):
            error_message = "The AI inference service authentication failed. Please verify API key configuration."
        elif isinstance(exc, AIRateLimitError):
            error_message = "The AI service is currently busy. Please wait a moment and try again."
        elif isinstance(exc, AIInferenceTimeoutError):
            error_message = "The AI story inference request timed out. Please try again."
        elif isinstance(exc, AIProviderUnavailableError):
            error_message = (
                "The AI inference service is temporarily unavailable. Please try again shortly."
            )
        elif isinstance(exc, (AIResponseValidationError, AIProviderError)):
            error_message = (
                "The AI model failed to produce a valid story keepsake. Please try again."
            )
        else:
            error_message = (
                "An unexpected error occurred during story generation. Please try again."
            )

        logger.error(
            "Background story generation failed (story_id=%s, project_id=%s, provider=%s, elapsed=%.2fs, category=%s, err=%s)",
            story_id,
            project_id,
            ai_provider.provider_name,
            elapsed,
            category,
            error_message,
        )
        try:
            async with session_factory() as session:
                story = await session.get(StoryKeepsake, story_id)
                if story and story.status == StoryKeepsakeStatus.pending:
                    story.status = StoryKeepsakeStatus.failed
                    story.error_message = error_message
                    story.updated_at = datetime.now(UTC)
                    await session.commit()
        except Exception as db_err:
            logger.critical("Failed to update story %s status to failed: %s", story_id, db_err)


@router.post(
    "/generate",
    response_model=StoryKeepsakeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized AI story keepsake using Gemma 4",
)
async def generate_story(
    project_id: uuid.UUID,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
    background: Annotated[
        bool, Query(description="Run generation asynchronously in the background")
    ] = False,
) -> StoryKeepsakeRead:
    """Generate a heartwarming biographical story keepsake from submitted memory answers."""
    # 1. Enforce ownership and lock the project row
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

    # 2. Check for active pending story generation; recover stale (> full retry budget)
    active_res = await db.execute(
        select(StoryKeepsake).where(
            StoryKeepsake.gift_project_id == project_id,
            StoryKeepsake.status == StoryKeepsakeStatus.pending,
        )
    )
    active_story = active_res.scalar_one_or_none()
    if active_story is not None:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            active_story.created_at
            if active_story.created_at.tzinfo
            else active_story.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            logger.warning(
                "Marking stale pending story keepsake %s as failed (created %s)",
                active_story.id,
                active_story.created_at,
            )
            active_story.status = StoryKeepsakeStatus.failed
            active_story.error_message = "Story generation timed out or was abandoned by client."
            active_story.updated_at = datetime.now(UTC)
            await db.commit()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A story generation is currently in progress for this gift project.",
            )

    # 3. Retrieve memories and validate sufficient input
    memories_res = await db.execute(
        select(MemoryAnswer).where(
            MemoryAnswer.gift_project_id == project_id,
            MemoryAnswer.user_id == current_user.id,
        )
    )
    memories = list(memories_res.scalars().all())
    sufficient, guidance = _check_sufficient_input(memories)
    if not sufficient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=guidance,
        )

    # 4. Retrieve recipient details
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

    # 5. Build prompt input
    ai_provider = get_ai_provider(settings)
    memory_dict = {m.question_key: m.answer for m in memories if m.answer.strip()}
    prompt_input = StoryPromptInput(
        recipient_name=recipient.name,
        relationship=recipient.relationship_type,
        occasion=project.occasion,
        memories=memory_dict,
    )

    # 6. Atomically claim generation slot using PostgreSQL-enforced partial unique index
    story_record = StoryKeepsake(
        gift_project_id=project.id,
        user_id=current_user.id,
        title=f"A Story for {recipient.name}",
        dedication="",
        story_body="",
        closing_message="",
        model_name=ai_provider.model_name,
        prompt_version=STORY_PROMPT_VERSION,
        status=StoryKeepsakeStatus.pending,
    )
    db.add(story_record)

    try:
        # Commit immediately so pending claim is active and row locks are released
        # before slow LLM inference begins
        await db.commit()
        await db.refresh(story_record)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A story generation is currently in progress for this gift project.",
        ) from None

    # 7. If background execution is enabled (production default):
    if background:
        session_factory = getattr(request.app.state, "session_factory", None)
        if session_factory is not None:
            task_manager.spawn(
                _execute_story_worker(
                    story_id=story_record.id,
                    project_id=project.id,
                    user_id=current_user.id,
                    prompt_input=prompt_input,
                    settings=settings,
                    session_factory=session_factory,
                ),
                name=f"story-gen-{story_record.id}",
            )
        return StoryKeepsakeRead.model_validate(story_record)

    # 8. Synchronous fallback execution (for testing and direct CLI integrations)
    try:
        raw_story = await ai_provider.generate_story_keepsake(prompt_input)
    except AIModelNotFoundError as err:
        logger.warning("AI model not found: %s", err.model_name)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = (
            f"The configured AI model '{err.model_name}' was not found on the inference host."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=story_record.error_message,
        ) from None
    except AIAuthenticationError as err:
        logger.error("AI authentication failure: %s", err.message)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = (
            "The AI inference service authentication failed. Please verify API key configuration."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI inference service is currently misconfigured. Please contact support.",
        ) from None
    except AIRateLimitError as err:
        logger.warning("AI rate limit hit: %s", err.message)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = "The AI service rate limit was exceeded."
        await db.commit()
        headers = {}
        if err.retry_after is not None:
            headers["Retry-After"] = str(int(err.retry_after))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI service is currently busy. Please wait a moment and try again.",
            headers=headers if headers else None,
        ) from None
    except AIInferenceTimeoutError as err:
        logger.warning("AI story inference timeout: %s", err.message)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = "The AI story inference request timed out."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI story inference request timed out. Please try again.",
        ) from None
    except AIProviderUnavailableError as err:
        logger.warning("AI provider unavailable: %s", err.message)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = "The AI inference service is temporarily unavailable."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI inference service is temporarily unavailable. Please try again shortly.",
        ) from None
    except (AIResponseValidationError, AIProviderError) as err:
        logger.warning("AI story validation/provider failure: %s", type(err).__name__)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = "The AI model returned an invalid or incomplete story."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI model failed to produce a valid story keepsake. Please try again.",
        ) from None
    except Exception as exc:
        logger.error("Unexpected error during story generation: %s", type(exc).__name__)
        story_record.status = StoryKeepsakeStatus.failed
        story_record.error_message = "An unexpected error occurred during story generation."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Story generation encountered an unexpected error.",
        ) from None

    # 8. Success: Update story record
    story_record.title = raw_story.title
    story_record.dedication = raw_story.dedication
    story_record.story_body = raw_story.story_body
    story_record.closing_message = raw_story.closing_message
    story_record.status = StoryKeepsakeStatus.succeeded
    story_record.error_message = None
    story_record.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(story_record)

    logger.info(
        "Successfully generated story keepsake %s for project %s (user %s)",
        story_record.id,
        project_id,
        current_user.id,
    )
    return StoryKeepsakeRead.model_validate(story_record)


@router.get(
    "",
    response_model=StoryKeepsakeRead,
    summary="Get the latest active story keepsake for a gift project",
)
async def get_story(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> StoryKeepsakeRead:
    """Retrieve the latest story keepsake for an owned gift project."""
    # Enforce ownership
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

    story_res = await db.execute(
        select(StoryKeepsake)
        .where(
            StoryKeepsake.gift_project_id == project_id,
            StoryKeepsake.user_id == current_user.id,
        )
        .order_by(StoryKeepsake.created_at.desc())
        .limit(1)
    )
    story = story_res.scalar_one_or_none()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No story keepsake found for this gift project. Generate one from memories first.",
        )

    # Check for stale pending story
    if story.status == StoryKeepsakeStatus.pending:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            story.created_at if story.created_at.tzinfo else story.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            logger.warning(
                "Marking stale pending story keepsake %s as failed (created %s)",
                story.id,
                story.created_at,
            )
            story.status = StoryKeepsakeStatus.failed
            story.error_message = "Story generation timed out or was abandoned. Please retry."
            story.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(story)

    return StoryKeepsakeRead.model_validate(story)


@router.patch(
    "",
    response_model=StoryKeepsakeRead,
    summary="Edit the story keepsake content",
)
async def update_story(
    project_id: uuid.UUID,
    payload: StoryKeepsakeUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StoryKeepsakeRead:
    """Update title, dedication, story body, and closing message of the current story."""
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

    story_res = await db.execute(
        select(StoryKeepsake)
        .where(
            StoryKeepsake.gift_project_id == project_id,
            StoryKeepsake.user_id == current_user.id,
            StoryKeepsake.status == StoryKeepsakeStatus.succeeded,
        )
        .order_by(StoryKeepsake.created_at.desc())
        .with_for_update()
    )
    story = story_res.scalars().first()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active story keepsake found to edit.",
        )

    # Apply edits
    story.title = payload.title.strip()
    story.dedication = payload.dedication.strip()
    story.story_body = payload.story_body.strip()
    story.closing_message = payload.closing_message.strip()
    story.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(story)

    logger.info("Updated story keepsake %s for project %s", story.id, project_id)
    return StoryKeepsakeRead.model_validate(story)


@router.get(
    "/pdf",
    summary="Download the story keepsake as a publication-ready PDF",
)
async def download_story_pdf(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Render and download the currently saved story keepsake as an elegant PDF.

    Never triggers new inference; renders the saved story version.
    """
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

    story_res = await db.execute(
        select(StoryKeepsake)
        .where(
            StoryKeepsake.gift_project_id == project_id,
            StoryKeepsake.user_id == current_user.id,
            StoryKeepsake.status == StoryKeepsakeStatus.succeeded,
        )
        .order_by(StoryKeepsake.created_at.desc())
    )
    story = story_res.scalars().first()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No saved story keepsake found for this gift project.",
        )

    # Get recipient name
    recipient_res = await db.execute(select(Recipient).where(Recipient.id == project.recipient_id))
    recipient = recipient_res.scalar_one_or_none()
    recipient_name = recipient.name if recipient else "Special Friend"

    # Generate PDF in-memory
    pdf_bytes = generate_story_keepsake_pdf(
        story=story,
        recipient_name=recipient_name,
        occasion=project.occasion,
    )

    # Safe filename formatting
    safe_name = "".join(c for c in recipient_name if c.isalnum() or c in (" ", "_", "-")).strip()
    safe_name = safe_name.replace(" ", "_") or "Keepsake"
    filename = f"GiftMind_Keepsake_{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get(
    "/{story_id}",
    response_model=StoryKeepsakeRead,
    summary="Get status and content for a specific story keepsake",
)
async def get_story_status(
    project_id: uuid.UUID,
    story_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> StoryKeepsakeRead:
    """Retrieve status and content for a specific story keepsake, enforcing project ownership."""
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

    # 2. Retrieve story
    story_res = await db.execute(
        select(StoryKeepsake).where(
            StoryKeepsake.id == story_id,
            StoryKeepsake.gift_project_id == project_id,
            StoryKeepsake.user_id == current_user.id,
        )
    )
    story = story_res.scalar_one_or_none()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story keepsake not found.",
        )

    # 3. Check for stale pending story
    if story.status == StoryKeepsakeStatus.pending:
        stale_threshold = datetime.now(UTC) - timedelta(
            seconds=settings.full_inference_retry_budget_seconds
        )
        created_at = (
            story.created_at if story.created_at.tzinfo else story.created_at.replace(tzinfo=UTC)
        )
        if created_at < stale_threshold:
            logger.warning(
                "Marking stale pending story keepsake %s as failed on status check (created %s)",
                story.id,
                story.created_at,
            )
            story.status = StoryKeepsakeStatus.failed
            story.error_message = "Story generation timed out or was abandoned. Please retry."
            story.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(story)

    return StoryKeepsakeRead.model_validate(story)
