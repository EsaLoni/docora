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

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0E1118] text-[#F3F4F6] select-none">
      {/* Header Tabs */}
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0 bg-[#0A0C12]">
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("sources")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "sources"
                ? "bg-white/[0.1] text-white shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Sources ({sources.length})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "notes"
                ? "bg-white/[0.1] text-white shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Notes ({notes.length})
          </button>
        </div>

        {/* Action Button */}
        {activeTab === "sources" ? (
          <button
            onClick={onOpenAddSource}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        ) : (
          <button
            onClick={onOpenCreateNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>
        )}
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
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-neutral-100 placeholder-neutral-500 outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {activeTab === "sources" ? (
          filteredSources.length > 0 ? (
            filteredSources.map((source) => (
              <div
                key={source.id}
                className="group relative flex items-start gap-2.5 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
              >
                {/* Active Toggle Checkbox */}
                <input
                  type="checkbox"
                  checked={source.is_active_for_queries}
                  onChange={() => onToggleSource(source.id, source.is_active_for_queries)}
                  className="mt-1 h-3.5 w-3.5 rounded border-white/[0.1] bg-white/[0.05] text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                  title={source.is_active_for_queries ? "Included in RAG context" : "Excluded from RAG context"}
                />

                {/* Source Icon */}
                <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  {getSourceIcon(source.source_type)}
                </div>

                {/* Title & Info */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs font-medium text-neutral-200 truncate" title={source.title}>
                    {source.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                    <span className="capitalize">{source.source_type}</span>
                    {source.metadata?.page_count ? (
                      <>
                        <span>•</span>
                        <span>{source.metadata.page_count} page{source.metadata.page_count > 1 ? "s" : ""}</span>
                      </>
                    ) : source.token_count > 1 ? (
                      <>
                        <span>•</span>
                        <span>{source.token_count.toLocaleString()} tokens</span>
                      </>
                    ) : null}
                    {source.extraction_status === "completed" && (
                      <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    )}
                    {source.extraction_status === "processing" && (
                      <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                        <Clock className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    )}
                    {source.extraction_status === "failed" && (
                      <span className="flex items-center gap-0.5 text-rose-400 font-medium">
                        <AlertCircle className="w-3 h-3" /> Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Source Action */}
                <button
                  onClick={() => onDeleteSource(source)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-white/[0.06] transition-all absolute right-2 top-2"
                  title="Remove from notebook"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <BookOpen className="w-8 h-8 stroke-1 mb-2 text-neutral-600" />
              <p className="text-xs font-medium text-neutral-300">No sources added yet</p>
              <p className="text-[11px] mt-1 max-w-[200px] leading-relaxed">
                Add PDFs, documents, URLs, or notes to ground your answers in real evidence.
              </p>
              <button
                onClick={onOpenAddSource}
                className="mt-3 px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-medium hover:bg-white/[0.06] text-neutral-200 transition-colors"
              >
                + Add Source
              </button>
            </div>
          )
        ) : notes.length > 0 ? (
          notes.map((note) => (
            <div
              key={note.id}
              className="group relative p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all space-y-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-100 truncate pr-4">
                  {note.title}
                </span>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-white/[0.06] transition-all"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
              {note.source_citations && note.source_citations.length > 0 && (
                <div className="pt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span>Cites {note.source_citations.length} sources</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <StickyNote className="w-8 h-8 stroke-1 mb-2 text-neutral-600" />
            <p className="text-xs font-medium text-neutral-300">No saved notes</p>
            <p className="text-[11px] mt-1 max-w-[200px] leading-relaxed">
              Capture quick notes or save key synthesis insights directly into this notebook.
            </p>
            <button
              onClick={onOpenCreateNote}
              className="mt-3 px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-medium hover:bg-white/[0.06] text-neutral-200 transition-colors"
            >
              + Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
