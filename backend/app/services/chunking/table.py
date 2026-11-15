"""Table-Aware Document Chunker.

Preserves markdown and structured table integrity without splitting individual table rows.
Large tables are partitioned by row groups with headers repeated for contextual clarity.
"""

import re
from typing import Any, Dict, List, Optional
import uuid

from app.services.chunking.base import BaseChunker
from app.services.chunking.models import ChunkType, DocumentChunkResult
from app.services.chunking.recursive import RecursiveTextChunker
from app.services.extractors.base import estimate_token_count


class TableAwareChunker(BaseChunker):
    """Chunker specialized in preserving tabular structures and non-table prose."""

    def __init__(self, chunk_size_tokens: int = 400, chunk_overlap_tokens: int = 50) -> None:
        super().__init__(chunk_size_tokens, chunk_overlap_tokens)
        self.text_chunker = RecursiveTextChunker(chunk_size_tokens, chunk_overlap_tokens)

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
        """Separate tables from narrative text and chunk each respectfully."""
        clean_content = (page_content or "").strip()
        if not clean_content:
            return []

        # Detect markdown table blocks (ensure trailing newline for boundary matching)
        content_with_nl = clean_content if clean_content.endswith("\n") else clean_content + "\n"
        table_pattern = re.compile(
            r"((?:^[ \t]*\|.+?\|[ \t]*\n){2,})",
            re.MULTILINE,
        )

        segments = []
        last_end = 0

        for match in table_pattern.finditer(content_with_nl):
            start, end = match.span()
            if start > last_end:
                segments.append({"type": "text", "content": content_with_nl[last_end:start].strip()})
            segments.append({"type": "table", "content": match.group(0).strip()})
            last_end = end

        if last_end < len(content_with_nl):
            tail = content_with_nl[last_end:].strip()
            if tail:
                segments.append({"type": "text", "content": tail})

        if not segments:
            segments = [{"type": "text", "content": clean_content}]

        results: List[DocumentChunkResult] = []
        current_idx = start_index

        for seg in segments:
            if seg["type"] == "text":
                text_chunks = self.text_chunker.chunk_page(
                    page_content=seg["content"],
                    page_number=page_number,
                    page_id=page_id,
                    document_id=document_id,
                    workspace_id=workspace_id,
                    page_metadata=page_metadata,
                    start_index=current_idx,
                )
                results.extend(text_chunks)
                current_idx += len(text_chunks)

            elif seg["type"] == "table":
                table_chunks = self._chunk_table(
                    table_md=seg["content"],
                    page_number=page_number,
                    page_id=page_id,
                    document_id=document_id,
                    workspace_id=workspace_id,
                    start_index=current_idx,
                )
                results.extend(table_chunks)
                current_idx += len(table_chunks)

        return results

    def _chunk_table(
        self,
        table_md: str,
        page_number: int,
        page_id: uuid.UUID,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        start_index: int,
    ) -> List[DocumentChunkResult]:
        """Split large tables by row blocks while repeating table headers."""
        lines = [line.strip() for line in table_md.split("\n") if line.strip()]
        if len(lines) <= 2 or estimate_token_count(table_md) <= self.chunk_size_tokens:
            # Fits intact
            return [
                DocumentChunkResult(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    page_id=page_id,
                    page_number=page_number,
                    chunk_index=start_index,
                    content=table_md,
                    token_count=estimate_token_count(table_md),
                    section_title="Table",
                    chunk_type=ChunkType.TABLE,
                    metadata_json={"is_table": True, "row_count": len(lines) - 2},
                )
            ]

        # Extract header and divider
        header_line = lines[0]
        divider_line = lines[1] if re.match(r"^\|?\s*[-:]+", lines[1]) else "|---|---|"
        data_rows = lines[2:] if divider_line == lines[1] else lines[1:]

        chunks: List[DocumentChunkResult] = []
        current_rows: List[str] = []
        current_idx = start_index

        for row in data_rows:
            candidate_block = "\n".join([header_line, divider_line] + current_rows + [row])
            if estimate_token_count(candidate_block) > self.chunk_size_tokens and current_rows:
                block_str = "\n".join([header_line, divider_line] + current_rows)
                chunks.append(
                    DocumentChunkResult(
                        workspace_id=workspace_id,
                        document_id=document_id,
                        page_id=page_id,
                        page_number=page_number,
                        chunk_index=current_idx,
                        content=block_str,
                        token_count=estimate_token_count(block_str),
                        section_title="Table (Continued)",
                        chunk_type=ChunkType.TABLE,
                        metadata_json={"is_table": True, "row_count": len(current_rows)},
                    )
                )
                current_idx += 1
                current_rows = [row]
            else:
                current_rows.append(row)

        if current_rows:
            block_str = "\n".join([header_line, divider_line] + current_rows)
            chunks.append(
                DocumentChunkResult(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    page_id=page_id,
                    page_number=page_number,
                    chunk_index=current_idx,
                    content=block_str,
                    token_count=estimate_token_count(block_str),
                    section_title="Table",
                    chunk_type=ChunkType.TABLE,
                    metadata_json={"is_table": True, "row_count": len(current_rows)},
                )
            )

        return chunks
