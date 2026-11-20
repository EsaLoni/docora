"""Admin API Endpoints.

Protected endpoints for the platform owner to view registered users,
login activity, and platform-wide statistics.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.document import Document
from app.models.notebook import Notebook, StudioArtifact
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

logger = get_logger("admin")

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────────────────
# Response Schemas
# ─────────────────────────────────────────────────────────────────────────

class UserActivityItem(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    login_count: int = 0
    last_login_at: Optional[str] = None
    registered_at: str
    workspace_count: int = 0


class UsersListResponse(BaseModel):
    total_users: int
    users: List[UserActivityItem]


class PlatformStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_logins: int
    total_workspaces: int
    total_notebooks: int
    total_documents: int
    total_artifacts: int
    recent_registrations: List[UserActivityItem]
    recent_logins: List[UserActivityItem]


# ─────────────────────────────────────────────────────────────────────────
# Admin Guard — Only your account (owner) can access
# ─────────────────────────────────────────────────────────────────────────

ADMIN_EMAILS = {"esaloni313@gmail.com", "dev@udip.local"}


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the requesting user is the platform owner."""
    if current_user.email.lower() not in ADMIN_EMAILS:
        logger.warning("Admin access denied for non-owner user %s (%s)", current_user.email, current_user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Platform Owner Only.",
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=UsersListResponse)
async def list_all_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    sort_by: str = Query("last_login", enum=["last_login", "registered", "login_count", "email"]),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> UsersListResponse:
    """List all registered users with their login activity."""

    # Total count
    count_result = await db.execute(select(func.count(User.id)))
    total = count_result.scalar() or 0

    # Sort order
    order_col = {
        "last_login": User.last_login_at.desc().nullslast(),
        "registered": User.created_at.desc(),
        "login_count": User.login_count.desc(),
        "email": User.email.asc(),
    }.get(sort_by, User.last_login_at.desc().nullslast())

    # Query users with workspace count
    stmt = (
        select(
            User,
            func.count(WorkspaceMember.id).label("ws_count"),
        )
        .outerjoin(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .group_by(User.id)
        .order_by(order_col)
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.all()

    users = [
        UserActivityItem(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            login_count=user.login_count or 0,
            last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
            registered_at=user.created_at.isoformat(),
            workspace_count=ws_count or 0,
        )
        for user, ws_count in rows
    ]

    return UsersListResponse(total_users=total, users=users)


@router.get("/stats", response_model=PlatformStatsResponse)
async def platform_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> PlatformStatsResponse:
    """Get platform-wide statistics at a glance."""

    # Counts
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0
    total_logins = (await db.execute(
        select(func.coalesce(func.sum(User.login_count), 0))
    )).scalar() or 0
    total_workspaces = (await db.execute(select(func.count(Workspace.id)))).scalar() or 0
    total_notebooks = (await db.execute(select(func.count(Notebook.id)))).scalar() or 0
    total_documents = (await db.execute(
        select(func.count(Document.id)).where(Document.is_deleted == False)
    )).scalar() or 0
    total_artifacts = (await db.execute(select(func.count(StudioArtifact.id)))).scalar() or 0

    # Recent 5 registrations
    recent_reg_stmt = (
        select(User)
        .order_by(User.created_at.desc())
        .limit(5)
    )
    recent_regs = (await db.execute(recent_reg_stmt)).scalars().all()

    # Recent 5 logins
    recent_login_stmt = (
        select(User)
        .where(User.last_login_at.is_not(None))
        .order_by(User.last_login_at.desc())
        .limit(5)
    )
    recent_logins = (await db.execute(recent_login_stmt)).scalars().all()

    def to_item(u: User) -> UserActivityItem:
        return UserActivityItem(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            login_count=u.login_count or 0,
            last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
            registered_at=u.created_at.isoformat(),
        )

    return PlatformStatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_logins=total_logins,
        total_workspaces=total_workspaces,
        total_notebooks=total_notebooks,
        total_documents=total_documents,
        total_artifacts=total_artifacts,
        recent_registrations=[to_item(u) for u in recent_regs],
        recent_logins=[to_item(u) for u in recent_logins],
    )
