"""Contractual and Regulatory Obligation Extraction Service."""

import re
from typing import List, NamedTuple, Optional
from app.services.actions.models import SuggestionCategory


class ExtractedObligation(NamedTuple):
    title: str
    description: str
    category: SuggestionCategory
    party: Optional[str]
    evidence_text: str
    confidence_score: float


class ObligationExtractionService:
    """Service to identify commitments, mandates, and duties from document text."""

    OBLIGATION_PATTERNS = [
        # (Regex pattern, default category, confidence)
        (
            r"\b(?:(?:shall\s+(?:remit\s+payment|pay)|must\s+pay)|(?:payment|invoice|fee|amount)\s+(?:of\s+[\$€£]?\d+(?:,\d{3})*(?:\.\d+)?\s+)?(?:shall|must|is\s+due|will\s+be\s+paid|due))\b.*",
            SuggestionCategory.PAYMENT_DEADLINE,
            0.95,
        ),
        (
            r"\b(?:this\s+agreement|contract|subscription|license)\s+(?:shall\s+renew|renews|expires|terminates)\b.*",
            SuggestionCategory.RENEWAL_DATE,
            0.92,
        ),
        (
            r"\b(?:compliance|audit|regulatory|filing|tax\s+return|report)\s+(?:must\s+be|shall\s+be|is\s+required\s+to\s+be)\s+(?:submitted|filed|completed)\b.*",
            SuggestionCategory.COMPLIANCE,
            0.90,
        ),
        (
            r"\b(?:deliverable|shipment|goods|services|software)\s+(?:shall|must|will)\s+be\s+(?:delivered|provided|furnished|completed)\b.*",
            SuggestionCategory.DELIVERY,
            0.88,
        ),
        (
            r"\b(?:written\s+approval|consent|authorization)\s+(?:is\s+required|must\s+be\s+obtained|shall\s+be\s+provided)\b.*",
            SuggestionCategory.APPROVAL,
            0.85,
        ),
        (
            r"\b(?:parties|customer|client|vendor|provider|tenant|landlord|contractor|party\s+[ab])\s+(?:shall|must|agrees\s+to|is\s+obligated\s+to|covenants\s+to)\s+([^.!?]+)[.!?]",
            SuggestionCategory.OBLIGATION,
            0.85,
        ),
    ]

    def extract_obligations(self, text: str) -> List[ExtractedObligation]:
        """Extract actionable obligations from text."""
        obligations: List[ExtractedObligation] = []
        if not text:
            return obligations

        # Scan text for obligation patterns
        for pattern, category, confidence in self.OBLIGATION_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                evidence = match.group(0).strip()
                # Clean up extracted snippet
                clean_sentence = re.sub(r"\s+", " ", evidence)
                
                # Derive title
                title = clean_sentence[:70].strip()
                if len(clean_sentence) > 70:
                    title += "..."

                # Extract party if available
                party = None
                party_match = re.search(r"\b(Customer|Client|Vendor|Provider|Tenant|Landlord|Contractor|Party\s+[AB])\b", clean_sentence, re.IGNORECASE)
                if party_match:
                    party = party_match.group(1).title()

                obligations.append(
                    ExtractedObligation(
                        title=title,
                        description=clean_sentence,
                        category=category,
                        party=party,
                        evidence_text=clean_sentence,
                        confidence_score=confidence,
                    )
                )

        return obligations
