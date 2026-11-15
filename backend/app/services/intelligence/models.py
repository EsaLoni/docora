"""Data Transfer Objects and Schemas for Document Intelligence Services."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
import uuid
from pydantic import BaseModel, Field


# -------------------------------------------------------------------------
# Summarization Models
# -------------------------------------------------------------------------

SummaryType = Literal["quick", "detailed", "section_wise", "custom"]


class SummarySection(BaseModel):
    title: str
    text: str
    page_number: Optional[int] = None


class SummaryRequest(BaseModel):
    document_id: uuid.UUID
    summary_type: SummaryType = "quick"
    custom_instruction: Optional[str] = None
    additional_document_ids: Optional[List[uuid.UUID]] = None


class SummaryResponse(BaseModel):
    id: Optional[str] = None
    document_id: str
    summary_type: str
    summary_text: str
    executive_summary: Optional[str] = None
    sections: List[SummarySection] = Field(default_factory=list)
    key_findings: List[str] = Field(default_factory=list)
    key_facts: List[str] = Field(default_factory=list)
    important_dates_and_numbers: List[str] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = "unknown"
    provider: str = "unknown"
    created_at: str


# -------------------------------------------------------------------------
# Multi-Document Comparison Models
# -------------------------------------------------------------------------

ComparisonType = Literal["comprehensive", "financial", "clauses", "custom"]
DifferenceStatus = Literal["conflicting", "missing", "verified", "matching"]


class DifferenceItem(BaseModel):
    category: str
    doc_a_value: Optional[str] = None
    doc_b_value: Optional[str] = None
    explanation: str
    doc_refs: List[str] = Field(default_factory=list)
    page_refs: List[int] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    status: DifferenceStatus = "conflicting"
    confidence: float = 1.0


class ComparisonRequest(BaseModel):
    document_ids: List[uuid.UUID]
    comparison_type: ComparisonType = "comprehensive"
    custom_prompt: Optional[str] = None


class ComparisonResponse(BaseModel):
    id: Optional[str] = None
    document_ids: List[str]
    comparison_type: str
    summary_text: str
    common_themes: List[str] = Field(default_factory=list)
    differences: List[DifferenceItem] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = "unknown"
    provider: str = "unknown"
    created_at: str


# -------------------------------------------------------------------------
# Structured Extraction Models
# -------------------------------------------------------------------------

ExtractionTemplate = Literal["invoice", "contract", "financial", "entities", "custom"]


class ExtractedFieldItem(BaseModel):
    field_name: str
    value: Any = None
    data_type: str = "string"  # 'string', 'monetary', 'date', 'number', 'address', 'email', 'phone', 'clause', 'null'
    source_document: str = ""
    page_number: Optional[int] = None
    supporting_text: Optional[str] = None
    confidence: float = 1.0
    is_calculated: bool = False
    status: str = "verified"


class ExtractionRequest(BaseModel):
    document_id: uuid.UUID
    template: ExtractionTemplate = "entities"
    custom_fields: Optional[List[str]] = None


class ExtractionResponse(BaseModel):
    id: Optional[str] = None
    document_id: str
    extraction_type: str
    fields: List[ExtractedFieldItem] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str


# -------------------------------------------------------------------------
# Table Intelligence Models
# -------------------------------------------------------------------------

class ColumnStatistics(BaseModel):
    column_name: str
    data_type: str  # 'numeric', 'text', 'date', 'empty'
    count: int
    non_null_count: int
    missing_count: int
    unique_count: int
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    sum_value: Optional[float] = None


class TableAnalysisResult(BaseModel):
    table_index: int
    page_number: int
    headers: List[str] = Field(default_factory=list)
    row_count: int = 0
    col_count: int = 0
    summary: str = ""
    columns: List[ColumnStatistics] = Field(default_factory=list)
    missing_cells_count: int = 0
    outliers: List[Dict[str, Any]] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Document Insights Models
# -------------------------------------------------------------------------

InsightType = Literal[
    "key_finding",
    "risk",
    "deadline",
    "financial",
    "trend",
    "action_item",
    "contradiction",
    "missing_info",
]

InsightCategory = Literal[
    "directly_extracted_fact",
    "llm_interpretation",
    "calculated_metric",
    "unverified_observation",
]


class InsightItem(BaseModel):
    insight_type: InsightType
    title: str
    description: str
    category: InsightCategory = "directly_extracted_fact"
    evidence_text: Optional[str] = None
    page_number: Optional[int] = None
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    confidence_score: float = 1.0


class InsightsRequest(BaseModel):
    document_id: uuid.UUID
    focus_areas: Optional[List[str]] = None


class InsightsResponse(BaseModel):
    document_id: str
    total_insights: int
    insights: List[InsightItem] = Field(default_factory=list)
    categories_breakdown: Dict[str, int] = Field(default_factory=dict)
    created_at: str


# -------------------------------------------------------------------------
# Intelligence Job Models
# -------------------------------------------------------------------------

JobType = Literal["SUMMARIZE", "COMPARE", "EXTRACT", "INSIGHTS"]
JobStatus = Literal["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]


class IntelligenceJobResponse(BaseModel):
    job_id: str
    job_type: str
    document_ids: List[str]
    status: str
    progress_percentage: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------------------
# Export Models
# -------------------------------------------------------------------------

ExportFormat = Literal["pdf", "markdown", "csv", "json"]
ExportArtifactType = Literal["summary", "comparison", "extraction", "insights"]


class ExportRequest(BaseModel):
    export_type: ExportArtifactType
    format: ExportFormat
    record_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    payload: Optional[Dict[str, Any]] = None
