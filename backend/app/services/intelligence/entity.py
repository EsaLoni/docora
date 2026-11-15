"""Entity & Structured Information Extraction Service.

Extracts named entities, dates, monetary amounts, identifiers, obligations,
clauses, risks, and custom user-specified fields.
Preserves original currency, units, and page-level source references.
Never fabricates missing values (maps missing to null).
"""

import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from app.core.logging import get_logger
from app.services.intelligence.models import ExtractedFieldItem
from app.services.llm.models import LLMMessage
from app.services.llm.service import LLMService

logger = get_logger("intelligence.entity")

# Deterministic regex patterns for standard data entities
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
DATE_REGEX = re.compile(
    r"\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b",
    re.IGNORECASE,
)
CURRENCY_REGEX = re.compile(
    r"(?:[\$\€\£\₹]|USD|EUR|GBP|INR)\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|INR|dollars|cents)\b",
    re.IGNORECASE,
)
INVOICE_NUM_REGEX = re.compile(
    r"\b(?:invoice\s*(?:#|no\.?|num|number)?[:\s]*)([A-Z0-9\-_/]+)\b", re.IGNORECASE
)
CONTRACT_ID_REGEX = re.compile(
    r"\b(?:contract\s*(?:#|no\.?|id|agreement)?[:\s]*)([A-Z0-9\-_/]+)\b", re.IGNORECASE
)


class EntityExtractionService:
    """Extracts typed entities, standard patterns, and custom fields from document pages."""

    def __init__(self, llm_service: Optional[LLMService] = None) -> None:
        self.llm_service = llm_service or LLMService()

    def extract_regex_entities(
        self,
        pages_content: List[Tuple[int, str]],
        doc_filename: str = "",
    ) -> List[ExtractedFieldItem]:
        """Performs fast deterministic pattern extraction across all document pages."""
        items: List[ExtractedFieldItem] = []
        seen: Set[Tuple[str, str]] = set()

        for page_num, text in pages_content:
            # 1. Emails
            for email in EMAIL_REGEX.findall(text):
                key = ("email", email.lower())
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="email",
                            value=email,
                            data_type="email",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, email),
                            confidence=0.99,
                            status="verified",
                        )
                    )

            # 2. Phones
            for phone in PHONE_REGEX.findall(text):
                key = ("phone", phone)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="phone_number",
                            value=phone,
                            data_type="phone",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, phone),
                            confidence=0.95,
                            status="verified",
                        )
                    )

            # 3. Dates
            for dt in DATE_REGEX.findall(text):
                key = ("date", dt)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="date",
                            value=dt,
                            data_type="date",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, dt),
                            confidence=0.95,
                            status="verified",
                        )
                    )

            # 4. Monetary amounts
            for curr in CURRENCY_REGEX.findall(text):
                key = ("monetary", curr)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="monetary_amount",
                            value=curr,
                            data_type="monetary",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, curr),
                            confidence=0.95,
                            status="verified",
                        )
                    )

            # 5. Invoices
            for match in INVOICE_NUM_REGEX.finditer(text):
                inv_no = match.group(1)
                key = ("invoice_number", inv_no)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="invoice_number",
                            value=inv_no,
                            data_type="string",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, inv_no),
                            confidence=0.98,
                            status="verified",
                        )
                    )

            # 6. Contract ID
            for match in CONTRACT_ID_REGEX.finditer(text):
                c_id = match.group(1)
                key = ("contract_id", c_id)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ExtractedFieldItem(
                            field_name="contract_identifier",
                            value=c_id,
                            data_type="string",
                            source_document=doc_filename,
                            page_number=page_num,
                            supporting_text=self._extract_surrounding_excerpt(text, c_id),
                            confidence=0.98,
                            status="verified",
                        )
                    )

        return items

    async def extract_semantic_fields(
        self,
        pages_content: List[Tuple[int, str]],
        fields_to_extract: List[str],
        doc_filename: str = "",
    ) -> Tuple[List[ExtractedFieldItem], List[str]]:
        """Uses LLM with strict JSON schema instructions to extract complex or custom fields."""
        # Format document context with page identifiers
        context_parts = []
        for page_num, text in pages_content[:10]:  # Up to 10 pages for extraction context
            context_parts.append(f"--- [Page {page_num}] ---\n{text[:1500]}\n")
        context_str = "\n".join(context_parts)

        system_prompt = (
            "You are a precision structured document information extraction engine.\n"
            "Extract the requested fields from the provided document pages.\n"
            "CRITICAL RULES:\n"
            "1. NEVER fabricate, hallucinate, or assume missing values.\n"
            "2. If a field is not explicitly present in the document, set its value to null.\n"
            "3. Preserve original currency symbols, units, and date formatting.\n"
            "4. Provide the exact source page number where the value was found.\n"
            "5. Provide an exact short quote excerpt (under 120 chars) proving the extraction.\n"
            "6. Output MUST be a valid JSON object matching this schema:\n"
            "{\n"
            '  "fields": [\n'
            '    {\n'
            '      "field_name": "string",\n'
            '      "value": "string or number or null",\n'
            '      "data_type": "string",\n'
            '      "page_number": 1,\n'
            '      "quote_excerpt": "string or null",\n'
            '      "confidence": 0.95\n'
            '    }\n'
            '  ],\n'
            '  "missing_fields": ["field_name_1"]\n'
            "}"
        )

        user_prompt = (
            f"Document: {doc_filename}\n"
            f"Fields to extract: {', '.join(fields_to_extract)}\n\n"
            f"Document Content:\n{context_str}\n\n"
            f"Return valid JSON only."
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]

        response = await self.llm_service.generate(messages)
        return self._parse_extraction_response(response.content, fields_to_extract, doc_filename)

    def _parse_extraction_response(
        self,
        raw_output: str,
        requested_fields: List[str],
        doc_filename: str,
    ) -> Tuple[List[ExtractedFieldItem], List[str]]:
        """Safely parses JSON extraction response with fallback for malformed models."""
        extracted_items: List[ExtractedFieldItem] = []
        missing_fields: List[str] = []

        try:
            # Strip markdown code blocks if present
            cleaned = raw_output.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)

            data = json.loads(cleaned)
            fields_data = data.get("fields", [])
            missing_fields = data.get("missing_fields", [])

            extracted_names = set()
            for f in fields_data:
                name = str(f.get("field_name", "")).strip()
                val = f.get("value")
                page_no = f.get("page_number")
                quote = f.get("quote_excerpt")
                conf = float(f.get("confidence", 0.9))
                dtype = str(f.get("data_type", "string"))

                extracted_names.add(name.lower())
                if val is None or str(val).lower() in ["null", "none", "n/a", ""]:
                    val = None
                    dtype = "null"
                    if name and name not in missing_fields:
                        missing_fields.append(name)

                extracted_items.append(
                    ExtractedFieldItem(
                        field_name=name,
                        value=val,
                        data_type=dtype,
                        source_document=doc_filename,
                        page_number=page_no,
                        supporting_text=quote,
                        confidence=conf if val is not None else 0.0,
                        status="verified" if val is not None else "missing",
                    )
                )

            # Ensure any requested field missing from model output is marked missing
            for req in requested_fields:
                if req.lower() not in extracted_names and req not in missing_fields:
                    missing_fields.append(req)
                    extracted_items.append(
                        ExtractedFieldItem(
                            field_name=req,
                            value=None,
                            data_type="null",
                            source_document=doc_filename,
                            page_number=None,
                            supporting_text=None,
                            confidence=0.0,
                            status="missing",
                        )
                    )

        except Exception as e:
            logger.warning("Failed to parse JSON extraction output: %s. Using resilient fallback.", e)
            for req in requested_fields:
                missing_fields.append(req)
                extracted_items.append(
                    ExtractedFieldItem(
                        field_name=req,
                        value=None,
                        data_type="null",
                        source_document=doc_filename,
                        page_number=None,
                        supporting_text=None,
                        confidence=0.0,
                        status="missing",
                    )
                )

        return extracted_items, missing_fields

    @staticmethod
    def _extract_surrounding_excerpt(text: str, target: str, window: int = 50) -> str:
        """Finds target in text and returns excerpt with surrounding context."""
        idx = text.find(target)
        if idx == -1:
            return target
        start = max(0, idx - window)
        end = min(len(text), idx + len(target) + window)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(text) else ""
        return f"{prefix}{text[start:end].strip()}{suffix}"
