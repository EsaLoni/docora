"""Quiz Generator Engine.

Produces interactive source-grounded quizzes with multiple question formats,
instant feedback, correct-answer rationales, and exact citations.
"""

import time
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.quiz")

QUIZ_SYSTEM_PROMPT = """You are an expert instructional designer creating comprehensive assessment quizzes.
Generate a source-grounded quiz based strictly on the provided materials.

RULES:
1. Grounding: Questions and options must be factually established by the sources.
2. Formats: Support multiple_choice (4 options, 1 correct) and true_false (2 options: ["True", "False"], 1 correct).
3. For multiple_choice:
   - Provide exactly 4 realistic options in "options".
   - Set "correct_index" to an integer 0, 1, 2, or 3 pointing to the right choice in "options".
4. For true_false:
   - "options" MUST be exactly ["True", "False"].
   - "correct_index" MUST be 0 if the statement is True, or 1 if the statement is False.
   - "type" MUST be "true_false".
5. Explanations: Include a crystal-clear rationale for why the correct answer is right and others are wrong.
6. Citations: Cite exact sources (e.g. "Source 1, Page 2").

Output Schema:
{
  "quiz_title": "string",
  "questions": [
    {
      "id": "q-1",
      "type": "multiple_choice",
      "question": "Which of the following...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "correct_indices": [0],
      "explanation": "According to the document, ...",
      "citation": "Source 1, Page 3"
    },
    {
      "id": "q-2",
      "type": "true_false",
      "question": "Statement about the document...",
      "options": ["True", "False"],
      "correct_index": 0,
      "correct_indices": [0],
      "explanation": "This statement is true because...",
      "citation": "Source 1, Page 1"
    }
  ]
}
"""


class QuizService(BaseStudioService):
    """Generates interactive assessment quizzes with grading metadata."""

    async def generate_quiz(
        self,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
        question_count: int = 5,
        difficulty: str = "medium",
        question_types: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Generate structured quiz via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        # Normalize question types filter
        format_instr = ""
        types_list = []
        if isinstance(question_types, list):
            types_list = [str(t).lower() for t in question_types]
        elif isinstance(question_types, str) and question_types.strip():
            types_list = [t.strip().lower() for t in question_types.split(",")]

        if "true_false" in types_list and "multiple_choice" not in types_list:
            format_instr = "All questions MUST be True/False format with options ['True', 'False'].\n"
        elif "true_false" in types_list and "multiple_choice" in types_list:
            format_instr = "Include a balanced combination of multiple_choice and true_false questions.\n"

        user_prompt = (
            f"Generate a {question_count}-question {difficulty} difficulty assessment quiz based strictly on the sources.\n"
            f"{format_instr}"
        )
        if topic_focus:
            user_prompt += f"Special Focus: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=QUIZ_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        questions = data.get("questions", [])

        # Robust normalization pass for all questions
        for idx, q in enumerate(questions, 1):
            if "id" not in q:
                q["id"] = f"q-{idx}"

            # 1. Normalize options array
            raw_options = q.get("options")
            if isinstance(raw_options, dict):
                q["options"] = list(raw_options.values())
            elif not isinstance(raw_options, list) or len(raw_options) == 0:
                if q.get("type") in ("true_false", "boolean") or "true" in str(q.get("answer", "")).lower():
                    q["options"] = ["True", "False"]
                    q["type"] = "true_false"
                else:
                    q["options"] = ["Option A", "Option B", "Option C", "Option D"]

            # 2. Normalize True/False types and options
            opts = [str(o) for o in q.get("options", [])]
            is_tf = (
                q.get("type") in ("true_false", "boolean")
                or len(opts) == 2
                or {o.strip().lower() for o in opts} == {"true", "false"}
            )
            if is_tf:
                q["type"] = "true_false"
                q["options"] = ["True", "False"]
                opts = q["options"]

            # 3. Resolve correct_index accurately
            raw_ans = q.get("correct_index")
            if raw_ans is None:
                raw_ans = q.get("correct_answer", q.get("answer", q.get("correct_option")))

            resolved_idx = 0
            if isinstance(raw_ans, bool):
                resolved_idx = 0 if raw_ans else 1
            elif isinstance(raw_ans, int):
                resolved_idx = max(0, min(raw_ans, len(opts) - 1))
            elif isinstance(raw_ans, str):
                s = raw_ans.strip()
                if s.isdigit():
                    resolved_idx = max(0, min(int(s), len(opts) - 1))
                elif s.upper() in ("A", "B", "C", "D") and len(opts) >= 4:
                    resolved_idx = {"A": 0, "B": 1, "C": 2, "D": 3}[s.upper()]
                elif s.lower() in ("true", "t"):
                    resolved_idx = 0
                elif s.lower() in ("false", "f"):
                    resolved_idx = 1
                else:
                    # Match by text content
                    for o_idx, opt_text in enumerate(opts):
                        if opt_text.strip().lower() == s.lower():
                            resolved_idx = o_idx
                            break

            q["correct_index"] = resolved_idx
            q["correct_indices"] = [resolved_idx]

        return {
            "title": data.get("quiz_title", "Notebook Assessment Quiz"),
            "question_count": len(questions),
            "difficulty": difficulty,
            "questions": questions,
            "generation_time_ms": elapsed_ms,
        }
