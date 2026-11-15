"""Keyword Text Retriever.

Performs PostgreSQL Full-Text Search (FTS) with an ILIKE term-frequency
fallback for SQLite test environments.
"""

import re
from typing import List, Optional
import uuid
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk
from app.services.retrieval.models import SearchResultItem

logger = get_logger("retrieval.keyword")


class KeywordRetriever:
    """Retriever searching lexical text matches and keyword occurrences."""

    async def search(
        self,
        db: AsyncSession,
        query: str,
        workspace_id: uuid.UUID,
        limit: int = 10,
        document_id: Optional[uuid.UUID] = None,
        folder_id: Optional[uuid.UUID] = None,
    ) -> List[SearchResultItem]:
        """Perform keyword search bounded strictly to workspace."""
        clean_q = query.strip()
        if not clean_q:
            return []

        bind = db.get_bind()
        is_postgres = bind.dialect.name == "postgresql"

        base_stmt = (
            select(
                DocumentChunk,
                Document.filename.label("doc_filename"),
                Document.title.label("doc_title"),
            )
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                DocumentChunk.workspace_id == workspace_id,
                Document.workspace_id == workspace_id,
                Document.is_deleted == False,
                Document.status == "READY",
            )
        )

        if document_id:
            base_stmt = base_stmt.where(Document.id == document_id)
        if folder_id:
            base_stmt = base_stmt.where(Document.folder_id == folder_id)

        if is_postgres:
            # PostgreSQL full-text search with ts_rank_cd
            ts_query = func.plainto_tsquery("english", clean_q)
            ts_vector = func.to_tsvector("english", DocumentChunk.content)
            rank = func.ts_rank_cd(ts_vector, ts_query)

            stmt = (
                base_stmt.add_columns(rank.label("rank_score"))
                .where(ts_vector.op("@@")(ts_query))
                .order_by(rank.desc())
                .limit(limit)
            )
            rows = (await db.execute(stmt)).all()

            results: List[SearchResultItem] = []
            for chunk, filename, title, rank_score in rows:
                score = round(min(1.0, float(rank_score) + 0.1), 4)
                meta = chunk.metadata_json or {}
                results.append(
                    SearchResultItem(
                        chunk_id=str(chunk.id),
                        document_id=str(chunk.document_id),
                        document_filename=filename,
                        document_title=title,
                        page_number=meta.get("page_number", 1),
                        content=chunk.content,
                        section_title=meta.get("section_title"),
                        score=score,
                        retrieval_mode="keyword",
                        metadata=meta,
                    )
                )
            return results

        else:
            # SQLite / Test dialect fallback: ILIKE matching
            terms = [w.lower() for w in re.findall(r"\w+", clean_q) if len(w) > 2]
            if not terms:
                terms = [clean_q.lower()]

            clauses = [DocumentChunk.content.ilike(f"%{t}%") for t in terms]
            stmt = base_stmt.where(or_(*clauses))
            rows = (await db.execute(stmt)).all()

            scored_items = []
            for chunk, filename, title in rows:
                content_lower = chunk.content.lower()
                # Compute lexical occurrence score
                hits = sum(content_lower.count(t) for t in terms)
                # Normalize score based on hits
                score = round(min(1.0, 0.4 + (hits * 0.15)), 4)
                scored_items.append((score, chunk, filename, title))

            scored_items.sort(key=lambda x: x[0], reverse=True)
            top_items = scored_items[:limit]

            results = []
            for score, chunk, filename, title in top_items:
                meta = chunk.metadata_json or {}
                results.append(
                    SearchResultItem(
                        chunk_id=str(chunk.id),
                        document_id=str(chunk.document_id),
                        document_filename=filename,
                        document_title=title,
                        page_number=meta.get("page_number", 1),
                        content=chunk.content,
                        section_title=meta.get("section_title"),
                        score=score,
                        retrieval_mode="keyword",
                        metadata=meta,
                    )
                )
            return results
