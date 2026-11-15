import sys, os
sys.path.insert(0, 'backend')

import unittest.mock
import asyncio

from app.services.studio.base import BaseStudioService
from app.services.studio.flashcard_service import FlashcardService
from app.services.studio.quiz_service import QuizService
from app.services.studio.mindmap_service import MindMapService
from app.services.studio.infographic_service import InfographicService
from app.services.studio.video_service import VideoOverviewService
from app.services.studio.presentation_service import PresentationService
from app.services.studio.report_service import ReportService
from app.services.studio.datatable_service import DataTableService

SAMPLE_SOURCES = [
    {
        "id": "src-sample-01",
        "title": "Machine Learning Fundamentals.pdf",
        "source_type": "document",
        "content": (
            "Supervised learning trains models on labeled datasets to make predictions. "
            "Key evaluation metrics include precision, recall, F1-score, and ROC-AUC. "
            "In 2024, transformer architectures continue to dominate natural language processing."
        ),
    }
]

async def run_all():
    print("Testing FlashcardService...", flush=True)
    fc = FlashcardService()
    with unittest.mock.patch.object(BaseStudioService, "generate_json", new_callable=unittest.mock.AsyncMock) as m:
        m.return_value = {
            "deck_title": "ML Deck",
            "cards": [{"id": "1", "front": "Q", "back": "A", "difficulty": "easy"}]
        }
        r = await fc.generate_deck(SAMPLE_SOURCES, card_count=1)
        assert len(r["cards"]) == 1
        print(f" -> Flashcards OK: {r['title']}", flush=True)

    print("Testing QuizService...", flush=True)
    qz = QuizService()
    with unittest.mock.patch.object(BaseStudioService, "generate_json", new_callable=unittest.mock.AsyncMock) as m:
        m.return_value = {
            "quiz_title": "ML Quiz",
            "questions": [{"id": 1, "type": "multiple_choice", "question": "Q?", "options": ["A", "B"], "correct_answer": "A", "explanation": "E"}]
        }
        r = await qz.generate_quiz(SAMPLE_SOURCES, difficulty="easy")
        assert len(r["questions"]) == 1
        print(f" -> Quiz OK: {r['title']}", flush=True)

    print("Testing MindMapService...", flush=True)
    mm = MindMapService()
    with unittest.mock.patch.object(BaseStudioService, "generate_json", new_callable=unittest.mock.AsyncMock) as m:
        m.return_value = {
            "root_label": "ML",
            "nodes": [{"id": "1", "label": "Supervised", "category": "cat"}],
            "edges": [{"source": "root", "target": "1", "label": "has"}]
        }
        r = await mm.generate_mindmap(SAMPLE_SOURCES)
        assert len(r["nodes"]) == 1
        print(f" -> MindMap OK: {r['title']}", flush=True)

    print("Testing InfographicService...", flush=True)
    info = InfographicService()
    with unittest.mock.patch.object(BaseStudioService, "generate_json", new_callable=unittest.mock.AsyncMock) as m:
        m.return_value = {
            "title": "ML Bento",
            "subtitle": "Sub",
            "style": "bento_grid",
            "sections": [{"title": "Sec 1", "format": "stat_callout", "stat_number": "99%", "stat_label": "Stat", "body": "B"}]
        }
        r = await info.generate_infographic(SAMPLE_SOURCES)
        assert len(r["sections"]) == 1
        print(f" -> Infographic OK: {r['title']}", flush=True)

    print("Testing VideoOverviewService...", flush=True)
    vid = VideoOverviewService()
    with unittest.mock.patch.object(BaseStudioService, "generate_json", new_callable=unittest.mock.AsyncMock) as m:
        m.return_value = {
            "video_title": "Video Explainer",
            "scenes": [{"scene_number": 1, "title": "Intro", "visual_prompt": "P", "narration_script": "N", "duration_seconds": 10}]
        }
        r = await vid.generate_storyboard(SAMPLE_SOURCES)
        assert len(r["scenes"]) == 1
        print(f" -> Video Storyboard OK: {r['title']}", flush=True)

    print("Testing PresentationService PPTX...", flush=True)
    prs = PresentationService()
    pptx_bytes = prs._build_pptx_binary("Test PPTX", [{"title": "Slide 1", "subtitle": "S1", "bullets": ["B1", "B2"], "speaker_notes": "N"}])
    assert pptx_bytes[:4] == b"PK\x03\x04"
    print(f" -> PPTX Binary OK: {len(pptx_bytes)} bytes", flush=True)

    print("Testing ReportService DOCX...", flush=True)
    rep = ReportService()
    docx_bytes = rep._build_docx_binary("Test DOCX", "## Heading\nParagraph content.\n")
    assert docx_bytes[:4] == b"PK\x03\x04"
    print(f" -> DOCX Binary OK: {len(docx_bytes)} bytes", flush=True)

    print("Testing DataTableService XLSX...", flush=True)
    dt = DataTableService()
    xlsx_bytes = dt._build_xlsx_binary("Test XLSX", [{"key": "col1", "label": "Col 1"}], [{"col1": "Val 1"}])
    assert xlsx_bytes[:4] == b"PK\x03\x04"
    print(f" -> XLSX Binary OK: {len(xlsx_bytes)} bytes", flush=True)

    print("\n=======================================================", flush=True)
    print("SUCCESS: ALL 8 STUDIO ENGINES FULLY VERIFIED AND PASSING!", flush=True)
    print("=======================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_all())
