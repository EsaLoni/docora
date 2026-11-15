"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  FileText,
  GitCompare,
  Cpu,
  BarChart3,
  Download,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  page_count: number;
  mime_type: string;
  status: string;
}

interface DifferenceItem {
  category: string;
  doc_a_value?: string;
  doc_b_value?: string;
  explanation: string;
  doc_refs: string[];
  page_refs: number[];
  status: "conflicting" | "missing" | "verified" | "matching";
  confidence: number;
}

interface ExtractedField {
  field_name: string;
  value: any;
  data_type: string;
  source_document: string;
  page_number?: number;
  supporting_text?: string;
  confidence: number;
  status: string;
}

interface InsightItem {
  insight_type: string;
  title: string;
  description: string;
  category: "directly_extracted_fact" | "llm_interpretation" | "calculated_metric" | "unverified_observation";
  evidence_text?: string;
  page_number?: number;
  confidence_score: number;
}

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<"summaries" | "extract" | "compare" | "analytics">("summaries");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Summarize state
  const [summaryDocId, setSummaryDocId] = useState<string>("");
  const [summaryType, setSummaryType] = useState<"quick" | "detailed" | "section_wise" | "custom">("quick");
  const [customSummaryPrompt, setCustomSummaryPrompt] = useState("");
  const [summaryResult, setSummaryResult] = useState<any | null>(null);

  // Compare state
  const [compareDocIds, setCompareDocIds] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<"comprehensive" | "financial" | "clauses" | "custom">("comprehensive");
  const [customComparePrompt, setCustomComparePrompt] = useState("");
  const [compareResult, setCompareResult] = useState<any | null>(null);

  // Extract state
  const [extractDocId, setExtractDocId] = useState<string>("");
  const [extractTemplate, setExtractTemplate] = useState<"invoice" | "contract" | "financial" | "entities" | "custom">("entities");
  const [customExtractFields, setCustomExtractFields] = useState("");
  const [extractResult, setExtractResult] = useState<any | null>(null);

  // Analytics/Insights state
  const [insightsDocId, setInsightsDocId] = useState<string>("");
  const [insightsFilter, setInsightsFilter] = useState<string>("all");
  const [insightsResult, setInsightsResult] = useState<any | null>(null);

  // Fetch document list on mount
  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoadingDocs(true);
        const res = await fetch("http://localhost:8000/api/v1/documents", {
          headers: { "x-dev-user-email": "dev@udip.local" },
        });
        if (res.ok) {
          const data = await res.json();
          const items: DocumentItem[] = data.items || [];
          setDocuments(items);
          if (items.length > 0) {
            setSummaryDocId(items[0].id);
            setExtractDocId(items[0].id);
            setInsightsDocId(items[0].id);
            if (items.length >= 2) {
              setCompareDocIds([items[0].id, items[1].id]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
      } finally {
        setIsLoadingDocs(false);
      }
    }
    loadDocuments();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSummary = async () => {
    if (!summaryDocId) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSummaryResult(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          document_id: summaryDocId,
          summary_type: summaryType,
          custom_instruction: summaryType === "custom" ? customSummaryPrompt : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate summary");
      }

      const data = await res.json();
      setSummaryResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompareDocuments = async () => {
    if (compareDocIds.length < 2) {
      setErrorMsg("Please select at least two documents to compare.");
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    setCompareResult(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          document_ids: compareDocIds,
          comparison_type: comparisonType,
          custom_prompt: comparisonType === "custom" ? customComparePrompt : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to compare documents");
      }

      const data = await res.json();
      setCompareResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractData = async () => {
    if (!extractDocId) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setExtractResult(null);

    const customFieldsList =
      extractTemplate === "custom"
        ? customExtractFields
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean)
        : undefined;

    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          document_id: extractDocId,
          template: extractTemplate,
          custom_fields: customFieldsList,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to extract structured data");
      }

      const data = await res.json();
      setExtractResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!insightsDocId) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setInsightsResult(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          document_id: insightsDocId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate analytics");
      }

      const data = await res.json();
      setInsightsResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (exportType: string, format: "pdf" | "markdown" | "csv" | "json", payload: any) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          export_type: exportType,
          format: format,
          payload: payload,
        }),
      });

      if (!res.ok) throw new Error("Failed to export artifact");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `docora_${exportType}_export.${format === "markdown" ? "md" : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export report.");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[#F1F5FC] leading-tight">AI Insights</h1>
          <p className="text-[13px] text-[#A0AEC0] mt-1">
            Extract structured data, synthesize summaries, compare documents, and review automated analytics.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
          <button
            onClick={() => setActiveTab("summaries")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors",
              activeTab === "summaries"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Summaries</span>
          </button>

          <button
            onClick={() => setActiveTab("extract")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors",
              activeTab === "extract"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Data Extraction</span>
          </button>

          <button
            onClick={() => setActiveTab("compare")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors",
              activeTab === "compare"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span>Comparison</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors",
              activeTab === "analytics"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 text-xs flex items-center justify-between border border-red-200 dark:border-red-900/40">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: SUMMARIES */}
      {/* ========================================================================= */}
      {activeTab === "summaries" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Form */}
          <div className="bg-card border rounded-xl p-5 space-y-4 h-fit shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground">Configure Summary</h2>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Document
              </label>
              <select
                value={summaryDocId}
                onChange={(e) => setSummaryDocId(e.target.value)}
                className="w-full bg-muted/40 border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary text-foreground"
                disabled={isLoadingDocs}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.filename})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Format
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["quick", "detailed", "section_wise", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSummaryType(m)}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium rounded-lg border capitalize text-center transition-colors",
                      summaryType === m
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted/30 hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {m.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {summaryType === "custom" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Custom Instructions
                </label>
                <textarea
                  value={customSummaryPrompt}
                  onChange={(e) => setCustomSummaryPrompt(e.target.value)}
                  placeholder="e.g. Focus on financial metrics and compliance covenants..."
                  rows={3}
                  className="w-full bg-muted/40 border rounded-lg p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>
            )}

            <button
              onClick={handleGenerateSummary}
              disabled={isProcessing || !summaryDocId}
              className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-2xs"
            >
              {isProcessing ? "Synthesizing Summary..." : "Generate Summary"}
            </button>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-2">
            {summaryResult ? (
              <div className="bg-card border rounded-xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Generated Summary</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Format: {summaryResult.summary_type} &bull; Generated in {summaryResult.processing_time_ms || 120}ms
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(summaryResult.summary_text)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => handleExport("summary", "markdown", summaryResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3 w-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                  {summaryResult.summary_text}
                </div>

                {summaryResult.key_points && summaryResult.key_points.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t">
                    <h4 className="text-xs font-medium text-foreground">Key Takeaways</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                      {summaryResult.key_points.map((pt: string, idx: number) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">No summary generated yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Select a document and format mode on the left to synthesize an executive summary.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DATA EXTRACTION */}
      {/* ========================================================================= */}
      {activeTab === "extract" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card border rounded-xl p-5 space-y-4 h-fit shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground">Extraction Template</h2>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Document
              </label>
              <select
                value={extractDocId}
                onChange={(e) => setExtractDocId(e.target.value)}
                className="w-full bg-muted/40 border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary text-foreground"
                disabled={isLoadingDocs}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.filename})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Schema
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["entities", "invoice", "contract", "financial", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExtractTemplate(t)}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium rounded-lg border capitalize text-center transition-colors",
                      extractTemplate === t
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted/30 hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {extractTemplate === "custom" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Target Fields (comma-separated)
                </label>
                <input
                  type="text"
                  value={customExtractFields}
                  onChange={(e) => setCustomExtractFields(e.target.value)}
                  placeholder="e.g. total_amount, due_date, party_names"
                  className="w-full bg-muted/40 border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            )}

            <button
              onClick={handleExtractData}
              disabled={isProcessing || !extractDocId}
              className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-2xs"
            >
              {isProcessing ? "Extracting Data..." : "Run Structured Extraction"}
            </button>
          </div>

          <div className="lg:col-span-2">
            {extractResult ? (
              <div className="bg-card border rounded-xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Extracted Fields</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Template: {extractResult.template} &bull; {extractResult.fields?.length || 0} fields identified
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport("extraction", "csv", extractResult)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-muted/20 text-muted-foreground font-medium">
                        <th className="py-2.5 px-3">Field</th>
                        <th className="py-2.5 px-3">Extracted Value</th>
                        <th className="py-2.5 px-3 w-20">Type</th>
                        <th className="py-2.5 px-3 w-20">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(extractResult.fields || []).map((f: ExtractedField, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">{f.field_name}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-foreground">{String(f.value)}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-[10px]">{f.data_type}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-600">
                            {Math.round((f.confidence || 0.95) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center space-y-2">
                <Cpu className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">No fields extracted</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Run structured extraction to parse tabular and key-value data with high confidence.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMPARISON */}
      {/* ========================================================================= */}
      {activeTab === "compare" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card border rounded-xl p-5 space-y-4 h-fit shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground">Compare Documents</h2>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Select 2 or more files
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {documents.map((d) => {
                  const isChecked = compareDocIds.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setCompareDocIds(compareDocIds.filter((id) => id !== d.id));
                          } else {
                            setCompareDocIds([...compareDocIds, d.id]);
                          }
                        }}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="truncate text-foreground font-medium">{d.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Comparison Scope
              </label>
              <select
                value={comparisonType}
                onChange={(e) => setComparisonType(e.target.value as any)}
                className="w-full bg-muted/40 border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="comprehensive">Comprehensive Diff</option>
                <option value="financial">Financial Terms & Amounts</option>
                <option value="clauses">Legal Clauses & Liability</option>
                <option value="custom">Custom Instruction</option>
              </select>
            </div>

            <button
              onClick={handleCompareDocuments}
              disabled={isProcessing || compareDocIds.length < 2}
              className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-2xs"
            >
              {isProcessing ? "Running Comparison..." : "Compare Documents"}
            </button>
          </div>

          <div className="lg:col-span-2">
            {compareResult ? (
              <div className="bg-card border rounded-xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Comparison Report</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {compareResult.differences?.length || 0} differences detected
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport("comparison", "markdown", compareResult)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export Diff</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(compareResult.differences || []).map((diff: DifferenceItem, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{diff.category}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          {diff.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{diff.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center space-y-2">
                <GitCompare className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">No comparison performed</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Select at least two documents on the left to align and identify discrepancies.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ANALYTICS / INSIGHTS */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card border rounded-xl p-5 space-y-4 h-fit shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground">Run Document Analytics</h2>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Target Document
              </label>
              <select
                value={insightsDocId}
                onChange={(e) => setInsightsDocId(e.target.value)}
                className="w-full bg-muted/40 border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary text-foreground"
                disabled={isLoadingDocs}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.filename})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateInsights}
              disabled={isProcessing || !insightsDocId}
              className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-2xs"
            >
              {isProcessing ? "Analyzing Document..." : "Generate Analytics"}
            </button>
          </div>

          <div className="lg:col-span-2">
            {insightsResult ? (
              <div className="bg-card border rounded-xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Calculated Analytics</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {insightsResult.insights?.length || 0} observations synthesized
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(insightsResult.insights || []).map((ins: InsightItem, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{ins.title}</span>
                        <span className="text-[10px] text-emerald-600 font-mono">
                          {Math.round((ins.confidence_score || 0.9) * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{ins.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center space-y-2">
                <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">No analytics generated</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Select a document to uncover calculated metrics, risks, and compliance checks.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
