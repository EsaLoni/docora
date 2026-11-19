"use client";

import React from "react";
import {
  Headphones,
  Presentation,
  FileText,
  GitFork,
  HelpCircle,
  Layers,
  FileSpreadsheet,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Clock,
  Eye,
} from "lucide-react";
import { ArtifactItem } from "@/lib/api-client";
import { StatusBadge, StatusType } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

export interface StudioToolConfig {
  id: string;
  typeKey: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STUDIO_TOOLS: StudioToolConfig[] = [
  {
    id: "audio",
    typeKey: "audio_overview",
    name: "Audio Overview",
    description: "Two-host conversational podcast dialogue discussing key findings",
    icon: Headphones,
  },
  {
    id: "slides",
    typeKey: "slides",
    name: "Slide Deck",
    description: "Executive presentation slides structured for briefing",
    icon: Presentation,
  },
  {
    id: "report",
    typeKey: "report",
    name: "Study Report",
    description: "Comprehensive multi-section synthesis brief with citations",
    icon: FileText,
  },
  {
    id: "mindmap",
    typeKey: "mind_map",
    name: "Mind Map",
    description: "Hierarchical concept graph and knowledge ontology",
    icon: GitFork,
  },
  {
    id: "quiz",
    typeKey: "quiz",
    name: "Interactive Quiz",
    description: "Comprehension assessment with scored multiple choice questions",
    icon: HelpCircle,
  },
  {
    id: "flashcards",
    typeKey: "flashcards",
    name: "Flashcards",
    description: "Active recall study deck with spaced repetition",
    icon: Layers,
  },
  {
    id: "data_table",
    typeKey: "data_table",
    name: "Data Table",
    description: "Structured schema and entity extractions across sources",
    icon: FileSpreadsheet,
  },
];

export interface StudioPanelProps {
  artifacts: ArtifactItem[];
  onOpenTool: (toolId: string) => void;
  onViewArtifact: (artifact: ArtifactItem) => void;
  onDeleteArtifact?: (artifactId: string) => Promise<void> | void;
  sourcesCount: number;
}

export function StudioPanel({
  artifacts,
  onOpenTool,
  onViewArtifact,
  onDeleteArtifact,
  sourcesCount,
}: StudioPanelProps) {
  // Normalize artifact type strings for robust matching
  const normalizeType = (t: string) =>
    (t || "").toLowerCase().replace(/[-_\s]/g, "");

  // Determine status of an output type
  const getToolStatus = (toolId: string): { status: StatusType; count: number; failedReason?: string } => {
    const matchedArtifacts = artifacts.filter(
      (a) => normalizeType(a.artifact_type) === normalizeType(toolId)
    );

    if (matchedArtifacts.length === 0) {
      return { status: "idle", count: 0 };
    }

    const generating = matchedArtifacts.find(
      (a) => a.status === "processing" || a.status === "generating"
    );
    if (generating) {
      return { status: "generating", count: matchedArtifacts.length };
    }

    const failed = matchedArtifacts.find(
      (a) => a.status === "failed" || a.status === "error"
    );
    if (failed) {
      const reason =
        typeof failed.data === "object" && failed.data?.error
          ? failed.data.error
          : "Generation failed. Retry available.";
      return { status: "failed", count: matchedArtifacts.length, failedReason: reason };
    }

    return { status: "ready", count: matchedArtifacts.length };
  };

  const getToolIcon = (toolId: string) => {
    const tool = STUDIO_TOOLS.find((t) => normalizeType(t.id) === normalizeType(toolId));
    if (tool) {
      const Icon = tool.icon;
      return <Icon className="w-4 h-4 text-ink-secondary" />;
    }
    return <FileText className="w-4 h-4 text-ink-secondary" />;
  };

  // Download artifact as JSON or Text
  const handleDownload = (art: ArtifactItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const content =
        typeof art.data === "string" ? art.data : JSON.stringify(art.data, null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${art.title || "artifact"}-${art.artifact_type}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download artifact:", err);
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface text-ink font-sans select-none overflow-hidden">
      {/* Studio Header */}
      <div className="h-11 px-4 border-b border-hairline flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <h3 className="text-caption font-semibold uppercase tracking-wider text-ink">
            Studio Workshop
          </h3>
        </div>
        <span className="text-micro font-mono text-ink-muted">
          {artifacts.length} {artifacts.length === 1 ? "Output" : "Outputs"}
        </span>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 min-h-0">
        {/* Compact List of Output Types */}
        <div className="space-y-1.5">
          <div className="px-1 flex items-center justify-between">
            <span className="text-micro font-mono uppercase tracking-wider text-ink-muted">
              Synthesis Engines
            </span>
            <span className="text-micro font-mono text-ink-muted">{STUDIO_TOOLS.length} Types</span>
          </div>

          <div className="space-y-1.5">
            {STUDIO_TOOLS.map((tool) => {
              const { status, count, failedReason } = getToolStatus(tool.id);
              const Icon = tool.icon;

              return (
                <div
                  key={tool.id}
                  onClick={() => onOpenTool(tool.id)}
                  className="group flex flex-col p-2.5 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-surface-subtle border border-hairline shrink-0">
                        <Icon className="w-3.5 h-3.5 text-ink-secondary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ui font-medium text-ink truncate leading-tight">
                            {tool.name}
                          </span>
                          {count > 0 && (
                            <span className="text-micro font-mono text-ink-muted">
                              ({count})
                            </span>
                          )}
                        </div>
                        <p className="text-micro text-ink-muted truncate mt-0.5">
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <StatusBadge status={status} />
                    </div>
                  </div>

                  {/* Inline generation feedback */}
                  {status === "generating" && (
                    <div className="mt-2 flex items-center gap-1.5 text-micro text-amber-800 dark:text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      <span>Synthesizing output grounded in sources...</span>
                    </div>
                  )}

                  {/* Inline failure feedback with Retry action */}
                  {status === "failed" && (
                    <div className="mt-2 p-1.5 rounded bg-destructive-subtle border border-destructive-border flex items-center justify-between gap-2">
                      <span className="text-micro text-destructive truncate">
                        {failedReason || "Generation error. Click to retry."}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTool(tool.id);
                        }}
                        className="h-5 px-1.5 text-micro text-destructive hover:text-destructive flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Saved Outputs Section */}
        <div className="pt-3 border-t border-hairline space-y-2">
          <div className="px-1 flex items-center justify-between">
            <span className="text-micro font-mono uppercase tracking-wider text-ink-muted">
              Saved Outputs
            </span>
            <span className="text-micro font-mono text-ink-muted">
              {artifacts.length}
            </span>
          </div>

          {artifacts.length > 0 ? (
            <div className="space-y-1.5">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  onClick={() => onViewArtifact(art)}
                  className="group flex items-center justify-between p-2.5 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded bg-surface-subtle border border-hairline shrink-0">
                      {getToolIcon(art.artifact_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-ui font-medium text-ink truncate leading-tight">
                        {art.title || "Untitled Artifact"}
                      </p>
                      <div className="flex items-center gap-1.5 text-micro text-ink-muted mt-0.5">
                        <span className="font-mono uppercase text-micro">
                          {art.artifact_type.replace(/[-_]/g, " ")}
                        </span>
                        {art.created_at && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-micro">
                              {formatTimestamp(art.created_at)}
                            </span>
                          </>
                        )}
                        {art.status === "completed" && (
                          <span className="text-verdigris font-medium ml-1">Ready</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions: Open, Download, Delete */}
                  <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewArtifact(art);
                      }}
                      className="h-7 w-7 p-0 text-ink-muted hover:text-ink"
                      title="Open in viewer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDownload(art, e)}
                      className="h-7 w-7 p-0 text-ink-muted hover:text-ink"
                      title="Download output file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>

                    {onDeleteArtifact && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteArtifact(art.id);
                        }}
                        className="h-7 w-7 p-0 text-ink-muted hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete output"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State for Saved Outputs */
            <div className="rounded-lg border border-dashed border-hairline p-5 text-center text-ink-muted bg-surface-subtle/30 space-y-1.5">
              <p className="text-ui font-medium text-ink">No saved outputs yet</p>
              <p className="text-caption text-ink-muted max-w-xs mx-auto leading-relaxed">
                Select an engine above to distill your documents into structured reports, quizzes, slide decks, or mind maps.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
