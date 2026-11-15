"""Notifications API Router."""

from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.action import Notification
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.models import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)

logger = get_logger("api.notifications")
router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    is_read: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> NotificationListResponse:
    """List in-app notifications for the authenticated user and active workspace."""
    query = select(Notification).where(
        Notification.workspace_id == workspace.id,
        Notification.user_id == user.id,
    )
    count_query = select(func.count(Notification.id)).where(
        Notification.workspace_id == workspace.id,
        Notification.user_id == user.id,
    )
    unread_query = select(func.count(Notification.id)).where(
        Notification.workspace_id == workspace.id,
        Notification.user_id == user.id,
        Notification.is_read.is_(False),
    )

    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
        count_query = count_query.where(Notification.is_read == is_read)

    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)

    total = (await db.execute(count_query)).scalar() or 0
    unread_count = (await db.execute(unread_query)).scalar() or 0
    notifications = (await db.execute(query)).scalars().all()

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UnreadCountResponse:
    """Get the unread notification count for the badge indicator."""
    unread_query = select(func.count(Notification.id)).where(
        Notification.workspace_id == workspace.id,
        Notification.user_id == user.id,
        Notification.is_read.is_(False),
    )
    unread_count = (await db.execute(unread_query)).scalar() or 0
    return UnreadCountResponse(unread_count=unread_count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> NotificationResponse:
    """Mark a notification as read."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.workspace_id == workspace.id,
        Notification.user_id == user.id,
    )
    notification = (await db.execute(stmt)).scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notification)

    return NotificationResponse.model_validate(notification)


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_read(
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mark all notifications for this user in the active workspace as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.workspace_id == workspace.id,
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
        )
        .values(
            is_read=True,
            read_at=datetime.now(timezone.utc),
        )
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"marked_read_count": result.rowcount}
