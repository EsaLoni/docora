"""Structured Extraction Service.

Orchestrates template-based and custom-field structured extraction against documents,
validates schemas, records confidence scores, and persists to the extractions table.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.document import Document, DocumentPage
from app.models.extraction import Extraction
from app.services.intelligence.entity import EntityExtractionService
from app.services.intelligence.models import (
    ExtractedFieldItem,
    ExtractionRequest,
    ExtractionResponse,
)
from app.services.llm.service import LLMService

logger = get_logger("intelligence.extraction")

TEMPLATE_FIELD_DEFINITIONS: Dict[str, List[str]] = {
    "invoice": [
        "vendor",
        "invoice_number",
        "invoice_date",
        "due_date",
        "subtotal",
        "tax_amount",
        "total_amount",
        "currency",
        "payment_terms",
    ],
    "contract": [
        "parties",
        "effective_date",
        "expiration_date",
        "contract_value",
        "governing_law",
        "termination_clause",
        "confidentiality_obligations",
        "liability_limit",
    ],
    "financial": [
        "revenue",
        "net_income",
        "operating_expenses",
        "gross_margin",
        "ebitda",
        "cash_flow",
        "fiscal_period",
        "reporting_date",
    ],
    "entities": [
        "organizations",
        "people_names",
        "dates_and_deadlines",
        "monetary_values",
        "contact_info",
        "addresses",
        "action_items",
    ],
}


class StructuredExtractionService:
    """Manages high-fidelity structured data extraction across documents."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        llm_service: Optional[LLMService] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm_service = llm_service or LLMService(settings=self.settings)
        self.entity_service = EntityExtractionService(llm_service=self.llm_service)

    async def extract_document(
        self,
        request: ExtractionRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> ExtractionResponse:
        """Executes structured extraction, builds citations, and persists to the extractions table."""
        # 1. Fetch and verify document in workspace
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

        # 2. Fetch document pages
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
            raise ValueError(f"Document {request.document_id} has no extracted text pages.")

        pages_content: List[Tuple[int, str]] = [
            (p.page_number, p.content or "") for p in pages
        ]

        # 3. Determine fields to extract
        template = request.template or "entities"
        if request.custom_fields and len(request.custom_fields) > 0:
            target_fields = request.custom_fields
            extraction_type = "custom"
        else:
            target_fields = TEMPLATE_FIELD_DEFINITIONS.get(template, TEMPLATE_FIELD_DEFINITIONS["entities"])
            extraction_type = template

        # 4. Extract regex patterns first (for deterministic fast-path)
        regex_items = self.entity_service.extract_regex_entities(
            pages_content, doc_filename=document.filename
        )

        # 5. Extract semantic fields via LLM
        semantic_items, missing_fields = await self.entity_service.extract_semantic_fields(
            pages_content, target_fields, doc_filename=document.filename
        )

        # Merge results, prioritizing non-null semantic extractions
        combined_fields: List[ExtractedFieldItem] = []
        covered_names = set()

        for item in semantic_items:
            combined_fields.append(item)
            covered_names.add(item.field_name.lower())

        # If general entities requested, include regex matches not already covered
        if template == "entities":
            for reg in regex_items:
                if reg.field_name.lower() not in covered_names:
                    combined_fields.append(reg)
                    covered_names.add(reg.field_name.lower())

        # Build citations mapping
        citations = []
        for item in combined_fields:
            if item.value is not None and item.page_number is not None:
                citations.append({
                    "field_name": item.field_name,
                    "document_id": str(document.id),
                    "filename": document.filename,
                    "page_number": item.page_number,
                    "excerpt": item.supporting_text,
                    "confidence": item.confidence,
                })

        # Calculate average confidence
        valid_confs = [f.confidence for f in combined_fields if f.value is not None]
        avg_confidence = (sum(valid_confs) / len(valid_confs)) if valid_confs else 0.85

        # 6. Persist to existing extractions table
        extraction_record = Extraction(
            workspace_id=workspace_id,
            document_id=document.id,
            extraction_type=extraction_type,
            schema_definition={"requested_fields": target_fields, "template": template},
            extracted_data={
                "fields": [f.model_dump() for f in combined_fields],
                "missing_fields": missing_fields,
                "citations": citations,
            },
            confidence_score=avg_confidence,
            status="COMPLETED",
            created_at=datetime.now(timezone.utc),
        )
        db.add(extraction_record)
        await db.commit()
        await db.refresh(extraction_record)

        return ExtractionResponse(
            id=str(extraction_record.id),
            document_id=str(document.id),
            extraction_type=extraction_type,
            fields=combined_fields,
            missing_fields=missing_fields,
            citations=citations,
            created_at=extraction_record.created_at.isoformat(),
        )

    async def get_extractions_for_document(
        self,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> List[ExtractionResponse]:
        """Fetches historical extractions for a given document."""
        stmt = (
            select(Extraction)
            .where(
                Extraction.document_id == document_id,
                Extraction.workspace_id == workspace_id,
            )
            .order_by(Extraction.created_at.desc())
        )
        records = (await db.execute(stmt)).scalars().all()
        results = []
        for rec in records:
            data = rec.extracted_data or {}
            fields_data = [ExtractedFieldItem(**f) for f in data.get("fields", [])]
            results.append(
                ExtractionResponse(
                    id=str(rec.id),
                    document_id=str(rec.document_id),
                    extraction_type=rec.extraction_type,
                    fields=fields_data,
                    missing_fields=data.get("missing_fields", []),
                    citations=data.get("citations", []),
                    created_at=rec.created_at.isoformat(),
                )
            )
        return results
