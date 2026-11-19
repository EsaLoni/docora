"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationChip } from "@/components/ui/CitationChip";
import { CitationItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type { CitationItem };

export interface FormattedMessageProps {
  content: string;
  citations?: CitationItem[];
  onOpenCitation?: (citation: CitationItem, index?: number) => void;
  className?: string;
}

export function FormattedMessage({
  content,
  citations = [],
  onOpenCitation,
  className,
}: FormattedMessageProps) {
  // Pre-process content: clean up any duplicate bold markers inside headers or triple line breaks
  const cleanedContent = useMemo(() => {
    if (!content) return "";
    return content
      .replace(/^#{1,6}\s+\*\*([^*]+)\*\*/gm, "### $1")
      .replace(/^\s*\*\*(?:\d+\.|\d+\))\s*([^*]+)\*\*/gm, "### $1")
      .replace(/^\s*\*\*([A-Z0-9\s\-_:]{3,50})\*\*\s*$/gm, "### $1")
      .replace(/\n{3,}/g, "\n\n");
  }, [content]);

  // Transform inline citation markers like [Source 1], [Source 1, Page 2], or [1] into CitationChip
  const renderTextWithCitations = (text: string) => {
    if (typeof text !== "string") return text;

    const parts: React.ReactNode[] = [];
    // Matches [Source N], [Source N, Page P], or [N] (1-2 digits, not followed by markdown URL parenthetical)
    const citationRegex = /(?:\[Source\s*(\d+)(?:,\s*[Pp]age\s*\d+)?\]|\[(\d{1,2})\](?!\())/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const sourceNum = parseInt(match[1] || match[2], 10);
      const matchedCitation =
        citations && citations.length >= sourceNum
          ? citations[sourceNum - 1]
          : citations && citations.length > 0
          ? citations[0]
          : undefined;

      parts.push(
        <CitationChip
          key={`cite-${matchIndex}-${sourceNum}`}
          index={sourceNum}
          sourceTitle={matchedCitation?.document_filename}
          pageNumber={matchedCitation?.page_number}
          snippet={matchedCitation?.quote}
          onClick={() => {
            if (matchedCitation && onOpenCitation) {
              onOpenCitation(matchedCitation, sourceNum);
            }
          }}
        />
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
        "w-full max-w-[65ch] font-serif text-reading leading-relaxed text-ink select-text",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-sans font-semibold text-title tracking-tight text-ink mt-6 mb-2.5 pb-1 border-b border-hairline">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-sans font-semibold text-section tracking-tight text-ink mt-5 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-sans font-semibold text-ui text-ink mt-4 mb-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-sans font-semibold text-caption uppercase tracking-wider text-ink-muted mt-3 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2.5 font-serif text-reading text-ink leading-relaxed font-normal">
              {React.Children.map(children, (child) =>
                typeof child === "string"
                  ? renderTextWithCitations(child)
                  : child
              )}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 pl-1 list-none font-serif text-reading text-ink">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-1.5 pl-5 list-decimal font-serif text-reading text-ink marker:font-mono marker:text-caption marker:text-ink-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="font-serif text-reading leading-relaxed text-ink flex items-start gap-2.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-border-strong mt-2.5 shrink-0" />
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
            <strong className="font-semibold text-ink">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-ink-secondary">{children}</em>
          ),
          hr: () => (
            <hr className="border-0 h-px bg-border-hairline my-5" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border border-border-hairline px-4 py-2.5 my-3 bg-surface-subtle rounded-md text-ui text-ink-secondary italic font-serif">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-surface-subtle font-mono text-caption text-ink border border-hairline"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="rounded-lg bg-surface-subtle text-ink p-4 text-caption font-mono overflow-x-auto my-3 border border-hairline">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-hairline bg-surface shadow-xs">
              <table className="w-full text-ui text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-subtle text-ink font-sans font-semibold border-b border-hairline">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-hairline font-sans text-ui">{children}</tbody>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 text-ink font-sans font-semibold text-caption uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-ink-secondary font-sans text-ui">
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
