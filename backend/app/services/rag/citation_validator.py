"""Citation Security and Integrity Validator.

Ensures every citation references a verified, persisted DocumentChunk belonging to the
active tenant workspace, preventing cross-tenant leakage and citation forgery.
"""

from typing import List, Set
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UDIPException
from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk
from app.services.rag.models import AssembledContext, CitationDTO

logger = get_logger("rag.citation_validator")


class CitationValidationError(UDIPException):
    """Raised when an invalid, forged, or cross-tenant citation is detected."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=400,
            error_code="INVALID_CITATION",
            details=details,
        )


class CitationValidator:
    """Validates citations against active workspace boundaries and retrieved context pools."""

    async def validate_citations(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        citations: List[CitationDTO],
        context: AssembledContext,
    ) -> List[CitationDTO]:
        """Verify citations belong to the active workspace and correspond to retrieved chunks."""
        if not citations:
            return []

        # 1. Verify every citation chunk was actually part of the retrieved context pool
        retrieved_chunk_ids: Set[str] = {c.chunk_id for c in context.chunks}
        verified_candidates: List[CitationDTO] = []

        for cite in citations:
            if cite.chunk_id not in retrieved_chunk_ids:
                logger.warning(
                    "Rejected citation referencing chunk %s: not in retrieved context pool.",
                    cite.chunk_id,
                )
                continue
            verified_candidates.append(cite)

        if not verified_candidates:
            return []

        # 2. Database verification: check that chunk and document belong strictly to active workspace
        chunk_uuids = []
        for c in verified_candidates:
            try:
                chunk_uuids.append(uuid.UUID(c.chunk_id))
            except ValueError:
                logger.warning("Rejected malformed chunk UUID: %s", c.chunk_id)

        if not chunk_uuids:
            return []

        stmt = (
            select(DocumentChunk.id, DocumentChunk.document_id, DocumentChunk.workspace_id, Document.is_deleted)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                DocumentChunk.id.in_(chunk_uuids),
                DocumentChunk.workspace_id == workspace_id,
                Document.is_deleted.is_(False),
            )
        )
        result = await db.execute(stmt)
        valid_chunk_rows = {str(row[0]): (str(row[1]), row[2]) for row in result.all()}

        # 3. Final filter
        approved_citations: List[CitationDTO] = []
        for cite in verified_candidates:
            if cite.chunk_id in valid_chunk_rows:
                doc_id, ws_id = valid_chunk_rows[cite.chunk_id]
                if cite.document_id == doc_id and ws_id == workspace_id:
                    approved_citations.append(cite)
                else:
                    logger.warning(
                        "Citation %s failed workspace ownership match (%s vs %s)",
                        cite.chunk_id, ws_id, workspace_id,
                    )
            else:
                logger.warning(
                    "Citation %s not found in active workspace %s",
                    cite.chunk_id, workspace_id,
                )

        return approved_citations
