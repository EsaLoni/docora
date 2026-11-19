"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  X,
  Sparkles,
  Cpu,
  Layers,
  FileText,
  ChevronRight,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  document_title: string;
  page_number: number;
  content: string;
  section_title?: string | null;
  score: number;
  retrieval_mode: "hybrid" | "vector" | "keyword";
  metadata?: Record<string, any>;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult?: (result: SearchResult) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectResult,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hybrid" | "vector" | "keyword">("hybrid");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Simulated search results for frontend demonstration
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    // Simulate backend retrieval pipeline (in real client, calls POST /api/v1/search)
    await new Promise((r) => setTimeout(r, 600));

    const qLower = query.toLowerCase();
    const simulatedResults: SearchResult[] = [
      {
        chunk_id: "chk-001",
        document_id: "doc-1",
        document_filename: "q3_2026_earnings.pdf",
        document_title: "Q3 2026 Earnings Report",
        page_number: 3,
        content: `Operating margins increased by 3.2% year-over-year, driven by automated document intelligence workflows. Net recurring revenue exceeded forecasts by $1.8M. Cash flows from operations were strongly positive.`,
        section_title: "Financial Performance Summary",
        score: mode === "hybrid" ? 0.94 : mode === "vector" ? 0.91 : 0.88,
        retrieval_mode: mode,
      },
      {
        chunk_id: "chk-002",
        document_id: "doc-2",
        document_filename: "enterprise_msa_v2.docx",
        document_title: "Master Services Agreement (MSA)",
        page_number: 7,
        content: `Section 7.4 (Confidentiality & Data Protection): All customer documents, metadata, and extracted text shall remain strictly isolated within dedicated multi-tenant workspaces with cryptographic access controls.`,
        section_title: "Data Isolation & Security",
        score: mode === "hybrid" ? 0.89 : mode === "vector" ? 0.86 : 0.92,
        retrieval_mode: mode,
      },
      {
        chunk_id: "chk-003",
        document_id: "doc-3",
        document_filename: "udip_architecture_2026.pdf",
        document_title: "System Architecture Roadmap",
        page_number: 12,
        content: `The hybrid retrieval pipeline combines 384-dimensional dense vectors (sentence-transformers/all-MiniLM-L6-v2) with sparse full-text lexical ranking via Reciprocal Rank Fusion (RRF, k=60).`,
        section_title: "Retrieval Architecture",
        score: mode === "hybrid" ? 0.84 : mode === "vector" ? 0.87 : 0.81,
        retrieval_mode: mode,
      },
    ];

    // Filter results loosely on query if relevant words match
    const filtered = simulatedResults.filter(
      (r) =>
        r.content.toLowerCase().includes(qLower) ||
        r.document_title.toLowerCase().includes(qLower) ||
        (r.section_title && r.section_title.toLowerCase().includes(qLower)) ||
        qLower.split(" ").some((w) => w.length > 2 && r.content.toLowerCase().includes(w))
    );

    setResults(filtered.length > 0 ? filtered : simulatedResults);
    setIsLoading(false);
  };

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
        {/* Search Header Form */}
        <form onSubmit={handleSearch} className="border-b p-4 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <input
              type="text"
              placeholder="Search across all documents, pages, and tables..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent border-none outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
            >
              Search
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Selector & Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" /> Mode:
              </span>
              <button
                type="button"
                onClick={() => setMode("hybrid")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1",
                  mode === "hybrid"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3 w-3" />
                Hybrid (RRF)
              </button>
              <button
                type="button"
                onClick={() => setMode("vector")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1",
                  mode === "vector"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Cpu className="h-3 w-3" />
                Vector
              </button>
              <button
                type="button"
                onClick={() => setMode("keyword")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1",
                  mode === "keyword"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="h-3 w-3" />
                Keyword
              </button>
            </div>

            <span className="text-micro text-muted-foreground font-mono">
              384-Dim pgvector + FTS
            </span>
          </div>
        </form>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <Clock className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Computing embeddings and fusing reciprocal ranks...</p>
            </div>
          ) : !hasSearched ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Search className="h-8 w-8 mx-auto opacity-30 text-primary" />
              <p className="text-sm font-medium text-foreground">Search Docora Workspace</p>
              <p className="text-xs max-w-sm mx-auto">
                Query across all extracted document chunks using semantic vector similarity,
                lexical keyword search, or calibrated Hybrid RRF fusion.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <p className="text-sm font-medium text-foreground">No matching citations found</p>
              <p className="text-xs">Try broader keywords or switch to Semantic Vector mode.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Found {results.length} ranked citations</span>
                <span className="capitalize text-[11px]">Ranked via {mode} fusion</span>
              </div>

              {results.map((res) => (
                <div
                  key={res.chunk_id}
                  onClick={() => onSelectResult && onSelectResult(res)}
                  className="group p-4 rounded-xl border bg-card hover:border-primary/60 transition-all hover:shadow-sm cursor-pointer space-y-2"
                >
                  {/* Result Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {res.document_title}
                      </span>
                      <span className="text-micro px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground shrink-0 font-mono">
                        Page {res.page_number}
                      </span>
                      {res.section_title && (
                        <span className="text-micro px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20 truncate hidden sm:inline">
                          {res.section_title}
                        </span>
                      )}
                    </div>

                    {/* Score Indicator */}
                    <div className="flex items-center gap-1 shrink-0 font-mono">
                      <span
                        className={cn(
                          "text-micro font-bold px-2 py-0.5 rounded-full",
                          res.score >= 0.9
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : res.score >= 0.8
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        )}
                      >
                        {Math.round(res.score * 100)}% Match
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Passage Snippet */}
                  <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-muted/20 p-2.5 rounded-lg border border-border/40 select-text">
                    &ldquo;{res.content}&rdquo;
                  </p>

                  {/* Result Footer */}
                  <div className="flex items-center justify-between text-micro text-muted-foreground pt-1">
                    <span className="font-mono">{res.document_filename}</span>
                    <span className="inline-flex items-center gap-1 text-primary font-medium group-hover:underline">
                      Inspect Citation Page <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t px-4 py-2.5 bg-muted/20 flex items-center justify-between text-caption text-muted-foreground">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted border rounded font-mono text-micro">Esc</kbd> to exit</span>
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Bookmark className="h-3 w-3 text-primary" /> Workspace Multi-Tenant Guarded
          </span>
        </div>
      </div>
    </div>
  );
}
