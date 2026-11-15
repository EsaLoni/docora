"""Search and Hybrid Retrieval Endpoints.

Provides unified semantic vector, lexical keyword, and hybrid RRF search
across workspace-isolated documents and chunks.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.user import User
from app.models.workspace import Workspace
from app.services.retrieval.models import SearchRequest, SearchResponse
from app.services.retrieval.service import RetrievalService

logger = get_logger("api.search")

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=SearchResponse, status_code=status.HTTP_200_OK)
async def search_documents(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SearchResponse:
    """Execute vector, keyword, or hybrid document search strictly within the active workspace."""
    retrieval_service = RetrievalService(settings=settings)
    return await retrieval_service.search(
        db=db,
        workspace_id=workspace.id,
        request=request,
    )
