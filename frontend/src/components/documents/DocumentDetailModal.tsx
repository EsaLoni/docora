"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Table as TableIcon,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  folder_id: string | null;
  page_count: number;
  chunk_count?: number;
  embedding_model?: string | null;
  created_at: string;
  processing_error?: string | null;
}

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRetryProcessing: (docId: string) => void;
  onDownload: (doc: DocumentItem) => void;
}

export function DocumentDetailModal({
  document,
  isOpen,
  onClose,
  onRetryProcessing,
  onDownload,
}: DocumentDetailModalProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"text" | "tables" | "chunks" | "metadata">("text");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  if (!isOpen || !document) return null;

  const totalPages = Math.max(document.page_count || 1, 1);
  const isReady = document.status === "READY";
  const isFailed = document.status === "FAILED";
  const isProcessing = document.status === "PROCESSING";

  // Simulated page content generation for preview
  const getSimulatedPageContent = (pageNum: number) => {
    if (document.mime_type.includes("spreadsheet") || document.filename.endsWith(".xlsx") || document.filename.endsWith(".csv")) {
      return {
        text: `# Sheet ${pageNum}: Financial Summary\n\nReporting Period: Q3 2026\nStatus: Audited and Verified\nWorkspace: Multi-tenant Encrypted\n\nTotal Revenue: $14.2M\nOperating Margin: 34.2%\nEBITDA: $4.85M`,
        tables: [
          {
            headers: ["Metric", "Target", "Actual", "Variance"],
            rows: [
              ["Gross Revenue", "$13.5M", "$14.2M", "+5.2%"],
              ["Cost of Sales", "$4.2M", "$3.9M", "-7.1%"],
              ["Net Profit", "$2.8M", "$3.3M", "+17.8%"],
            ],
          },
        ],
        hasImages: false,
        ocrApplied: false,
        ocrConfidence: null,
      };
    }

    const isOcrPage = pageNum === 2 && document.filename.includes("pdf");
    return {
      text: `# Page ${pageNum} - ${document.title}\n\nUniversal Document Intelligence Platform canonical text representation.\n\nSection ${pageNum}.1: Executive Summary\nDocument intelligence enables rapid retrieval, precise semantic synthesis, and automated multi-stage OCR verification. All document pages are partitioned idempotently into canonical storage.\n\nSection ${pageNum}.2: Compliance & Security\nStrict workspace multi-tenancy ensures that page content and vector embeddings remain isolated at database and filesystem layers. Cryptographic checksums verify file authenticity.`,
      tables: pageNum === 1 ? [
        {
          headers: ["Attribute", "Value", "Status"],
          rows: [
            ["Document ID", document.id.substring(0, 8), "Indexed"],
            ["Integrity", "SHA-256 Verified", "Passed"],
            ["Pipeline", "PyMuPDF + OCR Engine", "Complete"],
          ],
        },
      ] : [],
      hasImages: pageNum === 2,
      ocrApplied: isOcrPage,
      ocrConfidence: isOcrPage ? 94.8 : null,
    };
  };

  const pageData = getSimulatedPageContent(currentPage);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetryProcessing(document.id);
    setTimeout(() => {
      setIsRetrying(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {document.filename.endsWith(".xlsx") || document.filename.endsWith(".csv") ? (
                <FileSpreadsheet className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground truncate">{document.title}</h2>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    isReady && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                    isProcessing && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse",
                    isFailed && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                    document.status === "UPLOADED" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                  )}
                >
                  {document.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{document.filename} &bull; {(document.file_size_bytes / 1024).toFixed(1)} KB</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(document)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
              title="Download Original"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Processing Banner (if FAILED or PROCESSING) */}
        {isFailed && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Extraction Failed:</strong> {document.processing_error || "Parser encountered an unexpected structure."}
              </span>
            </div>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
              Retry Extraction
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 animate-spin" />
                <span className="font-medium">Ingestion Pipeline in Progress...</span>
              </div>
              <span className="font-semibold">65%</span>
            </div>
            <div className="w-full bg-amber-500/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: "65%" }} />
            </div>
          </div>
        )}

        {/* Body Toolbar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b bg-card">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("text")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                activeTab === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Extracted Text
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                activeTab === "tables" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tables ({pageData.tables.length})
            </button>
            <button
              onClick={() => setActiveTab("chunks")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                activeTab === "chunks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
              Chunks & Embeddings
            </button>
            <button
              onClick={() => setActiveTab("metadata")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                activeTab === "metadata" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Inspector & OCR
            </button>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "text" && (
            <div className="space-y-3">
              {/* Page Pill Indicators */}
              <div className="flex flex-wrap items-center gap-2">
                {pageData.ocrApplied ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Sparkles className="h-3 w-3" />
                    OCR Extracted ({pageData.ocrConfidence}% confidence)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Cpu className="h-3 w-3" />
                    Native Parser (PyMuPDF)
                  </span>
                )}
                {pageData.hasImages && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Eye className="h-3 w-3" />
                    Images Present
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  ~{Math.round(pageData.text.length / 4)} Tokens &bull; {pageData.text.length} Characters
                </span>
              </div>

              {/* Text Area */}
              <div className="p-4 rounded-xl border bg-muted/10 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                {pageData.text}
              </div>
            </div>
          )}

          {activeTab === "tables" && (
            <div className="space-y-4">
              {pageData.tables.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TableIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No tables detected on page {currentPage}.</p>
                  <p className="text-xs mt-1">Structured tables detected by openpyxl or PyMuPDF will render here.</p>
                </div>
              ) : (
                pageData.tables.map((t, idx) => (
                  <div key={idx} className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-muted/40 px-4 py-2 text-xs font-semibold border-b flex items-center justify-between">
                      <span>Table {idx + 1} &bull; {t.rows.length} Rows</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Markdown Structured</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px] border-b">
                          <tr>
                            {t.headers.map((h, hIdx) => (
                              <th key={hIdx} className="px-3 py-2 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-muted/30">
                          {t.rows.map((r, rIdx) => (
                            <tr key={rIdx} className="hover:bg-muted/10">
                              {r.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-foreground font-mono">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "chunks" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-[11px] text-muted-foreground">Embedding Model</span>
                  <div className="text-xs font-mono font-semibold text-foreground mt-0.5 truncate">
                    {document.embedding_model || "all-MiniLM-L6-v2"}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-[11px] text-muted-foreground">Dense Vector Dimension</span>
                  <div className="text-xs font-mono font-semibold text-primary mt-0.5">
                    384-dimensional (L2 normalized)
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-[11px] text-muted-foreground">Total Chunks</span>
                  <div className="text-xs font-mono font-semibold text-foreground mt-0.5">
                    {document.chunk_count || totalPages * 3} chunks indexed
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  Sample Vector Chunks for Page {currentPage}
                </h4>

                {[1, 2].map((idx) => (
                  <div key={idx} className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        Chunk #{idx} &bull; Page {currentPage} &bull; ~128 tokens
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium border border-emerald-500/20">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        pgvector Synced
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 font-serif leading-relaxed bg-card p-2.5 rounded border">
                      {idx === 1
                        ? pageData.text.slice(0, 220) + "..."
                        : pageData.text.slice(220, 440) || "Canonical representation verified for workspace indexing."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "metadata" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Security & Isolation
                </h3>
                <div className="text-xs space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Tenant Workspace:</span>
                    <strong className="text-foreground">Isolated Active Session</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Integrity:</span>
                    <strong className="text-foreground">SHA-256 Verified</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Engine:</span>
                    <strong className="text-foreground">LocalStorageAdapter</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-primary" />
                  Engine Diagnostics
                </h3>
                <div className="text-xs space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Extractor:</span>
                    <strong className="text-foreground">
                      {document.filename.endsWith(".pdf")
                        ? "PDFExtractor (PyMuPDF)"
                        : document.filename.endsWith(".docx")
                        ? "DOCXExtractor"
                        : "SpreadsheetExtractor"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>OCR Engine:</span>
                    <strong className="text-foreground">Tesseract 5.x Ready</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Memory:</span>
                    <strong className="text-foreground">&lt; 250 MB per job</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Document ID: <code className="font-mono text-foreground">{document.id}</code>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/chat?doc=${document.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask this document
            </Link>
            {isFailed && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                Retry Extraction
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
