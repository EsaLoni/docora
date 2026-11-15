"""Action Suggestion Management Service."""

from typing import List, Optional, Tuple
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import ActionSuggestion


class ActionSuggestionService:
    """Service to query, review, and dismiss candidate action suggestions."""

    async def get_suggestions(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
        status: Optional[str] = "suggested",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[ActionSuggestion], int]:
        """Query suggestions with workspace isolation."""
        query = select(ActionSuggestion).where(ActionSuggestion.workspace_id == workspace_id)
        count_query = select(func.count(ActionSuggestion.id)).where(ActionSuggestion.workspace_id == workspace_id)

        if document_id:
            query = query.where(ActionSuggestion.document_id == document_id)
            count_query = count_query.where(ActionSuggestion.document_id == document_id)

        if status:
            query = query.where(ActionSuggestion.status == status)
            count_query = count_query.where(ActionSuggestion.status == status)

        query = query.order_by(ActionSuggestion.created_at.desc()).limit(limit).offset(offset)

        total = (await db.execute(count_query)).scalar() or 0
        suggestions = (await db.execute(query)).scalars().all()

        return list(suggestions), total

    async def get_suggestion(
        self,
        db: AsyncSession,
        suggestion_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionSuggestion]:
        """Fetch a specific suggestion with workspace tenant isolation."""
        stmt = select(ActionSuggestion).where(
            ActionSuggestion.id == suggestion_id,
            ActionSuggestion.workspace_id == workspace_id,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def dismiss_suggestion(
        self,
        db: AsyncSession,
        suggestion_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionSuggestion]:
        """Mark a suggestion as dismissed so it does not clutter pending views."""
        suggestion = await self.get_suggestion(db, suggestion_id, workspace_id)
        if not suggestion:
            return None

        suggestion.status = "dismissed"
        await db.commit()
        await db.refresh(suggestion)
        return suggestion
