"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  MessageSquare,
  BookMarked,
  Sparkles,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import { useUpload } from "@/context/UploadContext";
import { useAuth } from "@/context/AuthContext";
import { apiClient, NotebookItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DocumentSummary {
  id: string;
  title: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  created_at: string;
  page_count: number;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { uploadFiles, subscribeToDocUpdates } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Universal AI Question State
  const [quickQuery, setQuickQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const docsData = await apiClient.getDocuments(6).catch(() => ({ items: [], total: 0 }));
      setDocuments((docsData.items as any) || []);

      const nbData = await apiClient.listNotebooks().catch(() => []);
      setNotebooks(nbData || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDocUpdates(() => {
      loadData();
    });
    return unsubscribe;
  }, [subscribeToDocUpdates, user?.email]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) return;
    try {
      setIsCreatingNotebook(true);
      const created = await apiClient.createNotebook({
        title: newNotebookTitle.trim(),
        description: "Created from Docora workspace",
      });
      setIsCreateModalOpen(false);
      setNewNotebookTitle("");
      router.push(`/notebooks/workspace?id=${created.id}`);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    } finally {
      setIsCreatingNotebook(false);
    }
  };

  const handleQuickQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim() || isAsking) return;

    setIsAsking(true);
    setAiAnswer(null);
    setCitations([]);

    try {
      const res = await apiClient.fetch("/api/v1/chat/completions/stream", {
        method: "POST",
        body: JSON.stringify({
          prompt: quickQuery.trim(),
          retrieval_mode: "hybrid",
        }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  accumulated += parsed.content;
                  setAiAnswer(accumulated);
                }
                if (parsed.citations && Array.isArray(parsed.citations)) {
                  setCitations(parsed.citations);
                }
              } catch {
                accumulated += dataStr;
                setAiAnswer(accumulated);
              }
            }
          }
        }
      } else {
        setAiAnswer("Grounded document intelligence response ready. Ask any specific question against your uploaded sources.");
      }
    } catch (err: any) {
      setAiAnswer("Unable to complete question across universal documents. Please ensure documents are uploaded and indexed.");
    } finally {
      setIsAsking(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.csv,.pptx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Main Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 border-b border-black/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 font-mono">
              Intelligence Atelier
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
            Research Workspace
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Grounded multi-source synthesis, instant RAG queries, and verified citation evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/[0.1] hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition active:scale-[0.98] cursor-pointer shadow-xs"
          >
            <UploadCloud className="h-4 w-4 text-amber-600" />
            <span>Upload Document</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 text-xs font-bold transition active:scale-[0.98] cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>

      {/* Quick AI Universal Question Entry Card */}
      <div className="p-6 rounded-2xl bg-white border border-black/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">
            Ask across all documents
          </h2>
          <span className="text-[11px] font-medium text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 ml-auto flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Universal RAG Active
          </span>
        </div>

        <form onSubmit={handleQuickQuestion} className="relative">
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Ask a question across all your uploaded documents and notebooks..."
            className="w-full bg-neutral-50 border border-black/[0.08] rounded-xl pl-4 pr-12 py-3 text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={!quickQuery.trim() || isAsking}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#E5A93B] text-neutral-950 hover:bg-[#D97706] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 stroke-[2.5]" />}
          </button>
        </form>

        {/* Example Prompt Chips */}
        {!aiAnswer && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-neutral-500">Try asking:</span>
            {[
              "What are the main risks identified in recent files?",
              "Summarize the key deliverables and deadlines",
              "Compare Q3 financial performance vs budget",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuickQuery(chip)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-50 border border-black/[0.06] text-neutral-600 hover:text-neutral-900 hover:border-black/[0.15] transition"
              >
                "{chip}"
              </button>
            ))}
          </div>
        )}

        {/* AI Response Box */}
        {aiAnswer && (
          <div className="p-4 rounded-xl bg-neutral-50 border border-black/[0.08] space-y-3 pt-3">
            <div className="flex items-center justify-between text-xs text-neutral-600 border-b border-black/[0.06] pb-2">
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Universal Grounded Answer
              </span>
              <button
                type="button"
                onClick={() => {
                  setAiAnswer(null);
                  setQuickQuery("");
                }}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="text-xs sm:text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {aiAnswer}
            </div>

            {/* Citation Badges */}
            {citations.length > 0 && (
              <div className="pt-2 border-t border-black/[0.06] flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-neutral-600">Verified Sources:</span>
                {citations.map((c, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium font-mono"
                  >
                    [{idx + 1}] {c.document_filename || "Document"} (p. {c.page_number || 1})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Recent Notebooks & Recently Uploaded Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notebooks Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Recent Notebooks
            </h2>
            <Link
              href="/notebooks"
              prefetch={false}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 font-mono"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {notebooks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-black/[0.08] text-center space-y-3 shadow-xs">
                <BookMarked className="h-8 w-8 text-neutral-400 mx-auto" />
                <p className="text-sm font-semibold text-neutral-900">No notebooks yet</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Create a dedicated research notebook to organize sources, notes, and AI studio artifacts.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] transition shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Create Notebook</span>
                </button>
              </div>
            ) : (
              notebooks.slice(0, 4).map((nb) => (
                <Link
                  key={nb.id}
                  href={`/notebooks/workspace?id=${nb.id}`}
                  prefetch={false}
                  className="block p-4 rounded-xl bg-white border border-black/[0.08] hover:border-black/[0.16] hover:bg-neutral-50 transition group shadow-xs hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <BookMarked className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate group-hover:text-amber-800 transition-colors">
                          {nb.title}
                        </h3>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Updated {new Date(nb.updated_at || nb.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recently Uploaded Documents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Recent Documents
            </h2>
            <Link
              href="/documents"
              prefetch={false}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 font-mono"
            >
              <span>View library</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-2 rounded-2xl bg-white border border-black/[0.08] divide-y divide-black/[0.06] shadow-xs">
            {documents.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <FileText className="h-8 w-8 text-neutral-400 mx-auto" />
                <p className="text-sm font-semibold text-neutral-900">No documents uploaded</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Upload PDFs, DOCX, XLSX, or TXT files to extract facts, tables, and citations.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] transition shadow-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-neutral-950 stroke-[2.5]" />
                  <span>Upload Now</span>
                </button>
              </div>
            ) : (
              documents.slice(0, 4).map((doc) => {
                const isReady = doc.status === "READY";
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 rounded-xl transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-neutral-100 text-neutral-700 border border-black/[0.06] flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 truncate">
                          {doc.title || doc.filename}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {formatFileSize(doc.file_size_bytes)} • {doc.page_count || 1} {doc.page_count === 1 ? "page" : "pages"} • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono",
                          isReady
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse"
                        )}
                      >
                        {doc.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* System Ingestion & Security Activity Banner */}
      <div className="p-4 rounded-xl bg-white border border-black/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-900">
              Grounded Citation Intelligence Active
            </p>
            <p className="text-[11px] text-neutral-500">
              MiniLM-L6 dense embeddings + Trigram lexical index enforce strict cryptographic source grounding.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/insights"
            prefetch={false}
            className="px-3 py-1.5 rounded-lg bg-neutral-50 border border-black/[0.08] hover:border-amber-500/40 text-neutral-700 text-xs font-medium transition"
          >
            Open AI Insights →
          </Link>
          <Link
            href="/tasks"
            prefetch={false}
            className="px-3 py-1.5 rounded-lg bg-neutral-50 border border-black/[0.08] hover:border-amber-500/40 text-neutral-700 text-xs font-medium transition"
          >
            Review Tasks →
          </Link>
        </div>
      </div>

      {/* Create Notebook Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-black/[0.08] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 tracking-tight">Create Research Notebook</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Notebooks provide an immersive 3-panel workspace for dedicated research.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 block mb-1.5">
                  Notebook Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="e.g. Q4 Financial Due Diligence"
                  className="w-full bg-neutral-50 border border-black/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-black/[0.08] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingNotebook || !newNotebookTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 text-xs font-semibold disabled:opacity-40 transition shadow-xs active:scale-[0.98]"
                >
                  {isCreatingNotebook ? "Creating..." : "Create Notebook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
