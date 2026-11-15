"""Action Items & Document-Driven Suggestions API Router."""

from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.discovery import ActionDiscoveryService
from app.services.actions.items import ActionItemService
from app.services.actions.models import (
    ActionDiscoveryResult,
    ActionItemCreate,
    ActionItemListResponse,
    ActionItemResponse,
    ActionItemUpdate,
    ActionSuggestionListResponse,
    ActionSuggestionResponse,
    SuggestionApprovalRequest,
)
from app.services.actions.suggestions import ActionSuggestionService
from app.services.actions.workflow import ActionWorkflowService

logger = get_logger("api.actions")
router = APIRouter(prefix="/actions", tags=["actions"])

item_service = ActionItemService()
suggestion_service = ActionSuggestionService()
workflow_service = ActionWorkflowService()
discovery_service = ActionDiscoveryService()


# --- Action Suggestions Endpoints (Must be declared before /{id}) ---

@router.get("/suggestions", response_model=ActionSuggestionListResponse)
async def list_suggestions(
    document_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query("suggested"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionSuggestionListResponse:
    """List candidate action suggestions awaiting user review."""
    items, total = await suggestion_service.get_suggestions(
        db=db,
        workspace_id=workspace.id,
        document_id=document_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return ActionSuggestionListResponse(
        items=[ActionSuggestionResponse.model_validate(i) for i in items],
        total=total,
    )


@router.post("/suggestions/{suggestion_id}/approve", response_model=ActionItemResponse)
async def approve_suggestion(
    suggestion_id: uuid.UUID,
    data: SuggestionApprovalRequest,
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Approve candidate suggestion to convert it into a confirmed ActionItem and optional Reminder."""
    try:
        action_item, reminder = await workflow_service.approve_suggestion(
            db=db,
            suggestion_id=suggestion_id,
            workspace_id=workspace.id,
            user_id=user.id,
            approval_data=data,
        )
        return ActionItemResponse.model_validate(action_item)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Failed to approve suggestion %s: %s", suggestion_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve suggestion.",
        )


@router.post("/suggestions/{suggestion_id}/dismiss", response_model=ActionSuggestionResponse)
async def dismiss_suggestion(
    suggestion_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionSuggestionResponse:
    """Dismiss candidate suggestion."""
    try:
        suggestion = await workflow_service.dismiss_suggestion(
            db=db,
            suggestion_id=suggestion_id,
            workspace_id=workspace.id,
        )
        return ActionSuggestionResponse.model_validate(suggestion)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/discover/{document_id}", response_model=ActionDiscoveryResult)
async def discover_document_actions(
    document_id: uuid.UUID,
    persist: bool = Query(True),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionDiscoveryResult:
    """Scan document pages and produce candidate action suggestions for user review."""
    try:
        return await discovery_service.discover_actions_for_document(
            db=db,
            document_id=document_id,
            workspace_id=workspace.id,
            persist=persist,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Failed to discover actions for document %s: %s", document_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Action discovery failed: {str(e)}",
        )


# --- Action Items CRUD Endpoints ---

@router.post("", response_model=ActionItemResponse, status_code=status.HTTP_201_CREATED)
async def create_action_item(
    data: ActionItemCreate,
    workspace: Workspace = Depends(get_active_workspace),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Create a manual action item."""
    action_item, _ = await item_service.create_action_item(
        db=db,
        workspace_id=workspace.id,
        user_id=user.id,
        data=data,
    )
    return ActionItemResponse.model_validate(action_item)


@router.get("", response_model=ActionItemListResponse)
async def list_action_items(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    document_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemListResponse:
    """List action items in active workspace."""
    items, total = await item_service.get_action_items(
        db=db,
        workspace_id=workspace.id,
        status=status,
        priority=priority,
        document_id=document_id,
        limit=limit,
        offset=offset,
    )
    return ActionItemListResponse(
        items=[ActionItemResponse.model_validate(i) for i in items],
        total=total,
    )


@router.get("/{action_item_id}", response_model=ActionItemResponse)
async def get_action_item(
    action_item_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Get single action item."""
    item = await item_service.get_action_item(db=db, item_id=action_item_id, workspace_id=workspace.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
    return ActionItemResponse.model_validate(item)


@router.patch("/{action_item_id}", response_model=ActionItemResponse)
async def update_action_item(
    action_item_id: uuid.UUID,
    data: ActionItemUpdate,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Update action item properties."""
    item = await item_service.update_action_item(
        db=db, item_id=action_item_id, workspace_id=workspace.id, data=data
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
    return ActionItemResponse.model_validate(item)


@router.post("/{action_item_id}/complete", response_model=ActionItemResponse)
async def complete_action_item(
    action_item_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Mark action item as completed."""
    item = await item_service.complete_action_item(
        db=db, item_id=action_item_id, workspace_id=workspace.id
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
    return ActionItemResponse.model_validate(item)


@router.post("/{action_item_id}/reopen", response_model=ActionItemResponse)
async def reopen_action_item(
    action_item_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Reopen a completed or dismissed action item."""
    item = await item_service.reopen_action_item(
        db=db, item_id=action_item_id, workspace_id=workspace.id
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
    return ActionItemResponse.model_validate(item)


@router.post("/{action_item_id}/dismiss", response_model=ActionItemResponse)
async def dismiss_action_item(
    action_item_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ActionItemResponse:
    """Dismiss action item."""
    item = await item_service.dismiss_action_item(
        db=db, item_id=action_item_id, workspace_id=workspace.id
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
    return ActionItemResponse.model_validate(item)


@router.delete("/{action_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(
    action_item_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete an action item."""
    success = await item_service.delete_action_item(
        db=db, item_id=action_item_id, workspace_id=workspace.id
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found.")
