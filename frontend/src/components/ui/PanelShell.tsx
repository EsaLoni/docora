"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelShellProps {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseDirection?: "left" | "right";
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: number | string;
}

export function PanelShell({
  title,
  count,
  icon,
  isCollapsed = false,
  onToggleCollapse,
  collapseDirection = "left",
  headerActions,
  children,
  className,
  width,
}: PanelShellProps) {
  if (isCollapsed) {
    return (
      <aside
        onClick={onToggleCollapse}
        className={cn(
          "h-full w-12 shrink-0 rounded-xl border border-hairline bg-surface shadow-xs hover:bg-surface-subtle cursor-pointer flex flex-col items-center py-4 transition-colors duration-150 select-none group",
          className
        )}
        title={`Expand ${title}`}
      >
        <button
          type="button"
          className="p-1 rounded text-ink-muted group-hover:text-ink transition-colors duration-150"
        >
          {collapseDirection === "left" ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        <div className="mt-4 flex-1 flex items-center justify-center">
          <span className="[writing-mode:vertical-lr] rotate-180 text-micro uppercase tracking-wider text-ink-muted group-hover:text-ink font-medium">
            {title} {count !== undefined ? `(${count})` : ""}
          </span>
        </div>

        {icon && <div className="text-ink-muted">{icon}</div>}
      </aside>
    );
  }

  return (
    <section
      style={width ? { width: typeof width === "number" ? `${width}px` : width } : undefined}
      className={cn(
        "h-full shrink-0 rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col transition-all duration-150",
        className
      )}
    >
      {/* Header */}
      <div className="h-11 px-3 border-b border-hairline bg-surface flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-ink-secondary">{icon}</span>}
          <h3 className="text-section font-sans text-ink truncate">
            {title}
          </h3>
          {count !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-micro font-mono bg-surface-subtle border border-hairline text-ink-muted">
              {count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {headerActions}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={`Collapse ${title}`}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors duration-150"
            >
              {collapseDirection === "left" ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {children}
      </div>
    </section>
  );
}
