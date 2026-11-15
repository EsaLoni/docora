"""FastAPI Dependencies for Authentication & Multi-Tenant Authorization.

Provides get_current_user and get_active_workspace dependencies ensuring
strict tenant isolation across all endpoints.
"""

from typing import List, Optional
import uuid
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.exceptions import AuthenticationFailedError, ResourceNotFoundError, WorkspaceAccessDeniedError
from app.core.logging import get_logger
from app.core.security import TokenPayload, verify_jwt_token
from app.models.chat import Conversation
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

logger = get_logger("deps")

# Bearer token security scheme (auto_error=False to allow custom JSON 401 handling)
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_token_payload(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_dev_user_email: Optional[str] = Header(None, alias="x-dev-user-email"),
    settings: Settings = Depends(get_settings),
) -> TokenPayload:
    """Extract and verify JWT bearer token from Authorization header or secure HttpOnly cookie."""
    token_str = None
    if credentials and credentials.credentials:
        token_str = credentials.credentials
    elif request.cookies.get("access_token"):
        token_str = request.cookies.get("access_token")

    if token_str:
        return verify_jwt_token(token_str, settings)

    # Controlled local development authentication (offline / frontend dev mode)
    if settings.ALLOW_DEV_AUTH and settings.ENVIRONMENT != "production":
        target_email = x_dev_user_email or settings.DEV_USER_EMAIL
        if target_email:
            logger.debug("Granting local development access for email: %s", target_email)
            return TokenPayload(
                sub=f"dev-{target_email.split('@')[0]}",
                email=target_email,
                role="authenticated",
                aud=settings.SUPABASE_JWT_AUDIENCE or "authenticated",
                is_dev=True,
            )

    raise AuthenticationFailedError("Missing or invalid Authorization header or session cookie.")


async def get_current_user(
    payload: TokenPayload = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Resolve database User from verified JWT token payload.

    Synchronizes Supabase Auth identities into the local users table.
    Ensures inactive accounts are immediately rejected with 403 Forbidden.
    """
    # 1. Lookup existing user by primary key UUID, supabase_uid, or email
    user = None
    try:
        user_uuid = uuid.UUID(payload.sub)
        user = await db.get(User, user_uuid)
    except (ValueError, TypeError, AttributeError):
        pass

    if user is None:
        stmt = select(User).where(
            (User.supabase_uid == payload.sub) |
            ((User.email == payload.email) & (User.email.is_not(None)))
        )
        result = await db.execute(stmt)
        user = result.scalars().first()

    # 2. Auto-provision user and default workspace if first sign-in
    if user is None:
        email = payload.email or f"{payload.sub}@placeholder.user"
        user = User(
            email=email,
            supabase_uid=payload.sub,
            full_name=payload.user_metadata.get("full_name") or payload.user_metadata.get("name"),
            avatar_url=payload.user_metadata.get("avatar_url"),
            role="user",
            is_active=True,
        )
        db.add(user)
        await db.flush()

        # Provision personal default workspace
        workspace_slug = f"ws-{uuid.uuid4().hex[:10]}"
        workspace = Workspace(
            name=f"{user.full_name or 'Personal'}'s Workspace",
            slug=workspace_slug,
            owner_id=user.id,
            settings={"is_default": True},
        )
        db.add(workspace)
        await db.flush()

        # Assign owner membership
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        db.add(membership)
        await db.flush()

        logger.info("Auto-provisioned new user %s with default workspace %s", user.email, workspace.slug)

    # 3. Check active status
    if not user.is_active:
        logger.warning("Rejected deactivated user access: %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated.",
        )

    return user


async def get_active_workspace(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Workspace:
    """Validate workspace membership and enforce multi-tenant isolation.

    If X-Workspace-ID is specified, verifies that the user is a member of that workspace.
    If omitted, resolves the user's primary/first accessible workspace.
    All cross-tenant access attempts are rejected with 403 Forbidden.
    """
    if x_workspace_id:
        try:
            target_workspace_id = uuid.UUID(x_workspace_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Workspace-ID format. Must be a valid UUID.",
            )

        # Check membership
        stmt = (
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                Workspace.id == target_workspace_id,
                WorkspaceMember.user_id == current_user.id,
            )
        )
        result = await db.execute(stmt)
        workspace = result.scalars().first()

        if workspace is None:
            logger.warning(
                "Cross-tenant access blocked: User %s attempted to access workspace %s",
                current_user.id,
                x_workspace_id,
            )
            raise WorkspaceAccessDeniedError(x_workspace_id)

        return workspace

    # Default: Resolve first accessible workspace for the user
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(WorkspaceMember.created_at.asc())
    )
    result = await db.execute(stmt)
    workspace = result.scalars().first()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No accessible workspace found for this user account.",
        )

    return workspace


async def get_document_for_workspace(
    document_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> Document:
    """Enforce that document belongs to the active tenant workspace."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    result = await db.execute(stmt)
    document = result.scalars().first()

    if document is None:
        raise ResourceNotFoundError("Document", str(document_id))

    return document


async def get_conversation_for_workspace(
    conversation_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> Conversation:
    """Enforce that conversation belongs to the active tenant workspace."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.workspace_id == workspace.id,
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if conversation is None:
        raise ResourceNotFoundError("Conversation", str(conversation_id))

    return conversation


async def get_processing_job_for_workspace(
    job_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ProcessingJob:
    """Enforce that processing job belongs to the active tenant workspace."""
    stmt = select(ProcessingJob).where(
        ProcessingJob.id == job_id,
        ProcessingJob.workspace_id == workspace.id,
    )
    result = await db.execute(stmt)
    job = result.scalars().first()

    if job is None:
        raise ResourceNotFoundError("ProcessingJob", str(job_id))

    return job


def require_workspace_role(allowed_roles: List[str]):
    """FastAPI dependency factory enforcing role-based access control within the active workspace."""
    async def role_checker(
        workspace: Workspace = Depends(get_active_workspace),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session),
    ) -> WorkspaceMember:
        # Check explicit membership
        stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == current_user.id,
        )
        result = await db.execute(stmt)
        member = result.scalars().first()

        # Workspace owner has 'owner' permissions automatically
        effective_role = "owner" if workspace.owner_id == current_user.id else (member.role if member else None)

        if not effective_role or effective_role not in allowed_roles:
            logger.warning(
                "RBAC Access Denied: User %s (effective role: %s) requested operation requiring %s on workspace %s",
                current_user.id,
                effective_role,
                allowed_roles,
                workspace.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following workspace roles: {', '.join(allowed_roles)}.",
            )

        return member or WorkspaceMember(workspace_id=workspace.id, user_id=current_user.id, role=effective_role)

    return role_checker
