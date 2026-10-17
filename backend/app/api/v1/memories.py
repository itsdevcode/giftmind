import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.gift_project import GiftProject
from app.models.story import MemoryAnswer
from app.models.user import User
from app.schemas.story import (
    GUIDED_MEMORY_PROMPTS,
    MemoryAnswerRead,
    MemoryAnswersListResponse,
    MemoryAnswersUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gift-projects/{project_id}/memories",
    tags=["Memory Interview"],
)


def _check_sufficient_input(answers: list[MemoryAnswer]) -> tuple[bool, str]:
    """Evaluate whether the user has provided enough meaningful memory substance for AI story generation."""
    # Count answers that have substantive text (e.g. >= 20 characters and >= 4 words)
    substantive_answers = [
        a for a in answers if len(a.answer.strip()) >= 20 and len(a.answer.strip().split()) >= 4
    ]

    total_words = sum(len(a.answer.strip().split()) for a in answers)

    # Require at least 2 substantive answers and at least 30 total words
    if len(substantive_answers) >= 2 and total_words >= 30:
        return (
            True,
            "Great job! You've provided enough heartwarming memories to craft a rich, personalized story.",
        )

    if len(answers) == 0:
        return (
            False,
            "No memories shared yet. Answer at least two questions with heartfelt details to unlock AI story generation.",
        )

    return (
        False,
        "Please provide a little more detail across at least two questions (at least 30 total words) so Gemma 4 can write an authentic, grounded story.",
    )


@router.get(
    "",
    response_model=MemoryAnswersListResponse,
    summary="Get guided memory interview answers for a gift project",
)
async def get_memories(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MemoryAnswersListResponse:
    """Retrieve all guided memory answers for a gift project owned by the current user."""
    # Verify project exists and belongs to authenticated user
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

    # Fetch answers sorted by created_at
    answers_res = await db.execute(
        select(MemoryAnswer)
        .where(
            MemoryAnswer.gift_project_id == project_id,
            MemoryAnswer.user_id == current_user.id,
        )
        .order_by(MemoryAnswer.created_at.asc())
    )
    answers = list(answers_res.scalars().all())

    sufficient, guidance = _check_sufficient_input(answers)

    response_items = []
    for a in answers:
        item = MemoryAnswerRead.model_validate(a)
        item.question_prompt = GUIDED_MEMORY_PROMPTS.get(a.question_key, "")
        response_items.append(item)

    return MemoryAnswersListResponse(
        gift_project_id=project_id,
        answers=response_items,
        has_sufficient_input=sufficient,
        guidance_message=guidance,
    )


@router.put(
    "",
    response_model=MemoryAnswersListResponse,
    summary="Atomically upsert guided memory interview answers for a gift project",
)
async def update_memories(
    project_id: uuid.UUID,
    payload: MemoryAnswersUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MemoryAnswersListResponse:
    """Atomically upsert memory answers for a gift project owned by the user.

    Idempotent: updates existing keys or inserts new ones.
    Sensitive memory contents are NEVER logged.
    """
    # Enforce gift project ownership with row lock to avoid race conditions
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

    # Fetch existing answers for this project
    existing_res = await db.execute(
        select(MemoryAnswer).where(
            MemoryAnswer.gift_project_id == project_id,
            MemoryAnswer.user_id == current_user.id,
        )
    )
    existing_by_key: dict[str, MemoryAnswer] = {
        ans.question_key: ans for ans in existing_res.scalars().all()
    }

    # Atomic upsert or deletion for empty answers
    now = datetime.now(UTC)
    for item in payload.answers:
        trimmed_ans = item.answer.strip()
        if not trimmed_ans:
            # Explicit clearing / deletion semantics: blank answer deletes previously saved memory
            if item.question_key in existing_by_key:
                record_to_delete = existing_by_key.pop(item.question_key)
                await db.delete(record_to_delete)
        elif item.question_key in existing_by_key:
            record = existing_by_key[item.question_key]
            record.answer = trimmed_ans
            record.updated_at = now
        else:
            new_record = MemoryAnswer(
                gift_project_id=project_id,
                user_id=current_user.id,
                question_key=item.question_key,
                answer=trimmed_ans,
                created_at=now,
                updated_at=now,
            )
            db.add(new_record)
            existing_by_key[item.question_key] = new_record

    await db.commit()

    # Log safe metadata only (NEVER memory text)
    logger.info(
        "Updated memories for gift project %s (user %s, keys: %s)",
        project_id,
        current_user.id,
        [item.question_key for item in payload.answers],
    )

    # Return refreshed list
    all_answers = list(existing_by_key.values())
    sufficient, guidance = _check_sufficient_input(all_answers)

    response_items = []
    for a in all_answers:
        item = MemoryAnswerRead.model_validate(a)
        item.question_prompt = GUIDED_MEMORY_PROMPTS.get(a.question_key, "")
        response_items.append(item)

    return MemoryAnswersListResponse(
        gift_project_id=project_id,
        answers=response_items,
        has_sufficient_input=sufficient,
        guidance_message=guidance,
    )
