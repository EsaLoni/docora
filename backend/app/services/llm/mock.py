"""Deterministic Mock LLM Provider — Extractive Grounded Answerer.

Returns verbatim text extracted from the document evidence chunks provided in
the system prompt.  No internet, no API keys required.

Strategy:
  1. Parse [Source N] blocks from the system prompt.
  2. For each question, find the most relevant sentences/lines from the chunks.
  3. Return them verbatim with [Source N] citations.
  4. Never return generic template text — always quote the actual document.
"""

import asyncio
import json as _json
import re
from typing import Any, AsyncGenerator, List, Optional, Tuple

from app.services.llm.base import (
    BaseLLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services.llm.models import LLMMessage, LLMResponse, LLMStreamChunk


# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

_SOURCE_BLOCK_RE = re.compile(
    r"\[Source (\d+)\][ \t]*(?:\([^\)]*\))?[ \t]*:?[ \t]*\n?([\s\S]*?)(?=(?:\[Source \d+\]|$))"
)

STOPWORDS = frozenset({
    "what", "is", "the", "are", "when", "where", "who", "which", "how",
    "much", "many", "does", "do", "did", "can", "could", "would", "should",
    "tell", "me", "about", "in", "on", "at", "to", "for", "of", "with",
    "a", "an", "and", "or", "by", "from", "that", "this", "its", "it",
    "be", "was", "were", "been", "being", "have", "has", "had", "having",
    "i", "you", "he", "she", "we", "they", "my", "your", "our", "their",
    "his", "her", "us", "them", "please", "give", "find", "show", "list",
})


def _parse_source_blocks(system_content: str) -> List[Tuple[str, str]]:
    """Return [(source_num, chunk_text), ...] from the DOCUMENT EVIDENCE section only."""
    # The system prompt has a "DOCUMENT EVIDENCE:" marker separating instructions
    # from actual chunk content.  Only parse blocks after that marker to avoid
    # matching "[Source 1]" examples embedded in the prompt template.
    evidence_marker = "DOCUMENT EVIDENCE:"
    marker_pos = system_content.find(evidence_marker)
    if marker_pos != -1:
        evidence_section = system_content[marker_pos + len(evidence_marker):]
    else:
        evidence_section = system_content
    return _SOURCE_BLOCK_RE.findall(evidence_section)


def _split_into_lines(text: str) -> List[str]:
    """Split text into meaningful lines/sentences."""
    raw = re.split(r'\n+', text)
    lines: List[str] = []
    for r in raw:
        r = r.strip()
        if not r or len(r) < 3:
            continue
        # Skip separators
        if re.fullmatch(r'[-=_*]{2,}', r):
            continue
        # Further split very long lines at sentence boundaries
        if len(r) > 200:
            sents = re.split(r'(?<=[.!?])\s+', r)
            lines.extend(s.strip() for s in sents if s.strip() and len(s.strip()) >= 3)
        else:
            lines.append(r)
    return lines


def _extract_keywords(question: str) -> List[str]:
    """Extract meaningful keywords from the user question."""
    words = re.findall(r'\b[a-zA-Z0-9@._\-]+\b', question.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def _question_intent(q_lower: str) -> str:
    """Classify the question into a broad intent category."""
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["name", "who am i", "who is", "whose"]):
        return "name"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["email", "e-mail"]):
        return "email"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["phone", "mobile", "cellphone", "contact number", "telephone"]):
        return "phone"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["address", "location", "city", "country"]):
        return "location"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["education", "degree", "university", "college", "school", "qualification"]):
        return "education"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["experience", "work", "job", "company", "employer", "position", "role"]):
        return "experience"
    if any(w in q_lower for w in ["skill", "technology", "proficien", "expertise", "tools", "languages"]):
        return "skills"
    if any(w in q_lower for w in ["summary", "summar", "overview", "about", "profile", "objective"]):
        return "summary"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["date", "when", "deadline", "due", "renewal", "expir"]):
        return "date"
    if any(re.search(rf"\b{re.escape(w)}\b", q_lower) for w in ["amount", "cost", "price", "total", "fee", "salary", "revenue", "profit", "budget"]):
        return "money"
    if any(w in q_lower for w in ["conflict", "differ", "discrepanc", "contradict"]):
        return "conflict"
    return "general"


def _score_line_for_intent(line: str, intent: str, keywords: List[str]) -> int:
    """Score a line's relevance to the question."""
    line_lower = line.lower()
    score = 0

    # Keyword overlap scoring
    for kw in keywords:
        if kw in line_lower:
            score += 10

    # Intent-specific boosting
    if intent == "name":
        # Lines that look like they contain a person's name
        # Typically at the top of a CV: a line with 2-4 capitalized words, no verbs
        if re.search(r'^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$', line.strip()):
            score += 50  # Very likely a person's name
        if re.search(r'\bname\s*[:\-–]\s*', line_lower):
            score += 40
        # Lines with "Mr.", "Mrs.", "Dr.", etc.
        if re.search(r'\b(mr|mrs|ms|dr|prof)\.?\s+[A-Z]', line, re.IGNORECASE):
            score += 35
        # Check for name-like patterns (capitalized words not common English words)
        caps = re.findall(r'\b[A-Z][a-z]{1,15}\b', line)
        common_caps = {"the", "and", "for", "but", "not", "you", "all", "can",
                       "had", "her", "was", "one", "our", "out", "are", "has",
                       "his", "how", "its", "may", "new", "now", "old", "see",
                       "way", "who", "did", "get", "let", "say", "she", "too",
                       "use", "page", "document", "source", "section", "chunk",
                       "summary", "experience", "education", "skills", "project",
                       "professional", "objective", "profile", "about", "contact",
                       "details", "information", "personal", "resume", "curriculum",
                       "vitae"}
        name_caps = [c for c in caps if c.lower() not in common_caps]
        if name_caps and len(line.split()) <= 6:
            score += 30

    elif intent == "email":
        if re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', line):
            score += 50

    elif intent == "phone":
        if re.search(r'[\+]?[\d\s\-\(\)]{7,15}', line):
            score += 40

    elif intent == "location":
        if re.search(r'\b(address|city|state|country|location|zip|pin)\b', line_lower):
            score += 30

    elif intent == "education":
        if re.search(r'\b(b\.?tech|m\.?tech|b\.?sc|m\.?sc|b\.?a|m\.?a|ph\.?d|bachelor|master|diploma|degree|university|college|school|institute)\b', line_lower):
            score += 30

    elif intent == "experience":
        if re.search(r'\b(developer|engineer|manager|analyst|designer|intern|consultant|lead|senior|junior|associate)\b', line_lower):
            score += 20
        if re.search(r'\b(20\d{2})\b', line):
            score += 10

    elif intent == "skills":
        if re.search(r'\b(python|java|javascript|react|node|sql|html|css|c\+\+|typescript|angular|vue|django|flask|docker|kubernetes|aws|azure|git)\b', line_lower):
            score += 25

    elif intent == "date":
        if re.search(r'\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}/\d{1,2}/\d{2,4})\b', line_lower):
            score += 25

    elif intent == "money":
        if re.search(r'(\$|€|£|₹|usd|inr|eur|\bpercent\b|%|\b\d+,\d{3}\b)', line_lower):
            score += 25

    return score


# ────────────────────────────────────────────────────────────────
# Main provider
# ────────────────────────────────────────────────────────────────

class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider — extracts and returns verbatim document content."""

    def __init__(
        self,
        model_name: str = "mock-grounded-llm",
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
        simulate_timeout: bool = False,
        simulate_rate_limit: bool = False,
        simulate_error: bool = False,
    ) -> None:
        super().__init__(
            model_name=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        self.simulate_timeout = simulate_timeout
        self.simulate_rate_limit = simulate_rate_limit
        self.simulate_error = simulate_error

    def validate_credentials(self) -> bool:
        return True

    # ── Special-purpose handlers (structured JSON for intelligence services) ──

    def _handle_structured_extraction(self, system_content: str, user_content: str) -> Optional[str]:
        """Handle structured JSON extraction requests from intelligence services."""
        sys_lower = system_content.lower()
        user_lower = user_content.lower()

        # Structured field extraction
        if "structured document information extraction" in sys_lower or ("fields to extract" in user_lower and "json" in sys_lower):
            req_match = re.search(r"Fields to extract:\s*([^\n]+)", user_content)
            req_field_names = [f.strip() for f in req_match.group(1).split(",")] if req_match else ["vendor", "total_amount", "invoice_number"]
            blocks = _parse_source_blocks(system_content)

            # Try to extract real values from the document content (search evidence blocks, system prompt, and user prompt)
            all_text = ("\n".join(body for _, body in blocks) if blocks else "") + "\n" + system_content + "\n" + user_content
            fields = []
            missing = []

            for rf in req_field_names:
                rf_clean = rf.strip()
                if not rf_clean:
                    continue
                # Try to find the value in the actual document text
                value, quote, page = self._find_field_value(rf_clean, all_text, blocks)
                if value:
                    fields.append({
                        "field_name": rf_clean,
                        "value": value,
                        "data_type": "string",
                        "page_number": page,
                        "quote_excerpt": quote,
                        "confidence": 0.92,
                    })
                else:
                    fields.append({
                        "field_name": rf_clean,
                        "value": None,
                        "data_type": "null",
                        "page_number": None,
                        "quote_excerpt": None,
                        "confidence": 0.0,
                    })
                    missing.append(rf_clean)

            return _json.dumps({"fields": fields, "missing_fields": missing}, indent=2)

        # Multi-document comparison
        if "document comparison and discrepancy detection" in sys_lower or ("comparison type:" in user_lower and "return json" in user_lower):
            blocks = _parse_source_blocks(system_content)
            # Extract first few lines from each source as comparison material
            doc_summaries = []
            for src_num, body in blocks[:2]:
                lines = _split_into_lines(body)[:5]
                doc_summaries.append({"source": src_num, "lines": lines})

            summary_a = " ".join(doc_summaries[0]["lines"]) if doc_summaries else "Document A content"
            summary_b = " ".join(doc_summaries[1]["lines"]) if len(doc_summaries) > 1 else "Document B content"

            return _json.dumps({
                "summary_text": f"Comparison between provided documents based on extracted content.",
                "common_themes": ["Document structure", "Content overlap"],
                "differences": [
                    {
                        "category": "Content",
                        "doc_a_value": summary_a[:200],
                        "doc_b_value": summary_b[:200],
                        "explanation": "Documents contain different content sections.",
                        "doc_refs": ["Document A", "Document B"],
                        "page_refs": [1, 1],
                        "status": "different",
                        "confidence": 0.85
                    }
                ]
            }, indent=2)

        # Document insights
        if "document intelligence auditor" in sys_lower or "generate structured insights json" in user_lower:
            blocks = _parse_source_blocks(system_content)
            insights = []
            for src_num, body in blocks[:3]:
                lines = _split_into_lines(body)
                if lines:
                    insights.append({
                        "insight_type": "key_finding",
                        "title": lines[0][:80],
                        "description": " ".join(lines[:3])[:200],
                        "category": "directly_extracted_fact",
                        "evidence_text": lines[0][:150],
                        "page_number": int(src_num),
                        "confidence_score": 0.90,
                    })
            if not insights:
                insights.append({
                    "insight_type": "key_finding",
                    "title": "Document content analyzed",
                    "description": "The document has been processed for key information.",
                    "category": "directly_extracted_fact",
                    "evidence_text": "Content extracted from provided document.",
                    "page_number": 1,
                    "confidence_score": 0.85,
                })
            return _json.dumps({"insights": insights}, indent=2)

        # Action discovery
        if "expert legal, financial, and business document analyst" in sys_lower or "identify all explicit commitments" in user_lower:
            blocks = _parse_source_blocks(system_content)
            actions = []
            all_text = "\n".join(body for _, body in blocks) if blocks else system_content
            lines = _split_into_lines(all_text)

            # Look for lines containing dates, deadlines, or action-like language
            for line in lines:
                line_lower = line.lower()
                has_date = bool(re.search(r'\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}/\d{1,2}/\d{2,4})\b', line_lower))
                has_action = bool(re.search(r'\b(due|deadline|must|shall|required|payment|renew|expir|submit|deliver|comply)\b', line_lower))
                if has_date or has_action:
                    date_match = re.search(r'(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4})', line_lower)
                    actions.append({
                        "title": line[:80],
                        "description": line[:200],
                        "due_date": date_match.group(0) if date_match else None,
                        "is_date_explicit": bool(date_match),
                        "category": "deadline" if has_date else "action_item",
                        "evidence_text": line[:200],
                        "confidence_score": 0.88,
                    })
                if len(actions) >= 5:
                    break

            if not actions:
                actions.append({
                    "title": "Review document content",
                    "description": "No explicit action items or deadlines found in the provided document.",
                    "due_date": None,
                    "is_date_explicit": False,
                    "category": "review",
                    "evidence_text": "General document review recommended.",
                    "confidence_score": 0.50,
                })
            return _json.dumps(actions, indent=2)

        # Detailed summary
        if "detailed summary" in sys_lower or "detailed summary" in user_lower:
            return (
                "## Executive Summary\n"
                "The target document outlines key technical operations, platform compliance standards, "
                "and scheduled infrastructure milestones.\n\n"
                "## Section-Wise Breakdown\n"
                "- Architecture Overview: Outlines decoupled microservice layers and queue handlers.\n"
                "- Operational Metrics: Highlights system latency targets under 200 milliseconds.\n\n"
                "## Important Numbers and Dates\n"
                "- Target launch date: December 31, 2026\n"
                "- Infrastructure budget: $500,000\n"
                "- Availability target: 99.95%\n\n"
                "## Main Arguments\n"
                "- Automated document extraction reduces administrative overhead.\n\n"
                "## Conclusions\n"
                "Recommended next step is finalizing migration checklists."
            )

        return None  # Not a structured request

    def _find_field_value(self, field_name: str, all_text: str, blocks: List[Tuple[str, str]]) -> Tuple[Optional[str], Optional[str], Optional[int]]:
        """Try to find a field value in the document text."""
        field_lower = field_name.lower()
        lines = _split_into_lines(all_text)
        page = 1

        for line in lines:
            line_lower = line.lower()
            # Look for "field_name: value" or "field_name - value" patterns
            pattern = re.search(
                rf'\b{re.escape(field_lower)}\s*[:\-–]\s*(.+)',
                line_lower
            )
            if pattern:
                value = pattern.group(1).strip()
                # Get the original case version
                orig_match = re.search(
                    rf'(?i)\b{re.escape(field_lower)}\s*[:\-–]\s*(.+)',
                    line
                )
                if orig_match:
                    value = orig_match.group(1).strip()
                return value[:200], line[:200], page

        return None, None, None

    # ── Main answer synthesis ──

    def _synthesize_answer(self, messages: List[LLMMessage]) -> str:
        """Generate answer by extracting verbatim content from document chunks."""
        if self.simulate_timeout:
            raise LLMTimeoutError("Simulated mock provider request timeout.")
        if self.simulate_rate_limit:
            raise LLMRateLimitError("Simulated mock provider rate limit exceeded (429).")
        if self.simulate_error:
            raise LLMProviderError("Simulated generic LLM provider failure.")

        system_content = next((m.content for m in messages if m.role == "system"), "")
        user_content = next((m.content for m in reversed(messages) if m.role == "user"), "")

        # Try structured/intelligence handlers first
        structured = self._handle_structured_extraction(system_content, user_content)
        if structured is not None:
            return structured

        # ── Conversational Q&A from document evidence ──
        q_lower = user_content.lower().strip()
        blocks = _parse_source_blocks(system_content)

        # No evidence at all?
        if not blocks:
            # Check if there's any content in system prompt that looks like document text
            if len(system_content) < 200 or "no relevant document evidence" in system_content.lower():
                return "I cannot find sufficient evidence in the provided documents to answer this question."

        # Conflict questions
        if any(w in q_lower for w in ["conflict", "differ", "discrepanc", "contradict"]):
            if len(blocks) >= 2:
                line1 = _split_into_lines(blocks[0][1])
                line2 = _split_into_lines(blocks[1][1])
                t1 = line1[0] if line1 else "first document content"
                t2 = line2[0] if line2 else "second document content"
                return (
                    f"Based on the provided documents, there are differences between the sources.\n\n"
                    f"[Source {blocks[0][0]}] states: \"{t1}\"\n\n"
                    f"[Source {blocks[1][0]}] states: \"{t2}\"\n\n"
                    f"Both documents should be compared carefully for reconciliation."
                )

        # Determine intent and keywords
        intent = _question_intent(q_lower)
        keywords = _extract_keywords(user_content)

        # Collect all lines with their source numbers and scores
        scored_lines: List[Tuple[int, str, str]] = []  # (score, source_num, line)
        for src_num, body in blocks:
            lines = _split_into_lines(body)
            for line in lines:
                # Skip header/metadata lines
                if line.startswith("[Source") or line.startswith("Document:") or line.startswith("Chunk ID:"):
                    continue
                score = _score_line_for_intent(line, intent, keywords)
                if score > 0:
                    scored_lines.append((score, src_num, line))

        # Sort by score descending
        scored_lines.sort(key=lambda x: x[0], reverse=True)

        # ── Name intent special handling ──
        if intent == "name":
            # For "what is my name" questions, we need to find the person's name
            # Strategy: Look at the FIRST few lines of the FIRST chunk — CVs/resumes
            # typically have the person's name as the first or second line
            for src_num, body in blocks:
                lines = _split_into_lines(body)
                for line in lines[:5]:  # Check first 5 lines
                    line_stripped = line.strip()
                    # Skip obvious non-name lines
                    if any(line_stripped.lower().startswith(skip) for skip in [
                        "page", "document", "chunk", "section", "source",
                        "http", "www", "curriculum", "resume", "#",
                        "education", "experience", "skills", "projects",
                        "summary", "objective", "certifications", "awards",
                        "references", "interests", "hobbies", "languages",
                        "contact", "personal", "professional", "technical",
                        "declaration", "profile", "achievements",
                    ]):
                        continue
                    # A name line: short (2-5 words), mostly capitalized words
                    words = line_stripped.split()
                    if 2 <= len(words) <= 5:
                        cap_words = [w for w in words if w[0].isupper()]
                        if len(cap_words) >= len(words) * 0.5:
                            # This looks like a name!
                            return (
                                f"Based on the document, your name is **{line_stripped}** [Source {src_num}]."
                            )
                    # Also check for "Name: Value" pattern
                    name_match = re.search(r'(?i)\bname\s*[:\-–]\s*(.+)', line_stripped)
                    if name_match:
                        name_val = name_match.group(1).strip()
                        return f"Based on the document, your name is **{name_val}** [Source {src_num}]."

            # If we have scored lines for name intent, use the best one
            if scored_lines:
                best_score, best_src, best_line = scored_lines[0]
                return f"Based on the document: {best_line} [Source {best_src}]."

        # ── Email intent ──
        if intent == "email":
            for src_num, body in blocks:
                email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', body)
                if email_match:
                    return f"Your email address is **{email_match.group(0)}** [Source {src_num}]."

        # ── Phone intent ──
        if intent == "phone":
            for src_num, body in blocks:
                phone_match = re.search(r'[\+]?[\d][\d\s\-\(\)]{6,14}\d', body)
                if phone_match:
                    return f"Your phone number is **{phone_match.group(0).strip()}** [Source {src_num}]."

        # ── General answer from scored lines ──
        if scored_lines:
            # Take top 3-5 most relevant lines
            top_lines = scored_lines[:5]

            if len(top_lines) == 1:
                score, src, line = top_lines[0]
                return f"Based on the document: {line} [Source {src}]."
            else:
                # Group by source for cleaner output
                answer_parts = []
                seen = set()
                for score, src, line in top_lines:
                    if line in seen:
                        continue
                    seen.add(line)
                    answer_parts.append(f"- {line} [Source {src}]")

                if answer_parts:
                    intro = "Based on the provided document, here is the relevant information:\n\n"
                    return intro + "\n".join(answer_parts)

        # ── Fallback: Return the first few lines only if summary intent ──
        if blocks and intent == "summary":
            src_num, body = blocks[0]
            lines = _split_into_lines(body)
            # Filter out metadata lines
            content_lines = [
                l for l in lines
                if not l.startswith("[Source") and not l.startswith("Document:")
                and not l.startswith("Chunk ID:") and len(l) > 5
            ]
            if content_lines:
                excerpt = content_lines[:3]
                text = "\n".join(f"- {l}" for l in excerpt)
                return (
                    f"Based on the document evidence, here is what I found [Source {src_num}]:\n\n{text}"
                )

        return "I cannot find sufficient evidence in the provided documents to answer this question."

    # ── LLM interface ──

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Return synthesized completion."""
        answer = self._synthesize_answer(messages)
        prompt_chars = sum(len(m.content) for m in messages)
        p_tokens = max(1, prompt_chars // 4)
        c_tokens = max(1, len(answer) // 4)

        return LLMResponse(
            content=answer,
            model_name=self.model_name,
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            finish_reason="stop",
        )

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream synthesized completion token by token."""
        answer = self._synthesize_answer(messages)
        words = answer.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield LLMStreamChunk(delta=token)
            await asyncio.sleep(0.005)

        yield LLMStreamChunk(delta="", finish_reason="stop")
