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
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Search,
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
      // Fetch documents
      const docsRes = await fetch("http://localhost:8000/api/v1/documents?page_size=6", {
        headers: {
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
      });
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.items || []);
      }

      // Fetch notebooks
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
      router.push(`/notebooks/${created.id}`);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    } finally {
      setIsCreatingNotebook(false);
    }
  };

  // Quick AI Universal Document Question
  const handleQuickQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim() || isAsking) return;

    setIsAsking(true);
    setAiAnswer(null);
    setCitations([]);

    try {
      // Send universal completion request
      const res = await fetch("http://localhost:8000/api/v1/chat/completions/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
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
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-[30px] font-semibold text-[#F1F5FC] tracking-tight leading-tight">
            Research Workspace
          </h1>
          <p className="text-[13px] text-[#A0AEC0] mt-1">
            Docora &bull; Your documents. Your intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151B27] border border-[#273247] hover:border-[#6D8FFF]/60 hover:bg-[#1B2332] text-[#F1F5FC] text-sm font-medium transition cursor-pointer shadow-xs"
          >
            <UploadCloud className="h-4 w-4 text-[#6D8FFF]" />
            <span>Upload Document</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-sm font-semibold hover:bg-[#84A2FF] transition cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>

      {/* Quick AI Universal Question Entry Card */}
      <div className="p-6 rounded-2xl bg-[#151B27] border border-[#273247] shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#1B2332] text-[#6D8FFF] flex items-center justify-center border border-[#273247]">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-[16px] font-semibold text-[#F1F5FC]">
            Ask across all documents
          </h2>
          <span className="text-[12px] font-medium text-[#34D399] px-2 py-0.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 ml-auto">
            Universal RAG Active
          </span>
        </div>

        <form onSubmit={handleQuickQuestion} className="relative">
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Ask a question across all your uploaded documents and notebooks..."
            className="w-full bg-[#10141D] border border-[#273247] rounded-xl pl-4 pr-12 py-3.5 text-[15px] text-[#F1F5FC] placeholder-[#A0AEC0]/60 focus:outline-hidden focus:border-[#6D8FFF] transition"
          />
          <button
            type="submit"
            disabled={!quickQuery.trim() || isAsking}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#6D8FFF] text-[#0B0D12] hover:bg-[#84A2FF] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {/* Example Prompt Chips */}
        {!aiAnswer && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[12px] font-medium text-[#A0AEC0]">Try asking:</span>
            {[
              "What are the main risks identified in recent files?",
              "Summarize the key deliverables and deadlines",
              "Compare Q3 financial performance vs budget",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuickQuery(chip)}
                className="text-[12px] px-2.5 py-1 rounded-lg bg-[#1B2332] border border-[#273247] text-[#A0AEC0] hover:text-[#F1F5FC] hover:border-[#6D8FFF]/40 transition"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* AI Response Box */}
        {aiAnswer && (
          <div className="p-4 rounded-xl bg-[#10141D] border border-[#273247] space-y-3 pt-3">
            <div className="flex items-center justify-between text-xs text-[#A0AEC0] border-b border-[#273247] pb-2">
              <span className="font-semibold text-[#F1F5FC] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#6D8FFF]" />
                Universal Grounded Answer
              </span>
              <button
                type="button"
                onClick={() => {
                  setAiAnswer(null);
                  setQuickQuery("");
                }}
                className="text-[11px] text-[#A0AEC0] hover:text-[#F1F5FC] underline"
              >
                Clear
              </button>
            </div>
            <div className="text-[15px] leading-[1.6] text-[#F1F5FC] whitespace-pre-wrap">
              {aiAnswer}
            </div>

            {/* Citation Badges */}
            {citations.length > 0 && (
              <div className="pt-2 border-t border-[#273247] flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-[#A0AEC0]">Verified Sources:</span>
                {citations.map((c, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-[11px] font-medium"
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
            <h2 className="text-[22px] font-semibold text-[#F1F5FC] tracking-tight">
              Recent Notebooks
            </h2>
            <Link
              href="/notebooks"
              className="text-[13px] font-medium text-[#6D8FFF] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {notebooks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#151B27] border border-[#273247] text-center space-y-3">
                <BookMarked className="h-8 w-8 text-[#A0AEC0]/60 mx-auto" />
                <p className="text-[15px] font-medium text-[#F1F5FC]">No notebooks yet</p>
                <p className="text-[13px] text-[#A0AEC0] max-w-xs mx-auto">
                  Create a dedicated research notebook to organize sources, notes, and AI studio artifacts.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Notebook</span>
                </button>
              </div>
            ) : (
              notebooks.slice(0, 4).map((nb) => (
                <Link
                  key={nb.id}
                  href={`/notebooks/${nb.id}`}
                  className="block p-4 rounded-xl bg-[#151B27] border border-[#273247] hover:border-[#3A4A68] hover:bg-[#1B2332] transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-[#1B2332] text-[#6D8FFF] border border-[#273247] flex items-center justify-center shrink-0">
                        <BookMarked className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-semibold text-[#F1F5FC] truncate group-hover:text-[#6D8FFF] transition-colors">
                          {nb.title}
                        </h3>
                        <p className="text-[12px] text-[#A0AEC0] mt-0.5">
                          Updated {new Date(nb.updated_at || nb.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#A0AEC0] group-hover:text-[#6D8FFF] group-hover:translate-x-0.5 transition" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recently Uploaded Documents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold text-[#F1F5FC] tracking-tight">
              Recent Documents
            </h2>
            <Link
              href="/documents"
              className="text-[13px] font-medium text-[#6D8FFF] hover:underline flex items-center gap-1"
            >
              <span>View library</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-2 rounded-2xl bg-[#151B27] border border-[#273247] divide-y divide-[#273247]">
            {documents.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <FileText className="h-8 w-8 text-[#A0AEC0]/60 mx-auto" />
                <p className="text-[15px] font-medium text-[#F1F5FC]">No documents uploaded</p>
                <p className="text-[13px] text-[#A0AEC0] max-w-xs mx-auto">
                  Upload PDFs, DOCX, XLSX, or TXT files to extract facts, tables, and citations.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1B2332] border border-[#273247] text-[#F1F5FC] text-xs font-semibold hover:border-[#6D8FFF] transition"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-[#6D8FFF]" />
                  <span>Upload Now</span>
                </button>
              </div>
            ) : (
              documents.slice(0, 4).map((doc) => {
                const isReady = doc.status === "READY";
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#1B2332]/60 rounded-xl transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-[#1B2332] text-[#6D8FFF] border border-[#273247] flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#F1F5FC] truncate">
                          {doc.title || doc.filename}
                        </p>
                        <p className="text-[12px] text-[#A0AEC0]">
                          {formatFileSize(doc.file_size_bytes)} &bull; {doc.page_count || 1} {doc.page_count === 1 ? "page" : "pages"} &bull; {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[11px] font-semibold",
                          isReady
                            ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30"
                            : "bg-[#6D8FFF]/15 text-[#6D8FFF] border border-[#6D8FFF]/30 animate-pulse"
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
      <div className="p-4 rounded-xl bg-[#151B27] border border-[#273247] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#1B2332] text-[#34D399] border border-[#273247] flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#F1F5FC]">
              Grounded Citation Intelligence Active
            </p>
            <p className="text-[12px] text-[#A0AEC0]">
              MiniLM-L6 dense embeddings + Trigram lexical index enforce strict cryptographic source grounding.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/insights"
            className="px-3 py-1.5 rounded-lg bg-[#1B2332] border border-[#273247] hover:border-[#6D8FFF] text-[#F1F5FC] text-xs font-medium transition"
          >
            Open AI Insights →
          </Link>
          <Link
            href="/tasks"
            className="px-3 py-1.5 rounded-lg bg-[#1B2332] border border-[#273247] hover:border-[#6D8FFF] text-[#F1F5FC] text-xs font-medium transition"
          >
            Review Tasks →
          </Link>
        </div>
      </div>

      {/* Create Notebook Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#151B27] border border-[#273247] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-[18px] font-semibold text-[#F1F5FC]">Create Research Notebook</h3>
            <p className="text-[13px] text-[#A0AEC0]">
              Notebooks provide an immersive 3-panel workspace for dedicated research, document citations, and Studio generation.
            </p>
            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-[#A0AEC0] block mb-1.5">
                  Notebook Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="e.g. Q3 Financial Due Diligence"
                  className="w-full bg-[#10141D] border border-[#273247] rounded-xl px-3.5 py-2.5 text-[15px] text-[#F1F5FC] focus:outline-hidden focus:border-[#6D8FFF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#273247] text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingNotebook || !newNotebookTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] disabled:opacity-40 transition"
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
