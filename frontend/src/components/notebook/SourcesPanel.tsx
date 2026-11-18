"use client";

import React, { useState } from "react";
import {
  FileText,
  Globe,
  StickyNote,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  BookOpen,
  FolderOpen,
} from "lucide-react";
import { SourceItem, NoteItem } from "@/lib/api-client";

interface SourcesPanelProps {
  sources: SourceItem[];
  notes: NoteItem[];
  onToggleSource: (id: string, currentStatus: boolean) => Promise<void>;
  onDeleteSource: (source: SourceItem) => void;
  onOpenAddSource: () => void;
  onOpenCreateNote: () => void;
  onDeleteNote: (id: string) => Promise<void>;
}

export function SourcesPanel({
  sources,
  notes,
  onToggleSource,
  onDeleteSource,
  onOpenAddSource,
  onOpenCreateNote,
  onDeleteNote,
}: SourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<"sources" | "notes">("sources");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "url":
      case "web":
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case "youtube":
        return <ExternalLink className="w-4 h-4 text-rose-400" />;
      case "text":
        return <StickyNote className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-indigo-400" />;
    }
  };

  const activeSourcesCount = sources.filter((s) => s.is_active_for_queries).length;

  return (
    <div className="h-full flex flex-col min-h-0 bg-white text-neutral-900 select-none">
      {/* Header Tabs */}
      <div className="p-3 border-b border-black/[0.08] flex items-center justify-between gap-2 shrink-0 bg-[#F4F5F7]">
        <div className="flex items-center gap-1 bg-black/[0.04] p-1 rounded-xl border border-black/[0.06]">
          <button
            onClick={() => setActiveTab("sources")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "sources"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Sources ({sources.length})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "notes"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Notes ({notes.length})
          </button>
        </div>

        {/* Action Button */}
        {activeTab === "sources" ? (
          <button
            onClick={onOpenAddSource}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        ) : (
          <button
            onClick={onOpenCreateNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Note</span>
          </button>
        )}
      </div>

      {/* Active Count Banner */}
      <div className="px-3 py-2 border-b border-black/[0.04] flex items-center justify-between text-[11px] text-neutral-500 bg-neutral-50/50">
        <span>
          {activeSourcesCount} of {sources.length} active in RAG context
        </span>
        <span className="text-[10px] text-emerald-700 font-mono font-medium">Ready</span>
      </div>

      {/* Sources Search Bar */}
      {activeTab === "sources" && sources.length > 3 && (
        <div className="px-3 pt-3 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-50 border border-black/[0.08] text-xs text-neutral-900 placeholder-neutral-400 outline-none focus:ring-1 focus:ring-amber-500/40"
            />
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
        {activeTab === "sources" ? (
          filteredSources.length > 0 ? (
            <>
              {filteredSources.map((source) => (
                <div
                  key={source.id}
                  className="group relative flex items-start gap-2.5 p-3 rounded-xl border border-black/[0.08] bg-[#F8F9FA] hover:bg-white hover:border-black/[0.16] transition-all shadow-xs"
                >
                  {/* Active Toggle Checkbox */}
                  <input
                    type="checkbox"
                    checked={source.is_active_for_queries}
                    onChange={() => onToggleSource(source.id, source.is_active_for_queries)}
                    className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    title={source.is_active_for_queries ? "Included in RAG context" : "Excluded from RAG context"}
                  />

                  {/* Source Icon */}
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white border border-black/[0.08] shadow-xs">
                    {getSourceIcon(source.source_type)}
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-semibold text-neutral-900 truncate leading-tight" title={source.title}>
                      {source.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-500">
                      <span className="capitalize px-1.5 py-0.2 rounded bg-white border border-black/[0.06] text-neutral-700 font-mono">
                        {source.source_type}
                      </span>
                      {source.metadata?.page_count ? (
                        <span>{source.metadata.page_count} page{source.metadata.page_count > 1 ? "s" : ""}</span>
                      ) : source.token_count > 1 ? (
                        <span>{source.token_count.toLocaleString()} tokens</span>
                      ) : null}
                      {source.extraction_status === "completed" && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium ml-auto">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      )}
                      {source.extraction_status === "processing" && (
                        <span className="flex items-center gap-1 text-amber-700 font-medium ml-auto">
                          <Clock className="w-3 h-3 animate-spin" /> Indexing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Source Action */}
                  <button
                    onClick={() => onDeleteSource(source)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 transition-all absolute right-2.5 top-2.5"
                    title="Remove from notebook"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Another Source Action */}
              <button
                onClick={onOpenAddSource}
                className="w-full py-2.5 rounded-xl border border-dashed border-black/[0.15] hover:border-amber-600 bg-neutral-50 hover:bg-white text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-3 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                <span>Add another source</span>
              </button>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <BookOpen className="w-8 h-8 stroke-1 mb-2 text-neutral-400" />
              <p className="text-xs font-medium text-neutral-800">No sources added yet</p>
              <p className="text-[11px] mt-1 max-w-[200px] leading-relaxed text-neutral-500">
                Add PDFs, documents, URLs, or notes to ground your answers in real evidence.
              </p>
              <button
                onClick={onOpenAddSource}
                className="mt-3 px-3 py-1.5 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-bold hover:bg-[#D97706] transition-colors shadow-xs"
              >
                + Add Source
              </button>
            </div>
          )
        ) : notes.length > 0 ? (
          notes.map((note) => (
            <div
              key={note.id}
              className="group relative p-3 rounded-xl border border-black/[0.08] bg-white hover:bg-neutral-50 hover:border-amber-500/40 transition-all space-y-1.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 truncate pr-4">
                  {note.title}
                </span>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 transition-all"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
              {note.source_citations && note.source_citations.length > 0 && (
                <div className="pt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span>Cites {note.source_citations.length} sources</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
            <StickyNote className="w-8 h-8 stroke-1 mb-2 text-neutral-400" />
            <p className="text-xs font-semibold text-neutral-900">No saved notes</p>
            <p className="text-[11px] mt-1 max-w-[200px] leading-relaxed text-neutral-500">
              Capture quick notes or save key synthesis insights directly into this notebook.
            </p>
            <button
              onClick={onOpenCreateNote}
              className="mt-3 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-xs"
            >
              + Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
