"""Authentication API Endpoints.

Provides production-grade registration, credential login, password resets,
session introspection, and controlled local development token issuance.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
import jwt
import re
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

logger = get_logger("auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─────────────────────────────────────────────────────────────────────────────
# Request & Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class WorkspaceInfo(BaseModel):
    id: str
    name: str
    slug: str
    role: str
    is_owner: bool


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    avatar_url: Optional[str] = None
    workspaces: List[WorkspaceInfo] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email format.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email format.")
        return v


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserProfileResponse


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email format.")
        return v


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, description="Password must be at least 8 characters")


class SimpleStatusResponse(BaseModel):
    success: bool
    message: str


class DevTokenRequest(BaseModel):
    email: str
    user_id: Optional[str] = None
    role: str = "authenticated"


class DevTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    note: str


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

async def _build_user_profile(user: User, db: AsyncSession) -> UserProfileResponse:
    """Build UserProfileResponse with all accessible workspaces."""
    stmt = (
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    workspaces = [
        WorkspaceInfo(
            id=str(ws.id),
            name=ws.name,
            slug=ws.slug,
            role=role,
            is_owner=ws.owner_id == user.id,
        )
        for ws, role in rows
    ]

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        avatar_url=user.avatar_url,
        workspaces=workspaces,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    request: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    """Register a new user account with hashed password, default workspace, and session."""
    normalized_email = request.email.strip().lower()

    # Check for existing account
    existing = await db.execute(select(User).where(User.email == normalized_email))
    if existing.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Hash password with scrypt (memory-hard, salted)
    hashed_pwd = hash_password(request.password)

    # Create user
    user = User(
        id=uuid.uuid4(),
        email=normalized_email,
        supabase_uid=None,
        full_name=request.full_name.strip() if request.full_name else None,
        role="user",
        is_active=True,
        password_hash=hashed_pwd,
    )
    db.add(user)
    await db.flush()

    # Provision user's personal default workspace
    workspace = Workspace(
        id=uuid.uuid4(),
        name=f"{user.full_name or 'Personal'}'s Workspace",
        slug=f"ws-{uuid.uuid4().hex[:10]}",
        owner_id=user.id,
        settings={"is_default": True},
    )
    db.add(workspace)
    await db.flush()

    # Add owner membership
    membership = WorkspaceMember(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)

    logger.info("Registered new user %s (id: %s) with workspace %s", user.email, user.id, workspace.slug)

    # Issue access token
    expires_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expires_delta = timedelta(minutes=expires_minutes)
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "aud": settings.SUPABASE_JWT_AUDIENCE or "authenticated",
    }
    token = create_access_token(
        data=token_data,
        secret=settings.SECRET_KEY.get_secret_value(),
        expires_delta=expires_delta,
    )

    # Set secure HttpOnly cookie & double-submit CSRF cookie
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=expires_minutes * 60,
        path="/",
    )
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_prod,
        samesite="lax",
        max_age=expires_minutes * 60,
        path="/",
    )

    profile = await _build_user_profile(user, db)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=profile,
    )


@router.post("/login", response_model=AuthResponse)
async def login_user(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    """Authenticate with email and password, issuing an access token and secure cookies."""
    normalized_email = request.email.strip().lower()

    stmt = select(User).where(User.email == normalized_email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user is None or not user.password_hash or not verify_password(request.password, user.password_hash):
        logger.warning("Failed login attempt for email: %s", normalized_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        logger.warning("Rejected login for deactivated user: %s", normalized_email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    # Determine expiration (7 days if remember_me, otherwise standard setting)
    expires_minutes = 7 * 24 * 60 if request.remember_me else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "aud": settings.SUPABASE_JWT_AUDIENCE or "authenticated",
    }
    token = create_access_token(
        data=token_data,
        secret=settings.SECRET_KEY.get_secret_value(),
        expires_delta=timedelta(minutes=expires_minutes),
    )

    # Set secure HttpOnly cookie & double-submit CSRF cookie
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=expires_minutes * 60,
        path="/",
    )
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_prod,
        samesite="lax",
        max_age=expires_minutes * 60,
        path="/",
    )

    logger.info("User authenticated: %s (id: %s)", user.email, user.id)
    profile = await _build_user_profile(user, db)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=expires_minutes,
        user=profile,
    )


@router.post("/logout", response_model=SimpleStatusResponse)
async def logout_user(response: Response) -> SimpleStatusResponse:
    """Terminates client session and clears authentication cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="csrf_token", path="/")
    return SimpleStatusResponse(success=True, message="Successfully logged out.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ForgotPasswordResponse:
    """Initiates password reset workflow. Returns reset token in dev/test mode."""
    normalized_email = request.email.strip().lower()
    stmt = select(User).where(User.email == normalized_email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    reset_token = None
    if user and user.is_active:
        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "purpose": "password_reset",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=2)).timestamp()),
        }
        reset_token = jwt.encode(
            token_payload,
            settings.SECRET_KEY.get_secret_value(),
            algorithm="HS256",
        )
        logger.info("Generated password reset token for %s", normalized_email)

    return ForgotPasswordResponse(
        success=True,
        message="If an account matches that email, a password reset link has been dispatched.",
        reset_token=reset_token if (settings.DEBUG or settings.ALLOW_DEV_AUTH) else None,
    )


@router.post("/reset-password", response_model=SimpleStatusResponse)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SimpleStatusResponse:
    """Validates reset token and sets new password."""
    try:
        payload = jwt.decode(
            request.token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link has expired. Please request a new one.",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted password reset token.",
        )

    if payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token purpose.",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed reset token.",
        )

    user = await db.get(User, uuid.UUID(user_id_str))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or inactive.",
        )

    user.password_hash = hash_password(request.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info("Successfully reset password for user %s", user.email)
    return SimpleStatusResponse(
        success=True,
        message="Password has been successfully updated. You may now log in.",
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfileResponse:
    """Return profile details and accessible workspaces for the authenticated user."""
    return await _build_user_profile(current_user, db)


@router.post("/dev-token", response_model=DevTokenResponse)
async def generate_dev_token(
    request: DevTokenRequest,
    settings: Settings = Depends(get_settings),
) -> DevTokenResponse:
    """Generate a local JWT token for testing.

    Strictly rejected with 403 Forbidden unless ALLOW_DEV_AUTH is explicitly True.
    """
    if not settings.ALLOW_DEV_AUTH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local development authentication is disabled on this server.",
        )

    sub = request.user_id or f"dev-{request.email.split('@')[0]}"
    token_data = {
        "sub": sub,
        "email": request.email,
        "role": request.role,
        "aud": settings.SUPABASE_JWT_AUDIENCE,
    }

    token = create_access_token(
        data=token_data,
        secret=settings.SECRET_KEY.get_secret_value(),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return DevTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        note="Valid only when ALLOW_DEV_AUTH=True",
    )
