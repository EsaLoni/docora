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
2. Formats: Support multiple_choice (4 options, 1 correct), multiple_select (several correct), or short_answer.
3. Plausible Distractors: Incorrect choices should be realistic misunderstandings, not obvious jokes.
4. Explanations: Include a crystal-clear rationale for why the correct answer is right and others are wrong.
5. Citations: Cite exact sources.

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
    ) -> Dict[str, Any]:
        """Generate structured quiz via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            f"Generate a {question_count}-question {difficulty} difficulty assessment quiz based strictly on the sources.\n"
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

        for idx, q in enumerate(questions, 1):
            if "id" not in q:
                q["id"] = f"q-{idx}"

        return {
            "title": data.get("quiz_title", "Notebook Assessment Quiz"),
            "question_count": len(questions),
            "difficulty": difficulty,
            "questions": questions,
            "generation_time_ms": elapsed_ms,
        }
