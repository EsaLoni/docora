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
  Calendar,
  Layers,
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

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  blue: { bg: "bg-[#6D8FFF]/10", border: "border-[#6D8FFF]/30", badge: "bg-[#6D8FFF]", text: "text-[#6D8FFF]" },
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/30", badge: "bg-indigo-500", text: "text-indigo-400" },
  emerald: { bg: "bg-[#34D399]/10", border: "border-[#34D399]/30", badge: "bg-[#34D399]", text: "text-[#34D399]" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", badge: "bg-purple-500", text: "text-purple-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", badge: "bg-amber-500", text: "text-amber-400" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/30", badge: "bg-rose-500", text: "text-rose-400" },
};

export default function NotebooksPage() {
  const { user } = useAuth();
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("emerald");
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
    if (!confirm("Are you sure you want to delete this notebook and all its studio artifacts?")) return;

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
    <div className="min-h-[calc(100vh-4rem)] max-w-6xl mx-auto space-y-8 select-none pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#273247]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#1B2332] text-[#6D8FFF] border border-[#273247] flex items-center justify-center font-bold">
              <BookMarked className="h-4 w-4" />
            </div>
            <h1 className="text-[30px] font-semibold text-[#F1F5FC] tracking-tight leading-tight">
              My Notebooks
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#6D8FFF]/10 text-[#6D8FFF] font-semibold border border-[#6D8FFF]/30">
              Gemini Studio
            </span>
          </div>
          <p className="text-[13px] text-[#A0AEC0] mt-1">
            Dedicated research environments with multi-source grounding, conversational RAG, and AI Studio artifact generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative flex items-center bg-[#151B27] border border-[#273247] rounded-xl px-3 py-1.5 focus-within:border-[#6D8FFF] transition-all w-52 sm:w-64">
            <Search className="h-3.5 w-3.5 text-[#A0AEC0] mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search notebooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-[#F1F5FC] placeholder-[#A0AEC0]/60 outline-hidden w-full"
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition-all shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>

      {/* Grid of Notebooks */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-[#273247] bg-[#151B27] animate-pulse p-5 space-y-3">
              <div className="h-4 bg-[#1B2332] rounded w-2/3" />
              <div className="h-3 bg-[#1B2332]/60 rounded w-full" />
              <div className="h-3 bg-[#1B2332]/60 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : filteredNotebooks.length === 0 ? (
        <div className="max-w-md mx-auto my-16 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-[#1B2332] text-[#6D8FFF] border border-[#273247] mx-auto flex items-center justify-center">
            <BookMarked className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-[16px] font-semibold text-[#F1F5FC]">No Notebooks Found</h3>
            <p className="text-[13px] text-[#A0AEC0]">
              Create your first AI Notebook to add PDF documents, web sources, or notes and start generating Studio artifacts.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Notebook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotebooks.map((nb) => {
            const colorCfg = COLOR_MAP[nb.color] || COLOR_MAP.emerald;
            return (
              <Link
                key={nb.id}
                href={`/notebooks/${nb.id}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#273247] bg-[#151B27] p-5 hover:border-[#3A4A68] hover:bg-[#1B2332] hover:shadow-md transition-all cursor-pointer overflow-hidden"
              >
                {/* Top Accent Pill & Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colorCfg.badge)} />
                      <span className="text-[11px] font-medium text-[#A0AEC0] uppercase tracking-wider">
                        Notebook
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNotebook(nb.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#151B27] text-[#A0AEC0] hover:text-rose-400 transition-all"
                      title="Delete notebook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-semibold text-[#F1F5FC] group-hover:text-[#6D8FFF] transition-colors line-clamp-1 tracking-tight">
                      {nb.title}
                    </h3>
                    <p className="text-[13px] text-[#A0AEC0] line-clamp-2 mt-1 leading-relaxed">
                      {nb.description || "Interactive research notebook with multi-source grounding."}
                    </p>
                  </div>
                </div>

                {/* Footer Metrics & Link */}
                <div className="pt-5 mt-4 border-t border-[#273247] flex items-center justify-between text-[11px] text-[#A0AEC0]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[#A0AEC0]">
                      <BookOpen className="h-3 w-3 text-[#6D8FFF]" />
                      Sources
                    </span>
                    <span className="flex items-center gap-1 text-[#A0AEC0]">
                      <Sparkles className="h-3 w-3 text-[#34D399]" />
                      Studio
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[#6D8FFF] font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                    Open Workspace <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal: Create Notebook */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-[#273247] bg-[#151B27] p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-[18px] font-semibold text-[#F1F5FC]">Create New Notebook</h2>
              <p className="text-[13px] text-[#A0AEC0] mt-0.5">
                Define the title, scope, and theme for this research workspace.
              </p>
            </div>

            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0AEC0] mb-1.5">
                  Notebook Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Market Analysis 2026, Biology Study Guide"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] outline-hidden focus:border-[#6D8FFF] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0AEC0] mb-1.5">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of topics or documents..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] outline-hidden focus:border-[#6D8FFF] transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0AEC0] mb-1.5">Accent Color</label>
                <div className="flex items-center gap-2">
                  {Object.keys(COLOR_MAP).map((cKey) => {
                    const isSelected = newColor === cKey;
                    return (
                      <button
                        type="button"
                        key={cKey}
                        onClick={() => setNewColor(cKey)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform",
                          COLOR_MAP[cKey].badge,
                          isSelected ? "ring-2 ring-[#6D8FFF] ring-offset-2 ring-offset-[#151B27] scale-110" : "opacity-80 hover:opacity-100"
                        )}
                        title={cKey}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#273247]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#273247] text-xs text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] disabled:opacity-50 transition-colors shadow-sm"
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
