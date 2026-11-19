"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  SlidersHorizontal,
  Copy,
  Check,
  Bookmark,
  FileText,
  AlertTriangle,
  Compass,
  GitCompare,
  ArrowRight,
  Filter,
  Layers,
  Key,
  Info,
} from "lucide-react";
import { ChatMessage, SourceItem } from "@/lib/api-client";
import { FormattedMessage, CitationItem } from "@/components/chat/FormattedMessage";
import { CitationDrawer } from "@/components/notebook/CitationDrawer";
import { Button } from "@/components/ui/Button";

const RESPONSE_STYLES = [
  { id: "default", label: "Default Balanced", desc: "Objective, concise synthesis" },
  { id: "learning_guide", label: "Learning Guide", desc: "Structured educational walkthrough" },
  { id: "analyst", label: "Executive Analyst", desc: "Strategic data-driven insights & risks" },
  { id: "academic", label: "Academic Scholar", desc: "Rigorous citation-dense examination" },
  { id: "concise", label: "Ultra Concise", desc: "High-density bullet points only" },
  { id: "detailed", label: "Comprehensive Deep Dive", desc: "Exhaustive multi-section breakdown" },
];

const PROMPT_STARTERS = [
  {
    icon: FileText,
    title: "Executive Synthesis",
    desc: "Distill critical findings, metrics, and decisive conclusions across documents.",
    prompt: "Provide an executive summary of key findings, core deliverables, and decisive conclusions across the provided sources.",
  },
  {
    icon: AlertTriangle,
    title: "Risks & Constraints",
    desc: "Expose operational vulnerabilities, gaps, and hidden caveats.",
    prompt: "Analyze the main operational risks, vulnerabilities, and data gaps highlighted in these materials.",
  },
  {
    icon: Compass,
    title: "Learning Roadmap",
    desc: "Step-by-step conceptual walkthrough with verified citations.",
    prompt: "Generate a step-by-step educational learning guide covering the core foundational concepts in these sources.",
  },
  {
    icon: GitCompare,
    title: "Comparative Analysis",
    desc: "Cross-examine metrics, methodology, and conflicting data points.",
    prompt: "Compare the critical metrics, methodology, and data points across these sources, noting any contradictions.",
  },
];

export interface ChatPanelProps {
  messages: ChatMessage[];
  inputQuery: string;
  setInputQuery: (q: string) => void;
  isGenerating: boolean;
  responseStyle: string;
  setResponseStyle: (style: string) => void;
  onSendMessage: () => Promise<void>;
  onSaveAsNote: (msg: ChatMessage) => Promise<void>;
  sourcesCount: number;
  sources?: SourceItem[];
  notebookTitle?: string;
  onOpenGeminiKey?: () => void;
  onOpenAddSource?: () => void;
  isFallbackModel?: boolean;
  isRateLimited?: boolean;
}

export function ChatPanel({
  messages,
  inputQuery,
  setInputQuery,
  isGenerating,
  responseStyle,
  setResponseStyle,
  onSendMessage,
  onSaveAsNote,
  sourcesCount,
  sources = [],
  notebookTitle,
  onOpenGeminiKey,
  onOpenAddSource,
  isFallbackModel = false,
  isRateLimited = false,
}: ChatPanelProps) {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showScopeMenu, setShowScopeMenu] = useState(false);
  const [selectedSourceScope, setSelectedSourceScope] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // Citation preview drawer state
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [selectedCitationIndex, setSelectedCitationIndex] = useState<number>(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputQuery(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNote = async (msg: ChatMessage) => {
    await onSaveAsNote(msg);
    setSavedNoteId(msg.id);
    setTimeout(() => setSavedNoteId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputQuery.trim() && !isGenerating) {
        onSendMessage();
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleOpenCitation = (citation: CitationItem, index?: number) => {
    setSelectedCitation(citation);
    setSelectedCitationIndex(index ?? 1);
    setIsDrawerOpen(true);
  };

  const activeStyleLabel = RESPONSE_STYLES.find((s) => s.id === responseStyle)?.label || "Balanced";
  const activeScopeLabel =
    selectedSourceScope === "all"
      ? `All Sources (${sourcesCount})`
      : sources.find((s) => s.id === selectedSourceScope)?.title || "Selected Source";

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface text-ink relative overflow-hidden font-sans select-none">
      {/* Fallback Model Alert Banner */}
      {isFallbackModel && (
        <div className="px-4 py-2 bg-surface-subtle border-b border-hairline flex items-center justify-between text-caption text-ink-secondary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-verdigris shrink-0" />
            <span className="truncate">
              Operating on standard fallback model. Add your personal Gemini API key for dedicated throughput.
            </span>
          </div>
          {onOpenGeminiKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenGeminiKey}
              className="text-micro font-medium text-ink shrink-0 h-6 px-2"
            >
              Configure Key
            </Button>
          )}
        </div>
      )}

      {/* Rate Limit Reached Alert Banner */}
      {isRateLimited && (
        <div className="px-4 py-2 bg-surface-subtle border-b border-hairline flex items-center justify-between text-caption text-ink-secondary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">
              Rate limit reached on shared tier. Please wait a moment, or configure your free personal Gemini API key for higher capacity.
            </span>
          </div>
          {onOpenGeminiKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenGeminiKey}
              className="text-micro font-medium text-ink shrink-0 h-6 px-2"
            >
              Configure Key
            </Button>
          )}
        </div>
      )}

      {/* Reading Canvas & Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 min-h-0 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center max-w-[65ch] mx-auto py-6">
            {sourcesCount === 0 ? (
              /* State: No Sources Yet */
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <h2 className="text-title font-sans font-semibold text-ink tracking-tight">
                    No Documents Attached
                  </h2>
                  <p className="text-reading font-serif text-ink-secondary leading-relaxed">
                    Upload a PDF, document, or research note from the Sources panel on the left to begin grounded synthesis.
                  </p>
                </div>
                {onOpenAddSource && (
                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onOpenAddSource}
                      className="text-ui font-medium"
                    >
                      Attach Documents
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* State: Active Sources Ready - Clean Paper Prompt Angles */
              <div className="space-y-6 text-left">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-subtle border border-hairline text-micro font-mono text-ink-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-verdigris" />
                    <span>Grounded in {sourcesCount} active {sourcesCount === 1 ? "source" : "sources"}</span>
                  </div>
                  <h2 className="text-title font-sans font-semibold text-ink tracking-tight">
                    {notebookTitle && notebookTitle !== "k" && notebookTitle.trim()
                      ? notebookTitle
                      : "Research & Synthesis Canvas"}
                  </h2>
                  <p className="text-reading font-serif text-ink-secondary leading-relaxed">
                    Ask an inquiry across your ingested documents, or select a structured research angle below:
                  </p>
                </div>

                {/* Editorial Prompt Starters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  {PROMPT_STARTERS.map((starter, idx) => {
                    const Icon = starter.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputQuery(starter.prompt);
                          textareaRef.current?.focus();
                        }}
                        className="p-3.5 rounded-lg border border-hairline bg-surface-subtle hover:bg-surface hover:border-border-strong text-left transition-colors duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 text-ink-muted group-hover:text-ink transition-colors duration-150 shrink-0" />
                            <span className="text-ui font-medium text-ink truncate">
                              {starter.title}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-ink transition-colors duration-150 shrink-0" />
                        </div>
                        <p className="text-caption font-sans text-ink-muted mt-1.5 leading-snug line-clamp-2">
                          {starter.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Conversation Stream */
          <div className="max-w-[720px] mx-auto w-full space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender_type === "user" ? "items-end" : "items-start"
                }`}
              >
                {msg.sender_type === "user" ? (
                  /* User Question: Sans typography, clean bubble */
                  <div className="max-w-[85%] rounded-xl bg-surface-subtle border border-hairline text-ink px-4 py-2.5 text-ui font-sans font-medium leading-relaxed select-text shadow-2xs">
                    {msg.content}
                  </div>
                ) : (
                  /* Assistant Answer: Serif typography, 65ch measure */
                  <div className="w-full space-y-2 select-text">
                    {/* Header mark */}
                    <div className="flex items-center gap-1.5 text-caption font-sans font-medium text-ink-muted select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-verdigris" />
                      <span>Docora Synthesis</span>
                    </div>

                    {/* Formatted body */}
                    {msg.content ? (
                      <FormattedMessage
                        content={msg.content}
                        citations={msg.citations}
                        onOpenCitation={handleOpenCitation}
                      />
                    ) : (
                      /* State: Streaming synthesis indicator */
                      <div className="flex items-center gap-2 py-3 text-caption font-sans text-ink-muted select-none">
                        <span className="w-2 h-2 rounded-full bg-verdigris animate-pulse" />
                        <span>Synthesizing verified source evidence...</span>
                      </div>
                    )}

                    {/* Action buttons below assistant response */}
                    {!msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-1 pt-2 select-none">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="h-7 px-2 text-micro font-medium text-ink-muted hover:text-ink flex items-center gap-1"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-verdigris" />
                              <span className="text-verdigris">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveNote(msg)}
                          className="h-7 px-2 text-micro font-medium text-ink-muted hover:text-ink flex items-center gap-1"
                        >
                          {savedNoteId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-verdigris" />
                              <span className="text-verdigris">Saved</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3 h-3" />
                              <span>Save as Note</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Dock */}
      <div className="p-3 sm:p-4 bg-surface border-t border-hairline shrink-0">
        <div className="max-w-[720px] mx-auto space-y-1.5">
          <div className="rounded-xl border border-hairline bg-surface-subtle p-2.5 transition-colors focus-within:border-border-strong focus-within:ring-1 focus-within:ring-border-strong">
            {/* Auto-expanding Input Field */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                sourcesCount > 0
                  ? "Inquire across your grounded sources..."
                  : "Add sources on the left, then ask questions..."
              }
              className="w-full bg-transparent border-0 px-2 py-1 text-[16px] sm:text-ui font-sans text-ink placeholder:text-ink-muted outline-none resize-none min-h-[44px] max-h-36 leading-relaxed select-text"
            />

            {/* Bottom Bar: Scope Selector, Response Style, Single Gold Send Action */}
            <div className="flex items-center justify-between px-1 pt-2 border-t border-hairline/60">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Source Scope Selector */}
                {sourcesCount > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowScopeMenu(!showScopeMenu);
                        setShowStyleMenu(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-micro font-mono text-ink-secondary hover:text-ink hover:bg-surface border border-hairline transition-colors duration-150"
                      title="Filter source scope"
                    >
                      <Filter className="w-3 h-3 text-verdigris" />
                      <span className="truncate max-w-[140px]">{activeScopeLabel}</span>
                    </button>

                    {showScopeMenu && (
                      <div className="absolute bottom-8 left-0 w-56 rounded-lg border border-hairline bg-surface shadow-md p-1.5 z-40 space-y-0.5 text-ink">
                        <div className="px-2 py-1 text-micro font-mono uppercase tracking-wider text-ink-muted">
                          Source Scope
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSourceScope("all");
                            setShowScopeMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-ui transition-colors duration-150 ${
                            selectedSourceScope === "all"
                              ? "bg-surface-subtle text-ink font-medium"
                              : "text-ink-secondary hover:bg-surface-subtle"
                          }`}
                        >
                          All Active Sources ({sourcesCount})
                        </button>
                        {sources.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSourceScope(s.id);
                              setShowScopeMenu(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-ui truncate transition-colors duration-150 ${
                              selectedSourceScope === s.id
                                ? "bg-surface-subtle text-ink font-medium"
                                : "text-ink-secondary hover:bg-surface-subtle"
                            }`}
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Response Style Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStyleMenu(!showStyleMenu);
                      setShowScopeMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-micro font-mono text-ink-secondary hover:text-ink hover:bg-surface border border-hairline transition-colors duration-150"
                    title="Response synthesis mode"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-ink-muted" />
                    <span>{activeStyleLabel}</span>
                  </button>

                  {showStyleMenu && (
                    <div className="absolute bottom-8 left-0 w-60 rounded-lg border border-hairline bg-surface shadow-md p-1.5 z-40 space-y-0.5 text-ink">
                      <div className="px-2 py-1 text-micro font-mono uppercase tracking-wider text-ink-muted">
                        Synthesis Mode
                      </div>
                      {RESPONSE_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => {
                            setResponseStyle(style.id);
                            setShowStyleMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-ui transition-colors duration-150 ${
                            responseStyle === style.id
                              ? "bg-surface-subtle text-ink font-medium"
                              : "text-ink-secondary hover:bg-surface-subtle"
                          }`}
                        >
                          <div className="font-medium text-ink">{style.label}</div>
                          <div className="text-micro text-ink-muted">{style.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Single Primary Gold Send Action */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => onSendMessage()}
                disabled={!inputQuery.trim() || isGenerating}
                className="h-8 w-8 p-0 rounded-lg flex items-center justify-center shrink-0"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Visible Keyboard Hint */}
          <div className="text-center">
            <span className="text-micro font-mono text-ink-muted">
              Press Enter to send, Shift + Enter for new line
            </span>
          </div>
        </div>
      </div>

      {/* Citation Preview Drawer */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citation={selectedCitation}
        citationIndex={selectedCitationIndex}
      />
    </div>
  );
}
