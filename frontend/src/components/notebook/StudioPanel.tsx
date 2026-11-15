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
    description: "Assess understanding and study key concepts",
    icon: GraduationCap,
    tools: [
      {
        id: "quiz",
        title: "Interactive Quiz",
        desc: "Knowledge check with scoring",
        icon: HelpCircle,
        color: "text-[#6D8FFF] bg-[#6D8FFF]/10 border-[#6D8FFF]/30",
      },
      {
        id: "flashcards",
        title: "Flashcards",
        desc: "Spaced-repetition cards",
        icon: Layers,
        color: "text-purple-400 bg-purple-950/30 border-purple-800/40",
      },
      {
        id: "report",
        title: "Study Guide",
        desc: "In-depth structured brief",
        icon: FileText,
        color: "text-[#34D399] bg-[#34D399]/10 border-[#34D399]/30",
      },
    ],
  },
  {
    id: "media",
    name: "Audio & Visual Media",
    description: "Dynamic dialogues, slides, and storyboards",
    icon: Clapperboard,
    tools: [
      {
        id: "audio",
        title: "Audio Overview",
        desc: "Two-host AI podcast dialogue",
        icon: Headphones,
        color: "text-amber-400 bg-amber-950/30 border-amber-800/40",
      },
      {
        id: "video",
        title: "Video Summary",
        desc: "Visual storyboard explainer",
        icon: Video,
        color: "text-rose-400 bg-rose-950/30 border-rose-800/40",
      },
      {
        id: "slides",
        title: "Slide Deck",
        desc: "Executive presentation deck",
        icon: PresentationIcon,
        color: "text-indigo-400 bg-indigo-950/30 border-indigo-800/40",
      },
    ],
  },
  {
    id: "synthesis",
    name: "Synthesis & Structured Data",
    description: "Hierarchical graphs and tabular extractions",
    icon: Database,
    tools: [
      {
        id: "mindmap",
        title: "Mind Map",
        desc: "Hierarchical visual graph",
        icon: GitFork,
        color: "text-[#34D399] bg-[#34D399]/10 border-[#34D399]/30",
      },
      {
        id: "infographic",
        title: "Infographic",
        desc: "Bento-grid data statistics",
        icon: LayoutGrid,
        color: "text-teal-400 bg-teal-950/30 border-teal-800/40",
      },
      {
        id: "data_table",
        title: "Data Tables",
        desc: "Extract structured metrics",
        icon: FileSpreadsheet,
        color: "text-orange-400 bg-orange-950/30 border-orange-800/40",
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
        return <HelpCircle className="w-4 h-4 text-[#6D8FFF]" />;
      case "flashcards":
        return <Layers className="w-4 h-4 text-purple-400" />;
      case "mindmap":
        return <GitFork className="w-4 h-4 text-[#34D399]" />;
      case "slides":
        return <PresentationIcon className="w-4 h-4 text-indigo-400" />;
      case "infographic":
        return <LayoutGrid className="w-4 h-4 text-teal-400" />;
      case "data_table":
        return <FileSpreadsheet className="w-4 h-4 text-orange-400" />;
      case "report":
      default:
        return <FileText className="w-4 h-4 text-[#34D399]" />;
    }
  };

  const displayedCategories =
    activeCategory === "all"
      ? STUDIO_CATEGORIES
      : STUDIO_CATEGORIES.filter((c) => c.id === activeCategory);

  return (
    <div className="h-full flex flex-col bg-[#10141D] text-[#F1F5FC] select-none">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[#273247] flex items-center justify-between shrink-0 bg-[#0B0D12]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6D8FFF]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#F1F5FC]">
            Studio
          </h3>
        </div>
        <span className="text-[11px] font-medium text-[#A0AEC0]">
          {artifacts.length} Artifact{artifacts.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="px-3 py-2 bg-[#151B27] border-b border-[#273247] flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0",
            activeCategory === "all"
              ? "bg-[#1B2332] text-[#6D8FFF] border border-[#273247] font-semibold"
              : "text-[#A0AEC0] hover:text-[#F1F5FC]"
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
                ? "bg-[#1B2332] text-[#6D8FFF] border border-[#273247] font-semibold"
                : "text-[#A0AEC0] hover:text-[#F1F5FC]"
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#A0AEC0]">
                    <CatIcon className="w-3.5 h-3.5 text-[#6D8FFF]" />
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[#F1F5FC]">
                      {cat.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#A0AEC0]">{cat.tools.length} engines</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {cat.tools.map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => onOpenTool(tool.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-[#273247] bg-[#151B27] hover:bg-[#1B2332] hover:border-[#3A4A68] transition-all text-left group cursor-pointer"
                      >
                        <div className={`p-2 rounded-xl border shrink-0 ${tool.color}`}>
                          <ToolIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-[#F1F5FC] group-hover:text-[#6D8FFF] transition-colors block truncate">
                            {tool.title}
                          </span>
                          <span className="text-[11px] text-[#A0AEC0] line-clamp-1">
                            {tool.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Generated Artifacts Section */}
        <div className="pt-2 border-t border-[#273247] space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[12px] font-semibold text-[#A0AEC0] uppercase tracking-wider">
              Generated Artifacts ({artifacts.length})
            </h4>
          </div>

          {artifacts.length > 0 ? (
            <div className="space-y-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  onClick={() => onViewArtifact(art)}
                  className="group flex items-center justify-between p-2.5 rounded-xl border border-[#273247] bg-[#151B27] hover:bg-[#1B2332] hover:border-[#3A4A68] cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[#10141D] border border-[#273247] shrink-0">
                      {getToolIcon(art.artifact_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F1F5FC] truncate group-hover:text-[#6D8FFF] transition-colors">
                        {art.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#A0AEC0] mt-0.5">
                        <span className="capitalize">{art.artifact_type}</span>
                        <span>•</span>
                        {art.status === "completed" && (
                          <span className="flex items-center gap-0.5 text-[#34D399] font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {art.status === "processing" && (
                          <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                            <Clock className="w-3 h-3 animate-spin" /> Working
                          </span>
                        )}
                        {art.status === "failed" && (
                          <span className="flex items-center gap-0.5 text-rose-400 font-medium">
                            <AlertCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#A0AEC0] hover:text-[#F1F5FC] transition-all">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#273247] p-4 text-center text-[#A0AEC0] bg-[#151B27]/40">
              <p className="text-xs font-medium text-[#F1F5FC]">No artifacts created yet</p>
              <p className="text-[11px] mt-1 text-[#A0AEC0]">
                Choose an engine above to transform sources into podcasts, slides, or quizzes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
