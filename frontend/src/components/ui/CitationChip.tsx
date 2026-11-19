"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CitationChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  index: number | string;
  sourceTitle?: string;
  pageNumber?: number;
  snippet?: string;
  onOpenCitation?: (sourceTitle?: string, pageNumber?: number, snippet?: string) => void;
}

export function CitationChip({
  index,
  sourceTitle,
  pageNumber,
  snippet,
  onOpenCitation,
  className,
  ...props
}: CitationChipProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (props.onClick) {
      props.onClick(e);
    }
    if (onOpenCitation) {
      onOpenCitation(sourceTitle, pageNumber, snippet);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        sourceTitle
          ? `${sourceTitle}${pageNumber ? ` (p. ${pageNumber})` : ""}${snippet ? `: "${snippet.slice(0, 80)}..."` : ""}`
          : `Citation [${index}]`
      }
      className={cn(
        // Verdigris styling reserved strictly for citations and verified truth
        "inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 rounded font-mono text-[11px] font-medium leading-none select-none cursor-pointer",
        "bg-verdigris-subtle text-verdigris border border-verdigris",
        "hover:bg-teal-100 dark:hover:bg-teal-950/80 active:scale-95 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verdigris",
        className
      )}
      {...props}
    >
      [{index}]
    </button>
  );
}
