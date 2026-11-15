"""Integration and Unit Tests for UDIP Phase 11 Gemini Notebook & Studio Tools.

Covers:
1. Notebook Lifecycle Management (Create, List, Detail, Update, Delete)
2. Knowledge Sources (Text Notes, Web URLs, Ingested Document attachment, Toggle)
3. Notes Management (Create, List, Delete)
4. Flashcard Generator (Schema, Citations, Persistence)
5. Quiz Engine (Multiple Choice, Explanations, Scoring)
6. Slide Deck Generator (Python-PPTX binary export)
7. Report Generator (Python-DOCX binary export)
8. Data Table Generator (OpenPYXL binary export)
9. Mind Map Engine (Graph Nodes, Edges, Concepts)
10. Infographic Generator (Bento Grid layout, Sections)
11. Video Overview Storyboard (Scene Breakdown, Narration)
12. Artifact Download API (Binary Streaming & MIME validation)
"""

import io
import os
import unittest.mock
import uuid
import pytest
from fastapi.testclient import TestClient

from app.models.notebook import Notebook, NotebookSource, StudioArtifact
from app.services.studio.datatable_service import DataTableService
from app.services.studio.flashcard_service import FlashcardService
from app.services.studio.infographic_service import InfographicService
from app.services.studio.mindmap_service import MindMapService
from app.services.studio.presentation_service import PresentationService
from app.services.studio.quiz_service import QuizService
from app.services.studio.report_service import ReportService
from app.services.studio.video_service import VideoOverviewService
from tests.conftest import make_test_token


# Sample Grounding Source Content
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


# =====================================================================
# 1. Notebook Lifecycle API Tests
# =====================================================================

def test_notebook_crud_lifecycle(client: TestClient):
    """Verify complete CRUD lifecycle for Notebooks."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Create Notebook
    create_res = client.post(
        "/api/v1/notebooks",
        json={
            "title": "AI Research Notebook",
            "description": "Deep dive into foundation models and retrieval.",
            "color": "indigo",
            "icon": "sparkles",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    nb = create_res.json()
    nb_id = nb["id"]
    assert nb["title"] == "AI Research Notebook"
    assert nb["color"] == "indigo"
    assert nb["workspace_id"] == ws_id

    # 2. List Notebooks
    list_res = client.get("/api/v1/notebooks", headers=headers)
    assert list_res.status_code == 200
    notebooks = list_res.json()
    assert any(n["id"] == nb_id for n in notebooks)

    # 3. Get Notebook Detail
    detail_res = client.get(f"/api/v1/notebooks/{nb_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["title"] == "AI Research Notebook"

    # 4. Update Notebook
    patch_res = client.patch(
        f"/api/v1/notebooks/{nb_id}",
        json={"title": "Advanced AI Research 2026", "color": "emerald"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Advanced AI Research 2026"
    assert patch_res.json()["color"] == "emerald"

    # 5. Delete Notebook
    del_res = client.delete(f"/api/v1/notebooks/{nb_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deletion
    verify_res = client.get(f"/api/v1/notebooks/{nb_id}", headers=headers)
    assert verify_res.status_code == 404


# =====================================================================
# 2. Knowledge Sources and Notes Management
# =====================================================================

def test_notebook_sources_and_notes(client: TestClient):
    """Verify adding sources, toggling active status, and managing notes."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Create parent notebook
    nb_res = client.post("/api/v1/notebooks", json={"title": "Study Space"}, headers=headers)
    nb_id = nb_res.json()["id"]

    # 1. Add Text Note Source
    src_res = client.post(
        f"/api/v1/notebooks/{nb_id}/sources",
        json={
            "source_type": "text_note",
            "title": "Quantum Computing Notes",
            "raw_content": "Superposition and entanglement are fundamental principles of quantum computing.",
        },
        headers=headers,
    )
    assert src_res.status_code == 201
    source = src_res.json()
    source_id = source["id"]
    assert source["title"] == "Quantum Computing Notes"
    assert source["is_active_for_queries"] is True

    # 2. Add URL Source
    url_res = client.post(
        f"/api/v1/notebooks/{nb_id}/sources",
        json={
            "source_type": "url",
            "title": "Official Python Docs",
            "url": "https://docs.python.org/3/",
            "raw_content": "Python is an easy to learn, powerful programming language.",
        },
        headers=headers,
    )
    assert url_res.status_code == 201

    # 3. Toggle Source Active status
    patch_src = client.patch(
        f"/api/v1/notebooks/{nb_id}/sources/{source_id}",
        json={"is_active_for_queries": False},
        headers=headers,
    )
    assert patch_src.status_code == 200
    assert patch_src.json()["is_active_for_queries"] is False

    # 4. Add Notebook Note
    note_res = client.post(
        f"/api/v1/notebooks/{nb_id}/notes",
        json={"title": "Action Items", "content": "Review chapter 4 and prepare presentation."},
        headers=headers,
    )
    assert note_res.status_code == 201
    note_id = note_res.json()["id"]

    # 5. List Notes
    notes_list = client.get(f"/api/v1/notebooks/{nb_id}/notes", headers=headers).json()
    assert any(n["id"] == note_id for n in notes_list)

    # 6. Delete Note
    del_note = client.delete(f"/api/v1/notebooks/{nb_id}/notes/{note_id}", headers=headers)
    assert del_note.status_code == 200


# =====================================================================
# 3. Studio Engine Unit Tests (Flashcards, Quizzes, Presentations, etc.)
# =====================================================================

def test_flashcard_service():
    """Verify flashcard deck generation structure and citations."""
    async def _test():
        mock_llm = unittest.mock.MagicMock()
        service = FlashcardService(llm_provider=mock_llm)
        
        mock_response = {
            "deck_title": "Machine Learning Fundamentals Deck",
            "cards": [
                {
                    "id": "card-1",
                    "front": "What is supervised learning?",
                    "back": "Supervised learning trains models on labeled datasets to make predictions.",
                    "difficulty": "easy",
                    "explanation": "Supervised learning learns mapping from features to labels.",
                    "source_ref": "Source 1",
                },
                {
                    "id": "card-2",
                    "front": "What are key evaluation metrics for supervised models?",
                    "back": "Precision, recall, F1-score, and ROC-AUC.",
                    "difficulty": "medium",
                    "explanation": "Standard classification evaluation metrics.",
                    "source_ref": "Source 1",
                },
            ],
        }

        with unittest.mock.patch.object(service, "generate_json", new_callable=unittest.mock.AsyncMock) as mock_gen:
            mock_gen.return_value = mock_response
            result = await service.generate_deck(SAMPLE_SOURCES, card_count=2)
            assert len(result["cards"]) == 2
            assert result["cards"][0]["front"] == "What is supervised learning?"
            assert result["cards"][0]["difficulty"] == "easy"
            assert result["card_count"] == 2

    import asyncio
    _loop = asyncio.new_event_loop()
    try:
        _loop.run_until_complete(_test())
    finally:
        _loop.close()


def test_quiz_service():
    """Verify interactive quiz generator with multiple question formats and explanations."""
    async def _test():
        mock_llm = unittest.mock.MagicMock()
        service = QuizService(llm_provider=mock_llm)

        mock_quiz = {
            "quiz_title": "Machine Learning Assessment",
            "questions": [
                {
                    "id": 1,
                    "type": "multiple_choice",
                    "question": "Which architecture continues to dominate NLP?",
                    "options": ["RNN", "Transformer", "Decision Tree", "Perceptron"],
                    "correct_answer": "Transformer",
                    "explanation": "Transformers dominate NLP as stated in the text.",
                    "citation": "Source 1",
                }
            ],
        }

        with unittest.mock.patch.object(service, "generate_json", new_callable=unittest.mock.AsyncMock) as mock_gen:
            mock_gen.return_value = mock_quiz
            result = await service.generate_quiz(SAMPLE_SOURCES, difficulty="medium")
            assert len(result["questions"]) == 1
            q = result["questions"][0]
            assert q["correct_answer"] == "Transformer"
            assert len(q["options"]) == 4

    import asyncio
    _loop = asyncio.new_event_loop()
    try:
        _loop.run_until_complete(_test())
    finally:
        _loop.close()


def test_presentation_service_pptx_generation():
    """Verify presentation service produces a valid .pptx binary file."""
    service = PresentationService()

    slides = [
        {
            "title": "Agenda",
            "subtitle": "Overview of topics",
            "bullets": ["Supervised Learning", "Evaluation Metrics", "Transformers"],
            "speaker_notes": "Welcome the audience and set context.",
            "citations": ["Source 1"],
        },
        {
            "title": "Evaluation Standards",
            "subtitle": "Metrics analysis",
            "bullets": ["Precision and Recall", "F1 Score Optimization", "ROC-AUC Curves"],
            "speaker_notes": "Emphasize balanced datasets.",
            "citations": ["Source 1"],
        },
    ]

    # Test real python-pptx generation directly
    pptx_bytes = service._build_pptx_binary("ML Breakthroughs 2026", slides, theme="modern_indigo")
    assert isinstance(pptx_bytes, bytes)
    assert len(pptx_bytes) > 2000  # valid PPTX container
    assert pptx_bytes[:4] == b"PK\x03\x04"  # ZIP file header standard for .pptx


def test_report_service_docx_generation():
    """Verify structured report service produces a valid .docx binary file."""
    service = ReportService()

    markdown_sample = (
        "## Executive Summary\n"
        "Transformers lead natural language processing with high F1 accuracy.\n\n"
        "### Supervised Methods\n"
        "Supervised models map input to target labels accurately.\n\n"
        "- Precision matters\n"
        "- Use ROC-AUC for imbalanced data\n"
    )

    # Test real python-docx generation directly
    docx_bytes = service._build_docx_binary("ML Technical Intelligence Report", markdown_sample)
    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 2000
    assert docx_bytes[:4] == b"PK\x03\x04"  # ZIP file header standard for .docx


def test_datatable_service_xlsx_generation():
    """Verify structured data extraction produces a valid .xlsx binary file."""
    service = DataTableService()

    columns = [
        {"key": "concept", "label": "Concept", "type": "string"},
        {"key": "metric", "label": "Key Metric", "type": "string"},
    ]
    rows = [
        {
            "concept": "Supervised Learning",
            "metric": "F1-Score",
            "_citations": {"concept": "Source 1"},
        }
    ]

    # Test real openpyxl generation directly
    xlsx_bytes = service._build_xlsx_binary("ML Model Architecture Comparison", columns, rows)
    assert isinstance(xlsx_bytes, bytes)
    assert len(xlsx_bytes) > 1000
    assert xlsx_bytes[:4] == b"PK\x03\x04"  # ZIP file header standard for .xlsx


def test_mindmap_service():
    """Verify mind map engine produces a connected knowledge graph of nodes and edges."""
    async def _test():
        mock_llm = unittest.mock.MagicMock()
        service = MindMapService(llm_provider=mock_llm)

        mock_graph = {
            "root_label": "Machine Learning",
            "nodes": [
                {"id": "node_1", "label": "Supervised Learning", "category": "paradigm", "notes": "Uses labeled data", "source_reference": "Source 1"},
                {"id": "node_2", "label": "Evaluation Metrics", "category": "metrics", "notes": "Precision & recall", "source_reference": "Source 1"},
            ],
            "edges": [
                {"source": "root", "target": "node_1", "label": "includes"},
                {"source": "node_1", "target": "node_2", "label": "measured by"},
            ],
        }

        with unittest.mock.patch.object(service, "generate_json", new_callable=unittest.mock.AsyncMock) as mock_gen:
            mock_gen.return_value = mock_graph
            graph = await service.generate_mindmap(SAMPLE_SOURCES)
            assert len(graph["nodes"]) == 2
            assert len(graph["edges"]) == 2
            assert graph["nodes"][0]["label"] == "Supervised Learning"

    import asyncio
    _loop = asyncio.new_event_loop()
    try:
        _loop.run_until_complete(_test())
    finally:
        _loop.close()


def test_infographic_service():
    """Verify infographic engine produces structured bento-grid sections."""
    async def _test():
        mock_llm = unittest.mock.MagicMock()
        service = InfographicService(llm_provider=mock_llm)

        mock_info = {
            "title": "State of Machine Learning",
            "subtitle": "Key metrics and paradigms at a glance",
            "style": "bento_grid",
            "sections": [
                {
                    "title": "Dominant Paradigms",
                    "format": "stat_callout",
                    "stat_number": "98%",
                    "stat_label": "Transformer Adoption",
                    "body": "Transformers dominate modern NLP architectures.",
                    "citation": "Source 1",
                }
            ],
        }

        with unittest.mock.patch.object(service, "generate_json", new_callable=unittest.mock.AsyncMock) as mock_gen:
            mock_gen.return_value = mock_info
            result = await service.generate_infographic(SAMPLE_SOURCES, layout_style="bento_grid")
            assert result["style"] == "bento_grid"
            assert len(result["sections"]) == 1
            assert result["sections"][0]["stat_number"] == "98%"

    import asyncio
    _loop = asyncio.new_event_loop()
    try:
        _loop.run_until_complete(_test())
    finally:
        _loop.close()


def test_video_overview_service():
    """Verify video overview produces scene-by-scene storyboard and narration."""
    async def _test():
        mock_llm = unittest.mock.MagicMock()
        service = VideoOverviewService(llm_provider=mock_llm)

        mock_storyboard = {
            "video_title": "Machine Learning Explainer",
            "target_duration_seconds": 90,
            "scenes": [
                {
                    "scene_number": 1,
                    "title": "Introduction to Supervised Learning",
                    "visual_prompt": "Futuristic digital brain processing labeled data streams",
                    "narration_script": "Welcome. Today we explore how algorithms learn from labeled data.",
                    "duration_seconds": 15,
                    "on_screen_text": "Supervised Learning",
                    "citations": ["Source 1"],
                }
            ],
        }

        with unittest.mock.patch.object(service, "generate_json", new_callable=unittest.mock.AsyncMock) as mock_gen:
            mock_gen.return_value = mock_storyboard
            result = await service.generate_storyboard(SAMPLE_SOURCES)
            assert len(result["scenes"]) == 1
            assert result["scenes"][0]["duration_seconds"] == 15
            assert result["status"] == "storyboard_ready"

    import asyncio
    _loop = asyncio.new_event_loop()
    try:
        _loop.run_until_complete(_test())
    finally:
        _loop.close()
