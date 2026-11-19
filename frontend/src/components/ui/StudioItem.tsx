"use client";

import React from "react";
import {
  FileText,
  Headphones,
  HelpCircle,
  Layers,
  Presentation,
  Table,
  Network,
  ChevronRight,
} from "lucide-react";
import { StatusBadge, StatusType } from "./StatusBadge";
import { cn } from "@/lib/utils";

export interface StudioItemProps {
  typeKey: string;
  title: string;
  description: string;
  status: StatusType;
  count?: number;
  onClick: () => void;
  className?: string;
}

export function StudioItem({
  typeKey,
  title,
  description,
  status,
  count,
  onClick,
  className,
}: StudioItemProps) {
  const getItemIcon = () => {
    switch (typeKey) {
      case "audio_overview":
        return <Headphones className="w-4 h-4 text-ink-secondary" />;
      case "quiz":
        return <HelpCircle className="w-4 h-4 text-ink-secondary" />;
      case "flashcards":
        return <Layers className="w-4 h-4 text-ink-secondary" />;
      case "mind_map":
        return <Network className="w-4 h-4 text-ink-secondary" />;
      case "slides":
        return <Presentation className="w-4 h-4 text-ink-secondary" />;
      case "data_table":
        return <Table className="w-4 h-4 text-ink-secondary" />;
      default:
        return <FileText className="w-4 h-4 text-ink-secondary" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        // Compact list row layout with clear status indicator - not a marketing tile
        "group flex items-center justify-between p-3 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 cursor-pointer select-none",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded bg-surface-subtle border border-hairline shrink-0">
          {getItemIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-sans font-medium text-ink truncate leading-tight">
              {title}
            </h4>
            {count !== undefined && count > 0 && (
              <span className="text-[11px] font-mono text-ink-muted">
                ({count})
              </span>
            )}
          </div>
          <p className="text-[11px] font-sans text-ink-muted truncate mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <StatusBadge status={status} />
        <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink transition-colors duration-150" />
      </div>
    </div>
  );
}
