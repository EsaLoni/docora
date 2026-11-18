"use client";

import React, { useState } from "react";
import {
  Headphones,
  Video,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  GitFork,
  Presentation as PresentationIcon,
  LayoutGrid,
  FileText,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
  Clapperboard,
  Database,
  ArrowRight,
} from "lucide-react";
import { ArtifactItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StudioPanelProps {
  artifacts: ArtifactItem[];
  onOpenTool: (toolId: string) => void;
  onViewArtifact: (artifact: ArtifactItem) => void;
  sourcesCount: number;
}

const STUDIO_CATEGORIES = [
  {
    id: "learning",
    name: "Interactive Learning",
    description: "Assessment quizzes, flashcards & study guides",
    icon: GraduationCap,
    tools: [
      {
        id: "quiz",
        title: "Interactive Quiz",
        desc: "Knowledge check with True/False and MCQ scoring",
        icon: HelpCircle,
      },
      {
        id: "flashcards",
        title: "Flashcards",
        desc: "Spaced-repetition revision cards",
        icon: Layers,
      },
      {
        id: "report",
        title: "Study Guide",
        desc: "Exhaustive multi-section synthesis brief",
        icon: FileText,
      },
    ],
  },
  {
    id: "media",
    name: "Audio & Visual Media",
    description: "Podcasts, slide decks & storyboards",
    icon: Clapperboard,
    tools: [
      {
        id: "audio",
        title: "Audio Overview",
        desc: "Two-host AI discussion podcast dialogue",
        icon: Headphones,
      },
      {
        id: "slides",
        title: "Slide Deck",
        desc: "Executive presentation deck",
        icon: PresentationIcon,
      },
      {
        id: "video",
        title: "Video Summary",
        desc: "Scene-by-scene storyboard narrative",
        icon: Video,
      },
    ],
  },
  {
    id: "synthesis",
    name: "Structured Synthesis",
    description: "Hierarchical mind maps & extracted data tables",
    icon: Database,
    tools: [
      {
        id: "mindmap",
        title: "Mind Map",
        desc: "Visual knowledge ontology and concept graph",
        icon: GitFork,
      },
      {
        id: "infographic",
        title: "Infographic",
        desc: "Bento-grid data statistics and metrics",
        icon: LayoutGrid,
      },
      {
        id: "data_table",
        title: "Data Tables",
        desc: "Structured schema and entity extractions",
        icon: FileSpreadsheet,
      },
    ],
  },
];

export function StudioPanel({
  artifacts,
  onOpenTool,
  onViewArtifact,
  sourcesCount,
}: StudioPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const getToolIcon = (type: string) => {
    switch (type) {
      case "audio":
        return <Headphones className="w-4 h-4 text-amber-400" />;
      case "video":
        return <Video className="w-4 h-4 text-rose-400" />;
      case "quiz":
        return <HelpCircle className="w-4 h-4 text-indigo-400" />;
      case "flashcards":
        return <Layers className="w-4 h-4 text-purple-400" />;
      case "mindmap":
        return <GitFork className="w-4 h-4 text-emerald-400" />;
      case "slides":
        return <PresentationIcon className="w-4 h-4 text-sky-400" />;
      case "infographic":
        return <LayoutGrid className="w-4 h-4 text-teal-400" />;
      case "data_table":
        return <FileSpreadsheet className="w-4 h-4 text-orange-400" />;
      case "report":
      default:
        return <FileText className="w-4 h-4 text-indigo-400" />;
    }
  };

  const displayedCategories =
    activeCategory === "all"
      ? STUDIO_CATEGORIES
      : STUDIO_CATEGORIES.filter((c) => c.id === activeCategory);

  return (
    <div className="h-full flex flex-col bg-[#0E1118] text-[#F3F4F6] select-none">
      {/* Studio Header */}
      <div className="h-13 px-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#0A0C12]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Studio Workshop
          </h3>
        </div>
        <span className="text-[11px] font-medium text-neutral-400">
          {artifacts.length} {artifacts.length === 1 ? "Artifact" : "Artifacts"}
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="px-3 py-2 bg-[#0E1118] border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0",
            activeCategory === "all"
              ? "bg-white/[0.1] text-white border border-white/[0.1] font-semibold"
              : "text-neutral-400 hover:text-white"
          )}
        >
          All (9)
        </button>
        {STUDIO_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0",
              activeCategory === cat.id
                ? "bg-white/[0.1] text-white border border-white/[0.1] font-semibold"
                : "text-neutral-400 hover:text-white"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 min-h-0">
        {/* Categorized Creation Engines */}
        <div className="space-y-4">
          {displayedCategories.map((cat) => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.id} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <CatIcon className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                      {cat.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">{cat.tools.length}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {cat.tools.map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => onOpenTool(tool.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all text-left group cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] active:scale-[0.99]"
                      >
                        <div className="p-2 rounded-xl bg-white/[0.04] text-neutral-300 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 border border-white/[0.06] shrink-0 transition-colors">
                          <ToolIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-neutral-100 group-hover:text-indigo-300 transition-colors block truncate">
                            {tool.title}
                          </span>
                          <span className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                            {tool.desc}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Generated Artifacts Section */}
        <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Output Library ({artifacts.length})
            </h4>
          </div>

          {artifacts.length > 0 ? (
            <div className="space-y-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  onClick={() => onViewArtifact(art)}
                  className="group flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 cursor-pointer transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0">
                      {getToolIcon(art.artifact_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-100 truncate group-hover:text-indigo-300 transition-colors">
                        {art.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                        <span className="capitalize">{art.artifact_type}</span>
                        <span>•</span>
                        {art.status === "completed" && (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {art.status === "processing" && (
                          <span className="flex items-center gap-1 text-amber-400 font-medium">
                            <Clock className="w-3 h-3 animate-spin" /> Generating
                          </span>
                        )}
                        {art.status === "failed" && (
                          <span className="flex items-center gap-1 text-rose-400 font-medium">
                            <AlertCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-white transition-all">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.08] p-5 text-center text-neutral-400 bg-white/[0.01]">
              <p className="text-xs font-medium text-neutral-300">No artifacts generated yet</p>
              <p className="text-[11px] mt-1 text-neutral-400 leading-relaxed max-w-xs mx-auto">
                Select an engine above to transform your source knowledge into briefs, podcasts, slides, or quizzes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
