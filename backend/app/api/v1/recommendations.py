import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_settings, get_current_user
from app.core.config import Settings
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
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderError,
    AIProviderUnavailableError,
    AIResponseValidationError,
)
from app.services.ai.factory import get_ai_provider
from app.services.ai.prompts import PROMPT_VERSION, RecommendationPromptInput

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gift-projects/{project_id}/recommendations", tags=["Gift Recommendations"]
)


@router.post(
    "/generate",
    response_model=GiftRecommendationGenerationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized AI gift recommendations for a gift project",
)
async def generate_recommendations(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_current_settings)],
) -> GiftRecommendationGenerationRead:
    """Generate exactly 3 personalized, budget-aware gift recommendations using AI for an owned project."""
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

    # 2. Check for active pending generation to prevent concurrent duplicates
    active_gen_res = await db.execute(
        select(GiftRecommendationGeneration).where(
            GiftRecommendationGeneration.gift_project_id == project_id,
            GiftRecommendationGeneration.status == RecommendationGenerationStatus.pending,
        )
    )
    if active_gen_res.scalar_one_or_none() is not None:
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

    # 5. Create pending generation record
    generation = GiftRecommendationGeneration(
        gift_project_id=project.id,
        user_id=current_user.id,
        provider=ai_provider.provider_name,
        model=ai_provider.model_name,
        prompt_version=PROMPT_VERSION,
        status=RecommendationGenerationStatus.pending,
    )
    db.add(generation)
    await db.commit()
    await db.refresh(generation)

    # 6. Execute inference and handle failures safely without partial recommendation writes
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
    except (AIProviderUnavailableError, AIInferenceTimeoutError) as err:
        logger.warning("AI provider unavailable/timeout: %s", type(err).__name__)
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = err.message
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=err.message,
        ) from None
    except (AIResponseValidationError, AIProviderError) as err:
        logger.warning("AI validation/provider failure: %s", str(err))
        generation.status = RecommendationGenerationStatus.failed
        generation.error_message = err.message
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=err.message,
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

    # 7. Persist exactly 3 recommendations atomically
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

    # 8. Build and return structured response
    read_items = [GiftRecommendationRead.model_validate(r) for r in db_recommendations]
    gen_read = GiftRecommendationGenerationRead(
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
    return gen_read


@router.get(
    "",
    response_model=GiftRecommendationGenerationRead,
    summary="Get the latest recommendations for a gift project",
)
async def get_latest_recommendations(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GiftRecommendationGenerationRead:
    """Retrieve the latest successful recommendation batch for an owned gift project."""
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

    # 2. Find latest successful generation
    gen_res = await db.execute(
        select(GiftRecommendationGeneration)
        .where(
            GiftRecommendationGeneration.gift_project_id == project_id,
            GiftRecommendationGeneration.status == RecommendationGenerationStatus.succeeded,
        )
        .order_by(GiftRecommendationGeneration.created_at.desc())
        .limit(1)
    )
    generation = gen_res.scalar_one_or_none()
    if generation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recommendations have been generated for this gift project yet.",
        )

    # 3. Retrieve recommendations for this generation
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
