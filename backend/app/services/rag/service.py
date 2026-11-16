"""High-Level RAG Service Orchestrator.

Coordinates the end-to-end question-answering workflow:
User question -> Conversation context -> Hybrid retrieval -> Context construction
-> LLM generation -> Citation validation -> Message persistence -> Response.
"""

import time
from typing import AsyncGenerator, Dict, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.metrics import metrics
from app.services.llm.models import LLMMessage
from app.services.llm.service import LLMService
from app.services.rag.answer_generator import AnswerGenerator
from app.services.rag.citation_builder import CitationBuilder
from app.services.rag.citation_validator import CitationValidator
from app.services.rag.context_builder import ContextBuilder
from app.services.rag.conversation_manager import ConversationManager, ConversationNotFoundError
from app.services.rag.models import CitationDTO, RAGRequest, RAGResponse
from app.services.rag.prompt_builder import PromptBuilder
from app.services.retrieval.models import SearchRequest, SearchResultItem
from app.services.retrieval.service import RetrievalService

logger = get_logger("services.rag")


class RAGService:
    """End-to-end Retrieval-Augmented Generation service."""

    def __init__(
        self,
        retrieval_service: Optional[RetrievalService] = None,
        llm_service: Optional[LLMService] = None,
        settings: Optional[Settings] = None,
        custom_api_key: Optional[str] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.retrieval_service = retrieval_service or RetrievalService(settings=self.settings)
        self.llm_service = llm_service or LLMService(settings=self.settings, custom_api_key=custom_api_key)

        self.context_builder = ContextBuilder(settings=self.settings)
        self.prompt_builder = PromptBuilder()
        self.answer_generator = AnswerGenerator(llm_service=self.llm_service)
        self.citation_builder = CitationBuilder()
        self.citation_validator = CitationValidator()
        self.conversation_manager = ConversationManager()

    async def answer_question(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        request: RAGRequest,
    ) -> RAGResponse:
        """Execute non-streaming grounded Q&A workflow with validated citations and persistence."""
        start_time = time.time()

        # 1. Resolve or create conversation
        if request.conversation_id:
            conv = await self.conversation_manager.get_conversation(db, workspace_id, request.conversation_id)
            if not conv:
                raise ConversationNotFoundError(str(request.conversation_id))
        else:
            # Auto-create a titled conversation from the first question
            title = request.question.strip()[:40] + ("..." if len(request.question) > 40 else "")
            conv = await self.conversation_manager.create_conversation(
                db=db,
                workspace_id=workspace_id,
                user_id=user_id,
                title=title,
                active_document_ids=[str(d) for d in (request.selected_document_ids or [])],
            )

        # 2. Persist user turn
        await self.conversation_manager.persist_user_message(
            db=db,
            conversation_id=conv.id,
            content=request.question,
        )

        # 3. Retrieve conversation history for contextual grounding
        past_messages = await self.conversation_manager.get_messages(db, workspace_id, conv.id, limit=6)
        history_llm_messages = [
            LLMMessage(role=m.sender_type, content=m.content)
            for m in past_messages[:-1]  # Exclude current question just added
            if m.sender_type in ("user", "assistant")
        ]

        # 4. Multi-document scope and retrieval
        target_doc_id = None
        if request.selected_document_ids and len(request.selected_document_ids) == 1:
            target_doc_id = request.selected_document_ids[0]

        retrieval_limit = getattr(self.settings, "RAG_MAX_CHUNKS", 8)
        search_request = SearchRequest(
            query=request.question,
            mode=request.retrieval_mode,
            limit=retrieval_limit,
            document_id=target_doc_id,
        )

        search_response = await self.retrieval_service.search(
            db=db,
            workspace_id=workspace_id,
            request=search_request,
        )

        # Filter by multiple selected document IDs if requested
        retrieved_chunks = search_response.results
        if request.selected_document_ids and len(request.selected_document_ids) > 1:
            allowed_doc_ids = {str(d) for d in request.selected_document_ids}
            retrieved_chunks = [c for c in retrieved_chunks if c.document_id in allowed_doc_ids]

        # 5. Build bounded context
        context = self.context_builder.build_context(retrieved_chunks)

        # 6. Build strict RAG prompt messages
        prompt_messages = self.prompt_builder.build_messages(
            question=request.question,
            context=context,
            conversation_history=history_llm_messages,
        )

        # 7. Generate grounded answer
        llm_response = await self.answer_generator.generate_answer(
            messages=prompt_messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        answer_text = llm_response.content.strip()
        tokens_used = getattr(llm_response, "prompt_tokens", 0) + getattr(llm_response, "completion_tokens", 0)
        metrics.record_llm_inference(tokens_used=tokens_used)

        # 8. Extract citations and validate against active workspace
        candidate_citations = self.citation_builder.extract_citations(answer_text, context)
        validated_citations = await self.citation_validator.validate_citations(
            db=db,
            workspace_id=workspace_id,
            citations=candidate_citations,
            context=context,
        )

        # 9. Persist assistant message and verified citations
        assistant_msg = await self.conversation_manager.persist_assistant_message(
            db=db,
            conversation_id=conv.id,
            content=answer_text,
            citations=validated_citations,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        status = "insufficient_evidence" if "cannot find sufficient evidence" in answer_text.lower() else "completed"

        return RAGResponse(
            answer=answer_text,
            message_id=str(assistant_msg.id),
            conversation_id=str(conv.id),
            citations=validated_citations,
            retrieval_metadata={
                "retrieved_chunk_count": len(retrieved_chunks),
                "context_token_count": context.total_tokens,
                "retrieval_mode": request.retrieval_mode,
                "model_name": llm_response.model_name,
            },
            generation_status=status,
            processing_time_ms=elapsed_ms,
        )

    async def answer_question_stream(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        request: RAGRequest,
    ) -> AsyncGenerator[Dict, None]:
        """Stream generated tokens via SSE and emit verified citations on completion."""
        # 1. Resolve or create conversation
        if request.conversation_id:
            conv = await self.conversation_manager.get_conversation(db, workspace_id, request.conversation_id)
            if not conv:
                raise ConversationNotFoundError(str(request.conversation_id))
        else:
            title = request.question.strip()[:40] + ("..." if len(request.question) > 40 else "")
            conv = await self.conversation_manager.create_conversation(
                db=db,
                workspace_id=workspace_id,
                user_id=user_id,
                title=title,
                active_document_ids=[str(d) for d in (request.selected_document_ids or [])],
            )

        yield {"event": "conversation_created", "data": {"conversation_id": str(conv.id)}}

        # 2. Persist user turn
        await self.conversation_manager.persist_user_message(
            db=db,
            conversation_id=conv.id,
            content=request.question,
        )

        # 3. Retrieve conversation history
        past_messages = await self.conversation_manager.get_messages(db, workspace_id, conv.id, limit=6)
        history_llm_messages = [
            LLMMessage(role=m.sender_type, content=m.content)
            for m in past_messages[:-1]
            if m.sender_type in ("user", "assistant")
        ]

        # 4. Context retrieval
        target_doc_id = None
        if request.selected_document_ids and len(request.selected_document_ids) == 1:
            target_doc_id = request.selected_document_ids[0]

        retrieval_limit = getattr(self.settings, "RAG_MAX_CHUNKS", 8)
        search_request = SearchRequest(
            query=request.question,
            mode=request.retrieval_mode,
            limit=retrieval_limit,
            document_id=target_doc_id,
        )

        search_response = await self.retrieval_service.search(
            db=db,
            workspace_id=workspace_id,
            request=search_request,
        )
        retrieved_chunks = search_response.results
        if request.selected_document_ids and len(request.selected_document_ids) > 1:
            allowed_doc_ids = {str(d) for d in request.selected_document_ids}
            retrieved_chunks = [c for c in retrieved_chunks if c.document_id in allowed_doc_ids]

        context = self.context_builder.build_context(retrieved_chunks)
        prompt_messages = self.prompt_builder.build_messages(
            question=request.question,
            context=context,
            conversation_history=history_llm_messages,
        )

        # 5. Stream tokens and accumulate complete answer
        accumulated_answer: List[str] = []
        try:
            async for chunk in self.answer_generator.generate_stream(
                messages=prompt_messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            ):
                if chunk.delta:
                    accumulated_answer.append(chunk.delta)
                    yield {"event": "token", "data": {"token": chunk.delta}}
        except Exception as e:
            logger.error("Streaming generation failure: %s", e)
            yield {"event": "error", "data": {"error": str(e)}}
            return

        full_answer = "".join(accumulated_answer).strip()

        # 6. Extract and validate citations
        candidate_citations = self.citation_builder.extract_citations(full_answer, context)
        validated_citations = await self.citation_validator.validate_citations(
            db=db,
            workspace_id=workspace_id,
            citations=candidate_citations,
            context=context,
        )

        # 7. Persist assistant message and emit final metadata
        assistant_msg = await self.conversation_manager.persist_assistant_message(
            db=db,
            conversation_id=conv.id,
            content=full_answer,
            citations=validated_citations,
        )

        yield {
            "event": "citations",
            "data": {
                "citations": [c.model_dump() for c in validated_citations],
            },
        }

        yield {
            "event": "done",
            "data": {
                "message_id": str(assistant_msg.id),
                "conversation_id": str(conv.id),
                "generation_status": "completed",
            },
        }
