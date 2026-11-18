"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookMarked,
  Plus,
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
  Trash2,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

interface NotebookItem {
  id: string;
  title: string;
  description?: string;
  color: string;
  cover_image_url?: string;
  is_archived: boolean;
  is_shared: boolean;
  settings?: any;
  created_at: string;
  updated_at: string;
  source_count?: number;
  note_count?: number;
  artifact_count?: number;
}

const COLOR_MAP: Record<string, { badge: string; ring: string }> = {
  blue: { badge: "bg-sky-400", ring: "ring-sky-400" },
  indigo: { badge: "bg-indigo-400", ring: "ring-indigo-400" },
  emerald: { badge: "bg-emerald-400", ring: "ring-emerald-400" },
  purple: { badge: "bg-purple-400", ring: "ring-purple-400" },
  amber: { badge: "bg-amber-400", ring: "ring-amber-400" },
  rose: { badge: "bg-rose-400", ring: "ring-rose-400" },
};

export default function NotebooksPage() {
  const { user } = useAuth();
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("indigo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotebooks = async () => {
    try {
      const data = await apiClient.listNotebooks();
      setNotebooks(data as any);
    } catch (err) {
      console.error("Failed to fetch notebooks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotebooks();
  }, []);

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiClient.createNotebook({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        color: newColor,
      });
      setNewTitle("");
      setNewDesc("");
      setIsCreateOpen(false);
      loadNotebooks();
    } catch (err) {
      console.error("Failed to create notebook", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this notebook and its studio artifacts?")) return;

    try {
      await apiClient.deleteNotebook(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notebook", err);
    }
  };

  const filteredNotebooks = notebooks.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.description && n.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-6xl mx-auto space-y-8 select-none pb-16">
      {/* Editorial Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 font-mono">
              Workspace Atelier
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
            Research Notebooks
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-xl">
            Grounded intelligence workspaces with conversational RAG, multi-source citations, and automated studio synthesis.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Refined Search input */}
          <div className="relative flex items-center bg-white border border-black/[0.08] rounded-xl px-3 py-2 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/40 transition-all w-52 sm:w-64 shadow-xs">
            <Search className="h-3.5 w-3.5 text-neutral-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search notebooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-neutral-900 placeholder-neutral-400 outline-none w-full"
            />
          </div>

          {/* New Notebook CTA */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] active:scale-[0.98] transition-all shadow-xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>

      {/* Grid of Notebooks */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-black/[0.06] bg-white animate-pulse p-5 space-y-3 shadow-xs"
            >
              <div className="h-4 bg-neutral-100 rounded w-2/3" />
              <div className="h-3 bg-neutral-50 rounded w-full" />
              <div className="h-3 bg-neutral-50 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : filteredNotebooks.length === 0 ? (
        <div className="max-w-md mx-auto my-20 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-white text-neutral-700 border border-black/[0.08] mx-auto flex items-center justify-center shadow-xs">
            <BookMarked className="h-5 w-5 text-amber-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-neutral-900 tracking-tight">No Notebooks Found</h3>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
              Create a research notebook to ingest PDFs, web URLs, or transcripts and begin generating grounded studio artifacts.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 text-xs font-bold active:scale-[0.98] transition-all shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            Create Notebook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotebooks.map((nb) => {
            const colorCfg = COLOR_MAP[nb.color] || COLOR_MAP.indigo;
            return (
              <Link
                key={nb.id}
                href={`/notebooks/workspace?id=${nb.id}`}
                prefetch={false}
                className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 hover:border-black/[0.16] hover:bg-neutral-50 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Top Accent Dot & Delete Action */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full shrink-0 shadow-xs", colorCfg.badge)} />
                      <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider font-mono">
                        Notebook
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNotebook(nb.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-rose-600 transition-all"
                      title="Delete notebook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 group-hover:text-amber-800 transition-colors line-clamp-1 tracking-tight">
                      {nb.title}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                      {nb.description || "Grounded research workspace with multi-source synthesis."}
                    </p>
                  </div>
                </div>

                {/* Footer Metrics & Link */}
                <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <BookOpen className="h-3 w-3 text-neutral-400" />
                      Sources
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      Studio
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-indigo-400 font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                    Enter Workspace <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal: Create Notebook */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#12151F] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Create New Notebook</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Set the topic, scope, and accent for your research workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Notebook Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Financial Review, Quantum Computing Primer"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#0A0C12] text-xs text-white outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-neutral-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of research focus or sources..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#0A0C12] text-xs text-white outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none placeholder-neutral-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-2">Accent Theme</label>
                <div className="flex items-center gap-2.5">
                  {Object.keys(COLOR_MAP).map((cKey) => {
                    const isSelected = newColor === cKey;
                    return (
                      <button
                        type="button"
                        key={cKey}
                        onClick={() => setNewColor(cKey)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-all",
                          COLOR_MAP[cKey].badge,
                          isSelected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#12151F] scale-110 shadow-sm"
                            : "opacity-60 hover:opacity-100"
                        )}
                        title={cKey}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                >
                  {isSubmitting ? "Creating..." : "Create Notebook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
