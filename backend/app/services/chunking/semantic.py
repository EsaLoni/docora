"""Semantic and Heading-Aware Document Chunker.

Groups sentences and paragraphs based on document heading hierarchy and semantic flow.
"""

import re
from typing import Any, Dict, List, Optional
import uuid

from app.services.chunking.base import BaseChunker
from app.services.chunking.models import ChunkType, DocumentChunkResult
from app.services.extractors.base import estimate_token_count


class SemanticChunker(BaseChunker):
    """Chunker that aligns chunk boundaries with heading hierarchy and semantic sections."""

    def chunk_page(
        self,
        page_content: str,
        page_number: int,
        page_id: uuid.UUID,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        page_metadata: Optional[Dict[str, Any]] = None,
        start_index: int = 0,
    ) -> List[DocumentChunkResult]:
        """Group paragraphs into semantically bounded chunks."""
        clean = (page_content or "").strip()
        if not clean:
            return []

        # Split on double newlines to isolate paragraphs and headings
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", clean) if p.strip()]
        if not paragraphs:
            paragraphs = [clean]

        chunks: List[DocumentChunkResult] = []
        current_section = None
        current_paragraphs: List[str] = []
        current_tokens = 0
        current_idx = start_index

        for para in paragraphs:
            # Check if paragraph begins with a heading
            first_line = para.split("\n", 1)[0].strip()
            heading_match = re.match(r"^(#{1,4})\s+(.+)$", first_line)
            if heading_match:
                # If we have accumulated paragraphs, flush them before starting new section
                if current_paragraphs:
                    content_str = "\n\n".join(current_paragraphs)
                    chunks.append(
                        DocumentChunkResult(
                            workspace_id=workspace_id,
                            document_id=document_id,
                            page_id=page_id,
                            page_number=page_number,
                            chunk_index=current_idx,
                            content=content_str,
                            token_count=estimate_token_count(content_str),
                            section_title=current_section,
                            chunk_type=ChunkType.TEXT,
                        )
                    )
                    current_idx += 1
                    current_paragraphs = []
                    current_tokens = 0

                current_section = heading_match.group(2).strip()
                # If the paragraph only contained the heading line, continue; else keep the body
                if "\n" not in para:
                    continue

            para_tokens = estimate_token_count(para)
            if current_tokens + para_tokens > self.chunk_size_tokens and current_paragraphs:
                content_str = "\n\n".join(current_paragraphs)
                chunks.append(
                    DocumentChunkResult(
                        workspace_id=workspace_id,
                        document_id=document_id,
                        page_id=page_id,
                        page_number=page_number,
                        chunk_index=current_idx,
                        content=content_str,
                        token_count=estimate_token_count(content_str),
                        section_title=current_section,
                        chunk_type=ChunkType.TEXT,
                    )
                )
                current_idx += 1
                current_paragraphs = [para]
                current_tokens = para_tokens
            else:
                current_paragraphs.append(para)
                current_tokens += para_tokens

        if current_paragraphs:
            content_str = "\n\n".join(current_paragraphs)
            chunks.append(
                DocumentChunkResult(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    page_id=page_id,
                    page_number=page_number,
                    chunk_index=current_idx,
                    content=content_str,
                    token_count=estimate_token_count(content_str),
                    section_title=current_section,
                    chunk_type=ChunkType.TEXT,
                )
            )

        return chunks
