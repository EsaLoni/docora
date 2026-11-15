"""Deadline and Temporal Reference Extraction Service."""

from datetime import datetime, timezone
import re
from typing import List, NamedTuple, Optional, Tuple
from dateutil import parser as date_parser


class ExtractedDeadline(NamedTuple):
    raw_text: str
    parsed_date: Optional[datetime]
    is_explicit: bool
    is_ambiguous: bool
    context: str


class DeadlineExtractionService:
    """Service to extract concrete and relative deadlines from document text."""

    # Patterns for explicit dates: ISO, Month Day Year, Day Month Year, etc.
    EXPLICIT_DATE_PATTERNS = [
        # YYYY-MM-DD or YYYY/MM/DD
        r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b",
        # Month DD, YYYY or Month DD YYYY (e.g., January 15, 2026)
        r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b",
        # DD Month YYYY (e.g., 15 January 2026)
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b",
        # Short month format: Jan 15, 2026 or 15 Jan 2026
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b",
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+\d{4}\b",
        # MM/DD/YYYY or DD/MM/YYYY
        r"\b\d{1,2}/\d{1,2}/\d{4}\b",
    ]

    # Patterns for relative or conditional deadlines
    RELATIVE_DATE_PATTERNS = [
        r"\bwithin\s+(\d+)\s+(days|weeks|months|business\s+days|calendar\s+days)\b.*",
        r"\bno\s+later\s+than\s+(\d+)\s+(days|weeks|months)\b.*",
        r"\bby\s+the\s+end\s+of\s+(each\s+month|the\s+quarter|the\s+year)\b",
        r"\bprior\s+to\s+(?:the\s+)?(expiration|renewal|completion|delivery)\b",
        r"\bupon\s+(execution|receipt|termination|completion|written\s+notice)\b",
        r"\bdue\s+upon\s+receipt\b",
        r"\bnet\s+(\d+)\s+days?\b",
    ]

    def extract_deadlines(self, text: str) -> List[ExtractedDeadline]:
        """Extract all candidate deadlines from input text."""
        results: List[ExtractedDeadline] = []
        if not text:
            return results

        sentences = re.split(r"(?<=[.!?])\s+", text)

        for sentence in sentences:
            sentence_clean = sentence.strip()
            if not sentence_clean:
                continue

            # 1. Search for explicit dates
            for pattern in self.EXPLICIT_DATE_PATTERNS:
                matches = list(re.finditer(pattern, sentence_clean, re.IGNORECASE))
                for match in matches:
                    raw_str = match.group(0)
                    parsed = self._try_parse_date(raw_str)
                    if parsed:
                        results.append(
                            ExtractedDeadline(
                                raw_text=raw_str,
                                parsed_date=parsed,
                                is_explicit=True,
                                is_ambiguous=False,
                                context=sentence_clean,
                            )
                        )

            # 2. Search for relative / conditional expressions
            for pattern in self.RELATIVE_DATE_PATTERNS:
                matches = list(re.finditer(pattern, sentence_clean, re.IGNORECASE))
                for match in matches:
                    raw_str = match.group(0)
                    # For relative dates without explicit anchor, we do NOT invent dates
                    results.append(
                        ExtractedDeadline(
                            raw_text=raw_str,
                            parsed_date=None,
                            is_explicit=False,
                            is_ambiguous=True,
                            context=sentence_clean,
                        )
                    )

        return results

    def _try_parse_date(self, text: str) -> Optional[datetime]:
        """Safely parse a date string into an aware UTC datetime."""
        try:
            # clean ordinal suffixes e.g. 1st, 2nd, 3rd, 4th
            clean_text = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", text)
            dt = date_parser.parse(clean_text, fuzzy=True)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None
