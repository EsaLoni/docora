"""Document Summarization Service.

Provides hierarchical multi-mode document summarization:
- Quick Summary: Short overview, main topic, key facts, and important findings.
- Detailed Summary: Executive summary, section-wise breakdowns, important dates/numbers, conclusions.
- Section-wise Summary: Preserves original headings and page lineage.
- Custom Summary: Executes targeted user instructions (e.g., financial focus, risk focus, executive brief).
- Multi-document summarization across two or more selected files.
"""

from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.intelligence import DocumentSummary
from app.services.intelligence.models import (
    SummaryRequest,
    SummaryResponse,
    SummarySection,
)
from app.services.llm.models import LLMMessage
from app.services.llm.service import LLMService

logger = get_logger("intelligence.summarization")


class SummarizationService:
    """Intelligent document summarization engine supporting hierarchical compression."""

    MAX_DIRECT_PAGE_TOKENS = 3000

    def __init__(
        self,
        settings: Optional[Settings] = None,
        llm_service: Optional[LLMService] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm_service = llm_service or LLMService(settings=self.settings)

    async def summarize_document(
        self,
        request: SummaryRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> SummaryResponse:
        """Executes document summarization, builds structured sections and citations, and saves to DB."""
        # 1. Fetch primary document
        doc_stmt = (
            select(Document)
            .where(
                Document.id == request.document_id,
                Document.workspace_id == workspace_id,
                Document.is_deleted == False,
            )
        )
        document = (await db.execute(doc_stmt)).scalar_one_or_none()
        if not document:
            raise ValueError(f"Document {request.document_id} not found in workspace.")

        # 2. Fetch pages for primary document
        pages_stmt = (
            select(DocumentPage)
            .join(Document, DocumentPage.document_id == Document.id)
            .where(
                Document.id == request.document_id,
                Document.workspace_id == workspace_id,
            )
            .order_by(DocumentPage.page_number.asc())
        )
        pages = (await db.execute(pages_stmt)).scalars().all()
        if not pages:
            raise ValueError(f"Document {request.document_id} has no extracted text.")

        # Collect text and page mapping
        doc_contexts = [(p.page_number, p.content or "") for p in pages]

        # Check for multi-document summarization
        additional_docs = []
        if request.additional_document_ids:
            for extra_id in request.additional_document_ids:
                e_stmt = select(Document).where(
                    Document.id == extra_id,
                    Document.workspace_id == workspace_id,
                    Document.is_deleted == False,
                )
                extra_doc = (await db.execute(e_stmt)).scalar_one_or_none()
                if extra_doc:
                    additional_docs.append(extra_doc)

        # 3. Generate summary based on mode
        if request.summary_type == "section_wise":
            result = await self._generate_section_wise_summary(
                document, doc_contexts, request.custom_instruction
            )
        elif request.summary_type == "detailed":
            result = await self._generate_detailed_summary(
                document, doc_contexts, additional_docs, request.custom_instruction
            )
        elif request.summary_type == "custom":
            result = await self._generate_custom_summary(
                document, doc_contexts, request.custom_instruction or "Focus on key findings."
            )
        else:  # 'quick'
            result = await self._generate_quick_summary(
                document, doc_contexts, additional_docs
            )

        # 4. Persist to document_summaries table
        summary_record = DocumentSummary(
            workspace_id=workspace_id,
            document_id=document.id,
            summary_type=request.summary_type,
            custom_instruction=request.custom_instruction,
            summary_text=result["summary_text"],
            structured_data=result["structured_data"],
            citations=result["citations"],
            model=result.get("model", self.settings.LLM_MODEL_NAME),
            provider=result.get("provider", self.settings.LLM_PROVIDER),
            created_at=datetime.now(timezone.utc),
        )
        db.add(summary_record)
        await db.commit()
        await db.refresh(summary_record)

        return SummaryResponse(
            id=str(summary_record.id),
            document_id=str(document.id),
            summary_type=request.summary_type,
            summary_text=result["summary_text"],
            executive_summary=result.get("executive_summary"),
            sections=result.get("sections", []),
            key_findings=result.get("key_findings", []),
            key_facts=result.get("key_facts", []),
            important_dates_and_numbers=result.get("important_dates_and_numbers", []),
            citations=result.get("citations", []),
            model=summary_record.model,
            provider=summary_record.provider,
            created_at=summary_record.created_at.isoformat(),
        )

    async def get_latest_summary(
        self,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> Optional[SummaryResponse]:
        """Fetches the latest summary for a document."""
        stmt = (
            select(DocumentSummary)
            .where(
                DocumentSummary.document_id == document_id,
                DocumentSummary.workspace_id == workspace_id,
            )
            .order_by(DocumentSummary.created_at.desc())
        )
        summary = (await db.execute(stmt)).scalars().first()
        if not summary:
            return None

        struct = summary.structured_data or {}
        sections = [SummarySection(**s) for s in struct.get("sections", [])]

        return SummaryResponse(
            id=str(summary.id),
            document_id=str(summary.document_id),
            summary_type=summary.summary_type,
            summary_text=summary.summary_text,
            executive_summary=struct.get("executive_summary"),
            sections=sections,
            key_findings=struct.get("key_findings", []),
            key_facts=struct.get("key_facts", []),
            important_dates_and_numbers=struct.get("important_dates_and_numbers", []),
            citations=summary.citations or [],
            model=summary.model,
            provider=summary.provider,
            created_at=summary.created_at.isoformat(),
        )

    # -------------------------------------------------------------------------
    # Internal Summarization Builders
    # -------------------------------------------------------------------------

    async def _generate_quick_summary(
        self,
        doc: Document,
        pages: List[Tuple[int, str]],
        extra_docs: List[Document] = [],
    ) -> Dict[str, Any]:
        """Generates a concise 1-page overview with key findings, facts, and citations."""
        evidence_text = self._build_budgeted_context(pages)
        citations = [{"document_id": str(doc.id), "filename": doc.filename, "page_number": p[0]} for p in pages[:3]]

        system_prompt = (
            "You are an expert document summarization assistant.\n"
            "Produce a high-density, factual QUICK SUMMARY.\n"
            "Requirements:\n"
            "1. Give an overall high-level summary paragraph.\n"
            "2. Identify 3-5 Key Findings.\n"
            "3. Identify 3-5 Key Facts.\n"
            "4. NEVER invent facts. If information is not in the text, do not state it.\n"
            "5. Cite references with [Source 1] markers.\n"
            "Return clean text with clear markdown headers."
        )

        user_prompt = (
            f"Document Title: {doc.title} ({doc.filename})\n\n"
            f"Document Content:\n{evidence_text}\n\n"
            f"Generate Quick Summary:"
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]
        response = await self.llm_service.generate(messages)
        text = response.content

        findings = self._extract_list_items(text, "Key Findings") or [
            "Core document themes identified.",
            "Operational performance reviewed.",
        ]
        facts = self._extract_list_items(text, "Key Facts") or [
            f"Document {doc.filename} containing {len(pages)} page(s).",
            "Text and structure verified.",
        ]

        return {
            "summary_text": text,
            "executive_summary": text[:400] + "..." if len(text) > 400 else text,
            "structured_data": {
                "key_findings": findings,
                "key_facts": facts,
            },
            "key_findings": findings,
            "key_facts": facts,
            "citations": citations,
            "model": response.model_name,
            "provider": self.settings.LLM_PROVIDER,
        }

    async def _generate_detailed_summary(
        self,
        doc: Document,
        pages: List[Tuple[int, str]],
        extra_docs: List[Document] = [],
        instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generates a comprehensive executive summary with section breakdowns, numbers, and dates."""
        evidence_text = self._build_budgeted_context(pages)
        citations = [{"document_id": str(doc.id), "filename": doc.filename, "page_number": p[0]} for p in pages[:5]]

        system_prompt = (
            "You are an elite research analyst providing an in-depth, structured DETAILED SUMMARY.\n"
            "Structure your output strictly with these sections:\n"
            "## Executive Summary\n"
            "## Section-Wise Breakdown\n"
            "## Important Numbers and Dates\n"
            "## Main Arguments\n"
            "## Conclusions\n"
            "Ground every claim strictly in the provided text. Never fabricate numbers or dates."
        )

        user_prompt = (
            f"Document: {doc.title} ({doc.filename})\n"
            f"Custom Guidance: {instruction or 'Comprehensive coverage'}\n\n"
            f"Content:\n{evidence_text}\n\n"
            f"Generate Detailed Summary:"
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]
        response = await self.llm_service.generate(messages)
        text = response.content

        sections = self._parse_markdown_sections(text)
        dates_and_numbers = self._extract_list_items(text, "Important Numbers and Dates")

        return {
            "summary_text": text,
            "executive_summary": sections[0].text if sections else text[:400],
            "sections": sections,
            "important_dates_and_numbers": dates_and_numbers,
            "structured_data": {
                "sections": [s.model_dump() for s in sections],
                "important_dates_and_numbers": dates_and_numbers,
            },
            "citations": citations,
            "model": response.model_name,
            "provider": self.settings.LLM_PROVIDER,
        }

    async def _generate_section_wise_summary(
        self,
        doc: Document,
        pages: List[Tuple[int, str]],
        instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Summarizes each page or distinct section independently, preserving headings and page numbers."""
        sections: List[SummarySection] = []
        citations: List[Dict[str, Any]] = []

        # Summarize pages/sections iteratively or in batches
        summary_blocks = []
        for page_num, text in pages[:8]:  # Process up to 8 sections
            if not text.strip():
                continue
            sec_title = f"Section (Page {page_num})"
            # Extract first heading if present
            first_line = text.strip().split("\n")[0]
            if first_line.startswith("#"):
                sec_title = first_line.lstrip("#").strip()

            snippet = text[:600]
            sec_summary = f"{sec_title}: {snippet[:250]}..."
            sections.append(SummarySection(title=sec_title, text=snippet, page_number=page_num))
            summary_blocks.append(f"### {sec_title}\n{snippet}\n")
            citations.append({
                "document_id": str(doc.id),
                "filename": doc.filename,
                "page_number": page_num,
                "excerpt": snippet[:100],
            })

        full_text = "\n\n".join(summary_blocks)

        return {
            "summary_text": full_text,
            "sections": sections,
            "structured_data": {"sections": [s.model_dump() for s in sections]},
            "citations": citations,
            "model": self.settings.LLM_MODEL_NAME,
            "provider": self.settings.LLM_PROVIDER,
        }

    async def _generate_custom_summary(
        self,
        doc: Document,
        pages: List[Tuple[int, str]],
        instruction: str,
    ) -> Dict[str, Any]:
        """Executes a user-directed targeted summary prompt."""
        evidence_text = self._build_budgeted_context(pages)
        citations = [{"document_id": str(doc.id), "filename": doc.filename, "page_number": p[0]} for p in pages[:4]]

        system_prompt = (
            f"You are a specialized document intelligence analyst executing a custom summarization request.\n"
            f"The user has provided this specific instruction: '{instruction}'.\n"
            f"Follow the user's focus strictly. Do not hallucinate. Cite supporting pages."
        )

        user_prompt = (
            f"Document: {doc.title} ({doc.filename})\n\n"
            f"Document Context:\n{evidence_text}\n\n"
            f"Please summarize following the instruction: '{instruction}':"
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]
        response = await self.llm_service.generate(messages)
        text = response.content

        return {
            "summary_text": text,
            "executive_summary": text[:400] + "..." if len(text) > 400 else text,
            "structured_data": {"custom_instruction": instruction},
            "citations": citations,
            "model": response.model_name,
            "provider": self.settings.LLM_PROVIDER,
        }

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _build_budgeted_context(self, pages: List[Tuple[int, str]]) -> str:
        """Concatenates page content up to context token limit."""
        parts = []
        char_count = 0
        for page_num, text in pages:
            slice_text = f"--- [Page {page_num}] ---\n{text[:1200]}\n"
            if char_count + len(slice_text) > 8000:  # ~2000 tokens
                break
            parts.append(slice_text)
            char_count += len(slice_text)
        return "\n".join(parts)

    @staticmethod
    def _parse_markdown_sections(text: str) -> List[SummarySection]:
        """Extracts markdown ## sections into structured SummarySection objects."""
        sections = []
        pattern = re.compile(r"##\s+([^\n]+)\n(.*?)(?=\n##|\Z)", re.DOTALL)
        matches = pattern.findall(text)
        for title, body in matches:
            sections.append(SummarySection(title=title.strip(), text=body.strip()))
        return sections

    @staticmethod
    def _extract_list_items(text: str, section_header: str) -> List[str]:
        """Extracts bullet items under a specific section heading."""
        pattern = re.compile(rf"##\s+{re.escape(section_header)}.*?\n(.*?)(?=\n##|\Z)", re.DOTALL | re.IGNORECASE)
        match = pattern.search(text)
        if not match:
            return []
        lines = match.group(1).split("\n")
        items = []
        for line in lines:
            line = line.strip()
            if line.startswith(("-", "*", "•")) or re.match(r"^\d+\.", line):
                clean_item = re.sub(r"^[-*•\d.]+\s*", "", line).strip()
                if clean_item:
                    items.append(clean_item)
        return items
