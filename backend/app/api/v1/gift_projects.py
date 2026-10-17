import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.gift_project import GiftProject
from app.models.recipient import Recipient
from app.models.user import User
from app.schemas.gift_project import (
    GiftProjectCreate,
    GiftProjectListResponse,
    GiftProjectRead,
    GiftProjectUpdate,
)

router = APIRouter(prefix="/gift-projects", tags=["Gift Projects"])


@router.post(
    "",
    response_model=GiftProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new gift project",
)
async def create_gift_project(
    payload: GiftProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GiftProjectRead:
    """Create a gift project belonging to current user for a recipient also owned by current user."""
    # Verify recipient exists and belongs to current user
    recipient_res = await db.execute(
        select(Recipient).where(
            Recipient.id == payload.recipient_id,
            Recipient.user_id == current_user.id,
        )
    )
    recipient = recipient_res.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found.",
        )

    project = GiftProject(
        user_id=current_user.id,
        recipient_id=payload.recipient_id,
        title=payload.title,
        occasion=payload.occasion,
        occasion_date=payload.occasion_date,
        budget_min=payload.budget_min,
        budget_max=payload.budget_max,
        currency=payload.currency,
        status=payload.status,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return GiftProjectRead.model_validate(project)


@router.get(
    "",
    response_model=GiftProjectListResponse,
    summary="List gift projects owned by the current user with pagination",
)
async def list_gift_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GiftProjectListResponse:
    """Return paginated list of gift projects strictly belonging to current user."""
    count_query = (
        select(func.count()).select_from(GiftProject).where(GiftProject.user_id == current_user.id)
    )
    total_count = (await db.execute(count_query)).scalar() or 0

    items_query = (
        select(GiftProject)
        .where(GiftProject.user_id == current_user.id)
        .order_by(GiftProject.created_at.desc(), GiftProject.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(items_query)
    projects = result.scalars().all()

    items = [GiftProjectRead.model_validate(p) for p in projects]

    return GiftProjectListResponse(
        items=items,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{project_id}",
    response_model=GiftProjectRead,
    summary="Get gift project by ID",
)
async def get_gift_project(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GiftProjectRead:
    """Retrieve a single gift project strictly belonging to the current user."""
    result = await db.execute(
        select(GiftProject).where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    return GiftProjectRead.model_validate(project)


@router.put(
    "/{project_id}",
    response_model=GiftProjectRead,
    summary="Update a gift project",
)
async def update_gift_project(
    project_id: uuid.UUID,
    payload: GiftProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GiftProjectRead:
    """Update fields on a gift project strictly belonging to the current user."""
    result = await db.execute(
        select(GiftProject).where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    # If recipient_id is changed, ensure the new recipient is owned by the current user
    if payload.recipient_id is not None and payload.recipient_id != project.recipient_id:
        recipient_res = await db.execute(
            select(Recipient).where(
                Recipient.id == payload.recipient_id,
                Recipient.user_id == current_user.id,
            )
        )
        if recipient_res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recipient not found.",
            )
        project.recipient_id = payload.recipient_id

    # Check budget constraints with existing values if only one is updated
    effective_min = payload.budget_min if payload.budget_min is not None else project.budget_min
    effective_max = payload.budget_max if payload.budget_max is not None else project.budget_max
    if effective_max < effective_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="budget_max must be greater than or equal to budget_min",
        )

    if payload.title is not None:
        project.title = payload.title
    if payload.occasion is not None:
        project.occasion = payload.occasion
    if payload.occasion_date is not None:
        project.occasion_date = payload.occasion_date
    if payload.budget_min is not None:
        project.budget_min = payload.budget_min
    if payload.budget_max is not None:
        project.budget_max = payload.budget_max
    if payload.currency is not None:
        project.currency = payload.currency
    if payload.status is not None:
        project.status = payload.status

    await db.commit()
    await db.refresh(project)

    return GiftProjectRead.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a gift project",
)
async def delete_gift_project(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a gift project strictly belonging to the current user."""
    result = await db.execute(
        select(GiftProject).where(
            GiftProject.id == project_id,
            GiftProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift project not found.",
        )

    await db.delete(project)
    await db.commit()
