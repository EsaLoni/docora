"""Document-Driven Action Discovery Service.

Scans document pages for actionable commitments, deadlines, renewals, and obligations,
and creates candidate ActionSuggestions for user review.
"""

from datetime import datetime, timezone
import json
import re
from typing import List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.action import ActionSuggestion
from app.models.document import Document, DocumentPage
from app.services.actions.deadline_extractor import DeadlineExtractionService, ExtractedDeadline
from app.services.actions.models import (
    ActionDiscoveryResult,
    DiscoveredActionItem,
    SuggestionCategory,
)
from app.services.actions.obligation_extractor import ObligationExtractionService
from app.services.llm.models import LLMMessage
from app.services.llm.service import LLMService

logger = get_logger("services.actions.discovery")


class ActionDiscoveryService:
    """Discovers action items, deadlines, and obligations from document pages."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        llm_service: Optional[LLMService] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm_service = llm_service or LLMService(settings=self.settings)
        self.deadline_extractor = DeadlineExtractionService()
        self.obligation_extractor = ObligationExtractionService()

    async def discover_actions_for_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        persist: bool = True,
    ) -> ActionDiscoveryResult:
        """Scan document pages and produce candidate action suggestions."""
        # 1. Fetch document and pages
        doc_stmt = select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
        document = (await db.execute(doc_stmt)).scalar_one_or_none()
        if not document:
            raise ValueError(f"Document {document_id} not found in workspace {workspace_id}")

        pages_stmt = (
            select(DocumentPage)
            .where(DocumentPage.document_id == document_id)
            .order_by(DocumentPage.page_number.asc())
        )
        pages = (await db.execute(pages_stmt)).scalars().all()

        discovered: List[DiscoveredActionItem] = []

        # 2. Try LLM-based discovery if available, or fallback to heuristic engine
        for page in pages:
            page_text = page.content or ""
            if not page_text.strip():
                continue

            page_items = await self._discover_from_page(page.page_number, page_text)
            discovered.extend(page_items)

        # If no pages exist but document has text or title, run heuristics on whatever is available
        if not discovered and not pages:
            fallback_items = await self._discover_from_page(1, document.title)
            discovered.extend(fallback_items)

        # 3. Persist suggestions in database if requested
        if persist and discovered:
            for item in discovered:
                # Check for existing identical suggestion on this doc and page to avoid duplication
                existing_stmt = select(ActionSuggestion).where(
                    ActionSuggestion.workspace_id == workspace_id,
                    ActionSuggestion.document_id == document_id,
                    ActionSuggestion.title == item.title,
                    ActionSuggestion.page_number == item.page_number,
                )
                existing = (await db.execute(existing_stmt)).scalar_one_or_none()
                if not existing:
                    suggestion = ActionSuggestion(
                        workspace_id=workspace_id,
                        document_id=document_id,
                        page_number=item.page_number,
                        title=item.title,
                        description=item.description,
                        proposed_due_date=item.proposed_due_date,
                        is_date_explicit=item.is_date_explicit,
                        category=item.category.value,
                        evidence_text=item.evidence_text,
                        confidence_score=item.confidence_score,
                        status="suggested",
                    )
                    db.add(suggestion)

            await db.commit()

        return ActionDiscoveryResult(
            document_id=document_id,
            total_discovered=len(discovered),
            suggestions=discovered,
        )

    async def _discover_from_page(
        self, page_number: int, page_text: str
    ) -> List[DiscoveredActionItem]:
        """Extract candidates from a single page using both LLM and heuristic analysis."""
        candidates: List[DiscoveredActionItem] = []

        # First, attempt LLM-assisted extraction if configured
        try:
            llm_candidates = await self._discover_with_llm(page_number, page_text)
            if llm_candidates:
                return llm_candidates
        except Exception as e:
            logger.warning("LLM discovery failed, falling back to heuristic engine: %s", e)

        # Heuristic fallback using deadline and obligation extractors
        deadlines = self.deadline_extractor.extract_deadlines(page_text)
        obligations = self.obligation_extractor.extract_obligations(page_text)

        # Match obligations with nearby deadlines
        if obligations:
            for obl in obligations:
                matched_deadline: Optional[ExtractedDeadline] = None
                for dl in deadlines:
                    if dl.raw_text in obl.evidence_text or obl.evidence_text in dl.context:
                        matched_deadline = dl
                        break

                due_date = matched_deadline.parsed_date if matched_deadline else None
                is_explicit = matched_deadline.is_explicit if matched_deadline else False

                candidates.append(
                    DiscoveredActionItem(
                        title=obl.title,
                        description=obl.description,
                        proposed_due_date=due_date,
                        is_date_explicit=is_explicit,
                        category=obl.category,
                        evidence_text=obl.evidence_text,
                        confidence_score=obl.confidence_score,
                        page_number=page_number,
                    )
                )

        # If deadlines found without matched obligations, create deadline action items
        for dl in deadlines:
            # Check if this deadline was already used in an obligation
            already_used = any(dl.raw_text in c.evidence_text for c in candidates)
            if not already_used:
                title = f"Deadline: {dl.raw_text}"
                candidates.append(
                    DiscoveredActionItem(
                        title=title,
                        description=dl.context,
                        proposed_due_date=dl.parsed_date,
                        is_date_explicit=dl.is_explicit,
                        category=SuggestionCategory.PAYMENT_DEADLINE if any(w in dl.context.lower() for w in ["pay", "invoice", "fee"]) else SuggestionCategory.OBLIGATION,
                        evidence_text=dl.context,
                        confidence_score=0.88 if dl.is_explicit else 0.70,
                        page_number=page_number,
                    )
                )

        return candidates

    async def _discover_with_llm(
        self, page_number: int, page_text: str
    ) -> List[DiscoveredActionItem]:
        """Ask LLM to identify structured action items from page text."""
        prompt = (
            "Analyze the following text extracted from a document. Identify all explicit commitments, "
            "deadlines, renewal dates, payment due dates, and actionable obligations.\n\n"
            "Respond ONLY with a JSON array of objects with these keys:\n"
            '- "title": concise action title (max 70 chars)\n'
            '- "description": description of requirement\n'
            '- "due_date": ISO date string (YYYY-MM-DD) if explicit, or null\n'
            '- "is_date_explicit": boolean (true if exact date mentioned, false if relative/implied)\n'
            '- "category": one of ["payment_deadline", "renewal_date", "expiration", "compliance", "meeting", "delivery", "approval", "follow_up", "obligation", "other"]\n'
            '- "evidence_text": exact quote from the text that proves this obligation\n'
            '- "confidence_score": float between 0.0 and 1.0\n\n'
            f"Text:\n{page_text[:3000]}\n\n"
            "JSON:"
        )

        messages = [
            LLMMessage(
                role="system",
                content="You are an expert legal, financial, and business document analyst. You identify obligations, deadlines, and action items with zero hallucination.",
            ),
            LLMMessage(role="user", content=prompt),
        ]
        response = await self.llm_service.generate(
            messages=messages,
            temperature=0.0,
            max_tokens=1000,
        )

        content = response.content.strip()
        # Look for JSON array in response
        json_match = re.search(r"\[.*\]", content, re.DOTALL)
        if not json_match:
            return []

        raw_items = json.loads(json_match.group(0))
        items: List[DiscoveredActionItem] = []
        for raw in raw_items:
            parsed_date = None
            if raw.get("due_date"):
                try:
                    dt = datetime.fromisoformat(raw["due_date"])
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    parsed_date = dt
                except Exception:
                    parsed_date = None

            category_val = raw.get("category", "obligation")
            try:
                category = SuggestionCategory(category_val)
            except ValueError:
                category = SuggestionCategory.OBLIGATION

            items.append(
                DiscoveredActionItem(
                    title=raw.get("title", "Action Item"),
                    description=raw.get("description"),
                    proposed_due_date=parsed_date,
                    is_date_explicit=bool(raw.get("is_date_explicit", False)),
                    category=category,
                    evidence_text=raw.get("evidence_text", page_text[:200]),
                    confidence_score=float(raw.get("confidence_score", 0.9)),
                    page_number=page_number,
                )
            )

        return items
