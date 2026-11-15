"""Tests for Deadline, Obligation, and Action Discovery Services."""

import asyncio
from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.deadline_extractor import DeadlineExtractionService
from app.services.actions.discovery import ActionDiscoveryService
from app.services.actions.models import SuggestionApprovalRequest, SuggestionCategory
from app.services.actions.obligation_extractor import ObligationExtractionService
from app.services.actions.workflow import ActionWorkflowService
from app.services.llm.mock import MockLLMProvider
from app.services.llm.service import LLMService


def test_deadline_extractor_explicit_vs_inferred():
    """Verify that explicit dates are accurately parsed and relative deadlines are flagged without fabrication."""
    extractor = DeadlineExtractionService()

    # 1. Explicit dates
    explicit_text = "The invoice payment is due on December 15, 2026. The license expires on 2027-01-31."
    explicit_results = extractor.extract_deadlines(explicit_text)
    assert len(explicit_results) >= 2
    for dl in explicit_results:
        assert dl.is_explicit is True
        assert dl.is_ambiguous is False
        assert dl.parsed_date is not None
        assert dl.parsed_date.tzinfo is not None

    # 2. Relative expressions (must NOT invent fake dates)
    relative_text = "The vendor shall deliver the final audit within 30 days of signing. Notice is due upon receipt."
    relative_results = extractor.extract_deadlines(relative_text)
    assert len(relative_results) >= 1
    for dl in relative_results:
        assert dl.is_explicit is False
        assert dl.is_ambiguous is True
        assert dl.parsed_date is None


def test_obligation_extractor():
    """Verify obligation classification, party detection, and evidence extraction."""
    extractor = ObligationExtractionService()

    sample_contract = (
        "Customer shall remit payment of $12,500 within the billing period. "
        "This agreement shall renew on December 31, 2026. "
        "Vendor agrees to furnish software updates quarterly."
    )

    obligations = extractor.extract_obligations(sample_contract)
    assert len(obligations) >= 2

    # Verify payment deadline obligation
    payment_ob = next((o for o in obligations if o.category == SuggestionCategory.PAYMENT_DEADLINE), None)
    assert payment_ob is not None
    assert "payment" in payment_ob.evidence_text.lower()
    assert payment_ob.confidence_score >= 0.85

    # Verify renewal obligation
    renewal_ob = next((o for o in obligations if o.category == SuggestionCategory.RENEWAL_DATE), None)
    assert renewal_ob is not None
    assert "renew" in renewal_ob.evidence_text.lower()


def test_action_discovery_and_workflow(session_factory: async_sessionmaker[AsyncSession]):
    """Verify document discovery, suggestion generation, and explicit approval workflow."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Master Services Agreement 2026",
                filename="msa_2026.pdf",
                file_path="mock/path/msa.pdf",
                file_size_bytes=2048,
                mime_type="application/pdf",
                file_hash="hashmsa123",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="Customer shall pay the annual hosting license fee of $4,500 on November 30, 2026.",
            )
            p2 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=2,
                content="This agreement shall renew on December 15, 2026 unless written notice is received.",
            )
            session.add_all([p1, p2])
            await session.commit()

            # Initialize Discovery Service with MockLLMProvider
            mock_llm = MockLLMProvider()
            llm_service = LLMService(provider=mock_llm)
            discovery_service = ActionDiscoveryService(llm_service=llm_service)

            # 1. Discover actions
            result = await discovery_service.discover_actions_for_document(
                db=session,
                document_id=doc.id,
                workspace_id=ws.id,
                persist=True,
            )

            assert result.document_id == doc.id
            assert result.total_discovered >= 1
            for sugg in result.suggestions:
                assert sugg.title
                assert sugg.evidence_text

            # 2. Verify suggestions were persisted in DB with status "suggested"
            from app.models.action import ActionSuggestion
            from sqlalchemy import select
            sugg_stmt = select(ActionSuggestion).where(
                ActionSuggestion.document_id == doc.id,
                ActionSuggestion.workspace_id == ws.id,
            )
            stored_suggs = (await session.execute(sugg_stmt)).scalars().all()
            assert len(stored_suggs) >= 1
            assert all(s.status == "suggested" for s in stored_suggs)

            # 3. Explicit User Approval Workflow
            workflow = ActionWorkflowService()
            target_sugg = stored_suggs[0]

            approval_req = SuggestionApprovalRequest(
                title="Approved: " + target_sugg.title,
                create_reminder=True,
                reminder_lead_time_minutes=30,
            )

            action_item, reminder = await workflow.approve_suggestion(
                db=session,
                suggestion_id=target_sugg.id,
                workspace_id=ws.id,
                user_id=user.id,
                approval_data=approval_req,
            )

            assert action_item.id is not None
            assert action_item.status == "pending"
            assert action_item.origin == "extracted"
            assert action_item.title.startswith("Approved: ")

            # Refresh suggestion status
            await session.refresh(target_sugg)
            assert target_sugg.status == "approved"

            if target_sugg.proposed_due_date:
                assert reminder is not None
                assert reminder.action_item_id == action_item.id
                assert reminder.status == "scheduled"

            # 4. User Dismissal Workflow
            if len(stored_suggs) > 1:
                dismiss_target = stored_suggs[1]
                dismissed = await workflow.dismiss_suggestion(
                    db=session,
                    suggestion_id=dismiss_target.id,
                    workspace_id=ws.id,
                )
                assert dismissed.status == "dismissed"

    asyncio.run(_test())
