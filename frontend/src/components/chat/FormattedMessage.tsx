"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id?: string;
  document_id: string;
  document_filename: string;
  chunk_id?: string;
  page_number: number;
  quote?: string;
  relevance_score?: number;
  citation_index?: number;
}

interface FormattedMessageProps {
  content: string;
  citations?: CitationItem[];
  onOpenCitation?: (citation: CitationItem) => void;
  className?: string;
}

export function FormattedMessage({
  content,
  citations = [],
  onOpenCitation,
  className,
}: FormattedMessageProps) {
  // Pre-process content: clean up any duplicate bold markers inside headers
  const cleanedContent = useMemo(() => {
    if (!content) return "";
    return content
      .replace(/^#{1,6}\s+\*\*([^*]+)\*\*/gm, "### $1")
      .replace(/^\s*\*\*(?:\d+\.|\d+\))\s*([^*]+)\*\*/gm, "### $1")
      .replace(/^\s*\*\*([A-Z0-9\s\-_:]{3,50})\*\*\s*$/gm, "### $1")
      .replace(/\n{3,}/g, "\n\n");
  }, [content]);

  // Transform text containing [Source N] into interactive buttons
  const renderTextWithCitations = (text: string) => {
    if (typeof text !== "string") return text;

    const parts: React.ReactNode[] = [];
    const sourceRegex = /\[Source\s*(\d+)\]/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = sourceRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const sourceNum = parseInt(match[1], 10);
      const matchedCitation =
        citations && citations.length >= sourceNum
          ? citations[sourceNum - 1]
          : citations && citations[0];

      parts.push(
        <button
          key={`cite-${matchIndex}-${sourceNum}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (matchedCitation && onOpenCitation) {
              onOpenCitation(matchedCitation);
            }
          }}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tracking-tight",
            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
            "hover:bg-emerald-500 hover:text-black hover:border-transparent",
            "transition-all duration-150 cursor-pointer mx-0.5 align-baseline select-none active:scale-95 shadow-2xs"
          )}
          title={
            matchedCitation
              ? `${matchedCitation.document_filename} (p. ${matchedCitation.page_number})`
              : `Source ${sourceNum}`
          }
        >
          <FileText className="w-2.5 h-2.5 inline-block opacity-80" />
          <span>[{sourceNum}]</span>
        </button>
      );

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-white text-[15px] leading-[1.6]",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[20px] font-semibold tracking-tight text-white mt-4 mb-2 pb-1 border-b border-white/[0.08] flex items-center gap-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[17px] font-semibold tracking-tight text-white mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-white mt-3 mb-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 mt-2.5 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2 text-[15px] text-neutral-200 leading-[1.6] font-normal">
              {React.Children.map(children, (child) =>
                typeof child === "string"
                  ? renderTextWithCitations(child)
                  : child
              )}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1 pl-1 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1 pl-4 list-decimal marker:text-indigo-400 marker:font-semibold marker:text-[12px]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[15px] leading-[1.6] text-neutral-200 flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
              <div className="flex-1">
                {React.Children.map(children, (child) =>
                  typeof child === "string"
                    ? renderTextWithCitations(child)
                    : child
                )}
              </div>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-300">{children}</em>
          ),
          hr: () => (
            <hr className="border-0 h-px bg-white/[0.08] my-4" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 pl-3.5 py-1.5 my-2.5 bg-white/[0.02] rounded-r-xl text-[13px] text-neutral-300 italic border-y-0 border-r-0">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-white/[0.04] font-mono text-[13px] text-indigo-300 border border-white/[0.08]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="rounded-2xl bg-black/50 text-neutral-200 p-4 text-[13px] font-mono overflow-x-auto my-3 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-2xl border border-black/[0.08] bg-white shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#F4F5F7] text-neutral-900 font-semibold border-b border-black/[0.08]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-black/[0.06]">{children}</tbody>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2 text-neutral-900 font-semibold text-[12px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-neutral-800 text-[13px]">
              {React.Children.map(children, (child) =>
                typeof child === "string"
                  ? renderTextWithCitations(child)
                  : child
              )}
            </td>
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}
