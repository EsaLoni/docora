"""Recursive Hierarchical Text Chunker.

Recursively splits passages using natural linguistic boundaries
(paragraphs, newlines, sentences, punctuation, words) to preserve context.
"""

import re
from typing import Any, Dict, List, Optional
import uuid

from app.services.chunking.base import BaseChunker
from app.services.chunking.models import ChunkType, DocumentChunkResult
from app.services.extractors.base import estimate_token_count


class RecursiveTextChunker(BaseChunker):
    """Hierarchical text chunker preserving section headers and paragraph flow."""

    SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]

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
        """Split text recursively into size-bounded chunks."""
        clean_content = (page_content or "").strip()
        if not clean_content:
            return []

        # Find initial section heading if present at top
        initial_title = self._detect_section_title(clean_content)

        raw_chunks = self._recursive_split(clean_content, self.SEPARATORS)
        results: List[DocumentChunkResult] = []
        current_index = start_index
        current_section = initial_title

        for text in raw_chunks:
            chunk_str = text.strip()
            if not chunk_str:
                continue

            # Update current section title if new heading appears
            detected_h = self._detect_section_title(chunk_str)
            if detected_h:
                current_section = detected_h

            t_count = estimate_token_count(chunk_str)
            results.append(
                DocumentChunkResult(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    page_id=page_id,
                    page_number=page_number,
                    chunk_index=current_index,
                    content=chunk_str,
                    token_count=t_count,
                    section_title=current_section,
                    chunk_type=ChunkType.TEXT.value,
                    metadata_json={
                        "char_length": len(chunk_str),
                        "page_number": page_number,
                    },
                )
            )
            current_index += 1

        return results

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        """Split text until all chunks are within token limit."""
        if estimate_token_count(text) <= self.chunk_size_tokens:
            return [text]

        if not separators:
            # Fallback hard slice if no separator remains
            chars_per_chunk = self.chunk_size_tokens * 4
            return [text[i:i + chars_per_chunk] for i in range(0, len(text), chars_per_chunk)]

        sep = separators[0]
        remaining_seps = separators[1:]

        if sep == "":
            parts = list(text)
        elif sep in text:
            parts = text.split(sep)
        else:
            return self._recursive_split(text, remaining_seps)

        merged_chunks: List[str] = []
        current_chunk: List[str] = []
        current_tokens = 0

        for part in parts:
            part_tokens = estimate_token_count(part)
            if current_tokens + part_tokens > self.chunk_size_tokens and current_chunk:
                merged_chunks.append(sep.join(current_chunk))
                # Compute overlap if available
                if self.chunk_overlap_tokens > 0 and len(current_chunk) > 1:
                    overlap_parts: List[str] = []
                    overlap_toks = 0
                    for rev_part in reversed(current_chunk):
                        p_toks = estimate_token_count(rev_part)
                        if overlap_toks + p_toks <= self.chunk_overlap_tokens:
                            overlap_parts.insert(0, rev_part)
                            overlap_toks += p_toks
                        else:
                            break
                    current_chunk = overlap_parts + [part]
                    current_tokens = overlap_toks + part_tokens
                else:
                    current_chunk = [part]
                    current_tokens = part_tokens
            else:
                current_chunk.append(part)
                current_tokens += part_tokens

        if current_chunk:
            merged_chunks.append(sep.join(current_chunk))

        # Check if any resulting piece still exceeds the token target
        final_chunks: List[str] = []
        for piece in merged_chunks:
            if estimate_token_count(piece) > self.chunk_size_tokens and remaining_seps:
                final_chunks.extend(self._recursive_split(piece, remaining_seps))
            else:
                final_chunks.append(piece)

        return final_chunks

    def _detect_section_title(self, text: str) -> Optional[str]:
        """Extract Markdown heading (# Title) from beginning of string if present."""
        match = re.search(r"^(?:#{1,4})\s+(.+?)(?:\n|$)", text)
        if match:
            return match.group(1).strip()
        return None
