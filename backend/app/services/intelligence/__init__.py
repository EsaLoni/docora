"""UDIP Advanced Document Intelligence Package.

Exports summarization, comparison, structured extraction, table intelligence,
document insights, and asynchronous job orchestration services.
"""

from app.services.intelligence.comparison import ComparisonService
from app.services.intelligence.entity import EntityExtractionService
from app.services.intelligence.export import IntelligenceExportService
from app.services.intelligence.extraction import StructuredExtractionService
from app.services.intelligence.insights import InsightsService
from app.services.intelligence.models import (
    ComparisonRequest,
    ComparisonResponse,
    DifferenceItem,
    ExportRequest,
    ExtractedFieldItem,
    ExtractionRequest,
    ExtractionResponse,
    InsightItem,
    InsightsRequest,
    InsightsResponse,
    IntelligenceJobResponse,
    SummaryRequest,
    SummaryResponse,
    SummarySection,
    TableAnalysisResult,
)
from app.services.intelligence.orchestrator import IntelligenceOrchestrator
from app.services.intelligence.summarization import SummarizationService
from app.services.intelligence.table import TableIntelligenceService

__all__ = [
    "SummarizationService",
    "ComparisonService",
    "StructuredExtractionService",
    "EntityExtractionService",
    "TableIntelligenceService",
    "InsightsService",
    "IntelligenceOrchestrator",
    "IntelligenceExportService",
    "SummaryRequest",
    "SummaryResponse",
    "SummarySection",
    "ComparisonRequest",
    "ComparisonResponse",
    "DifferenceItem",
    "ExtractionRequest",
    "ExtractionResponse",
    "ExtractedFieldItem",
    "TableAnalysisResult",
    "InsightsRequest",
    "InsightsResponse",
    "InsightItem",
    "IntelligenceJobResponse",
    "ExportRequest",
]
