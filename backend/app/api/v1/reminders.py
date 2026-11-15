"""Reminders API Router."""

from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.models import (
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    ReminderSnoozeRequest,
    ReminderUpdate,
)
from app.services.actions.reminders import ReminderService

logger = get_logger("api.reminders")
router = APIRouter(prefix="/reminders", tags=["reminders"])

reminder_service = ReminderService()


@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderResponse:
    """Create a new reminder schedule."""
    reminder = await reminder_service.create_reminder(
        db=db,
        workspace_id=workspace.id,
        user_id=user.id,
        data=data,
    )
    return ReminderResponse.model_validate(reminder)


@router.get("", response_model=ReminderListResponse)
async def list_reminders(
    status: Optional[str] = Query(None),
    upcoming_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderListResponse:
    """List reminders in active workspace."""
    reminders, total = await reminder_service.get_reminders(
        db=db,
        workspace_id=workspace.id,
        status=status,
        upcoming_only=upcoming_only,
        limit=limit,
        offset=offset,
    )
    return ReminderListResponse(
        items=[ReminderResponse.model_validate(r) for r in reminders],
        total=total,
    )


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderResponse:
    """Get single reminder by ID."""
    reminder = await reminder_service.get_reminder(
        db=db, reminder_id=reminder_id, workspace_id=workspace.id
    )
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ReminderResponse.model_validate(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderResponse:
    """Update reminder schedule or details."""
    reminder = await reminder_service.update_reminder(
        db=db, reminder_id=reminder_id, workspace_id=workspace.id, data=data
    )
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ReminderResponse.model_validate(reminder)


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: uuid.UUID,
    data: ReminderSnoozeRequest,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderResponse:
    """Snooze a reminder to a later date/time."""
    reminder = await reminder_service.snooze_reminder(
        db=db,
        reminder_id=reminder_id,
        workspace_id=workspace.id,
        snooze_until=data.snooze_until,
        snooze_minutes=data.snooze_minutes,
    )
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ReminderResponse.model_validate(reminder)


@router.post("/{reminder_id}/cancel", response_model=ReminderResponse)
async def cancel_reminder(
    reminder_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ReminderResponse:
    """Cancel a scheduled reminder."""
    reminder = await reminder_service.cancel_reminder(
        db=db, reminder_id=reminder_id, workspace_id=workspace.id
    )
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ReminderResponse.model_validate(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a reminder permanently."""
    success = await reminder_service.delete_reminder(
        db=db, reminder_id=reminder_id, workspace_id=workspace.id
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
