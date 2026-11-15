"""Vector Semantic Retriever.

Performs pgvector cosine distance similarity search in PostgreSQL,
with an in-memory cosine fallback for SQLite test environments.
"""

import math
from typing import List, Optional
import uuid
import numpy as np
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk
from app.services.retrieval.models import SearchResultItem

logger = get_logger("retrieval.vector")


class VectorRetriever:
    """Retriever utilizing 384-dimensional vector embeddings and cosine similarity."""

    async def search(
        self,
        db: AsyncSession,
        query_vector: List[float],
        workspace_id: uuid.UUID,
        limit: int = 10,
        document_id: Optional[uuid.UUID] = None,
        folder_id: Optional[uuid.UUID] = None,
    ) -> List[SearchResultItem]:
        """Perform semantic vector search bounded strictly to workspace."""
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
            # Native pgvector cosine distance search
            # Distance: 0 = identical, 2 = opposite. Score = 1.0 - distance
            cosine_dist = DocumentChunk.embedding.cosine_distance(query_vector)
            stmt = base_stmt.add_columns(cosine_dist.label("distance")).order_by(cosine_dist.asc()).limit(limit)
            rows = (await db.execute(stmt)).all()

            results: List[SearchResultItem] = []
            for chunk, filename, title, dist in rows:
                score = round(max(0.0, min(1.0, 1.0 - float(dist))), 4)
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
                        retrieval_mode="vector",
                        metadata=meta,
                    )
                )
            return results

        else:
            # SQLite / Test dialect fallback: compute cosine similarity in Python
            rows = (await db.execute(base_stmt)).all()
            if not rows:
                return []

            q_vec = np.array(query_vector, dtype=np.float32)
            q_norm = np.linalg.norm(q_vec)
            if q_norm == 0.0:
                q_norm = 1.0

            scored_items = []
            for chunk, filename, title in rows:
                c_emb = chunk.embedding
                if c_emb is None:
                    continue
                c_vec = np.array(c_emb, dtype=np.float32)
                c_norm = np.linalg.norm(c_vec)
                if c_norm == 0.0:
                    c_norm = 1.0

                sim = float(np.dot(q_vec, c_vec) / (q_norm * c_norm))
                score = round(max(0.0, min(1.0, (sim + 1.0) / 2.0)), 4)  # map [-1, 1] to [0, 1]
                scored_items.append((score, chunk, filename, title))

            # Sort descending by similarity
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
                        retrieval_mode="vector",
                        metadata=meta,
                    )
                )
            return results
