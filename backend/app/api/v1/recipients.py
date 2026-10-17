import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.recipient import Recipient
from app.models.user import User
from app.schemas.recipient import (
    RecipientCreate,
    RecipientListResponse,
    RecipientRead,
    RecipientUpdate,
)

router = APIRouter(prefix="/recipients", tags=["Recipients"])


@router.post(
    "",
    response_model=RecipientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new recipient",
)
async def create_recipient(
    payload: RecipientCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RecipientRead:
    """Create a new recipient record owned by current authenticated user."""
    recipient = Recipient(
        user_id=current_user.id,
        name=payload.name,
        relationship_type=payload.relationship,
        interests=payload.interests,
        notes=payload.notes,
    )
    db.add(recipient)
    await db.commit()
    await db.refresh(recipient)

    return RecipientRead(
        id=recipient.id,
        user_id=recipient.user_id,
        name=recipient.name,
        relationship=recipient.relationship_type,
        interests=recipient.interests,
        notes=recipient.notes,
        created_at=recipient.created_at,
        updated_at=recipient.updated_at,
    )


@router.get(
    "",
    response_model=RecipientListResponse,
    summary="List recipients owned by the current user with pagination",
)
async def list_recipients(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RecipientListResponse:
    """Return paginated list of recipients strictly belonging to current user."""
    # Count total items for this user
    count_query = (
        select(func.count()).select_from(Recipient).where(Recipient.user_id == current_user.id)
    )
    total_count = (await db.execute(count_query)).scalar() or 0

    # Deterministic order by created_at descending, then id
    items_query = (
        select(Recipient)
        .where(Recipient.user_id == current_user.id)
        .order_by(Recipient.created_at.desc(), Recipient.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(items_query)
    recipients = result.scalars().all()

    items = [
        RecipientRead(
            id=r.id,
            user_id=r.user_id,
            name=r.name,
            relationship=r.relationship_type,
            interests=r.interests,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in recipients
    ]

    return RecipientListResponse(
        items=items,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{recipient_id}",
    response_model=RecipientRead,
    summary="Get recipient by ID",
)
async def get_recipient(
    recipient_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RecipientRead:
    """Retrieve a single recipient strictly belonging to the current user."""
    result = await db.execute(
        select(Recipient).where(
            Recipient.id == recipient_id,
            Recipient.user_id == current_user.id,
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found.",
        )

    return RecipientRead(
        id=recipient.id,
        user_id=recipient.user_id,
        name=recipient.name,
        relationship=recipient.relationship_type,
        interests=recipient.interests,
        notes=recipient.notes,
        created_at=recipient.created_at,
        updated_at=recipient.updated_at,
    )


@router.put(
    "/{recipient_id}",
    response_model=RecipientRead,
    summary="Update a recipient",
)
async def update_recipient(
    recipient_id: uuid.UUID,
    payload: RecipientUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RecipientRead:
    """Update fields on a recipient strictly belonging to the current user."""
    result = await db.execute(
        select(Recipient).where(
            Recipient.id == recipient_id,
            Recipient.user_id == current_user.id,
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found.",
        )

    if payload.name is not None:
        recipient.name = payload.name
    if payload.relationship is not None:
        recipient.relationship_type = payload.relationship
    if payload.interests is not None:
        recipient.interests = payload.interests
    if payload.notes is not None:
        recipient.notes = payload.notes

    await db.commit()
    await db.refresh(recipient)

    return RecipientRead(
        id=recipient.id,
        user_id=recipient.user_id,
        name=recipient.name,
        relationship=recipient.relationship_type,
        interests=recipient.interests,
        notes=recipient.notes,
        created_at=recipient.created_at,
        updated_at=recipient.updated_at,
    )


@router.delete(
    "/{recipient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a recipient",
)
async def delete_recipient(
    recipient_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a recipient strictly belonging to the current user."""
    result = await db.execute(
        select(Recipient).where(
            Recipient.id == recipient_id,
            Recipient.user_id == current_user.id,
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found.",
        )

    await db.delete(recipient)
    await db.commit()
