"""Citation Extraction and Construction Engine.

Parses source markers from generated responses and correlates them with
retrieved context chunks to build verified citation objects.
"""

import re
from typing import List, Set

from app.services.rag.models import AssembledContext, CitationDTO


class CitationBuilder:
    """Builds structured CitationDTO instances from generated answers and retrieved context."""

    def extract_citations(
        self,
        answer_text: str,
        context: AssembledContext,
    ) -> List[CitationDTO]:
        """Correlate citation markers in the answer with actual retrieved chunk records."""
        if not context.sources_map:
            return []

        # Check if the answer explicitly stated insufficient evidence
        if "cannot find sufficient evidence" in answer_text.lower():
            return []

        # Find all [Source N] or [Source: N] or [Source-N] references
        pattern = re.compile(r"\[(?:Source|source)[ :#-]*(\d+)\]")
        matches = pattern.findall(answer_text)

        citations: List[CitationDTO] = []
        seen_chunk_ids: Set[str] = set()
        citation_order = 1

        for match in matches:
            try:
                src_idx = int(match)
            except ValueError:
                continue

            chunk = context.sources_map.get(src_idx)
            if not chunk or chunk.chunk_id in seen_chunk_ids:
                continue

            seen_chunk_ids.add(chunk.chunk_id)
            # Create a clean quote excerpt from the chunk content
            clean_content = chunk.content.strip().replace("\n", " ")
            quote = clean_content[:240] + ("..." if len(clean_content) > 240 else "")

            citations.append(
                CitationDTO(
                    document_id=chunk.document_id,
                    document_filename=chunk.document_filename,
                    chunk_id=chunk.chunk_id,
                    page_number=chunk.page_number,
                    quote=quote,
                    relevance_score=chunk.score,
                    citation_index=citation_order,
                )
            )
            citation_order += 1

        # Fallback: If no explicit markers found, but answer was grounded and context exists,
        # attach the top retrieved chunk as supporting context
        if not citations and context.chunks:
            top_chunk = context.chunks[0]
            clean_content = top_chunk.content.strip().replace("\n", " ")
            quote = clean_content[:240] + ("..." if len(clean_content) > 240 else "")
            citations.append(
                CitationDTO(
                    document_id=top_chunk.document_id,
                    document_filename=top_chunk.document_filename,
                    chunk_id=top_chunk.chunk_id,
                    page_number=top_chunk.page_number,
                    quote=quote,
                    relevance_score=top_chunk.score,
                    citation_index=1,
                )
            )

        return citations
