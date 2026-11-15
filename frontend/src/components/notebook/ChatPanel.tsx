"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  SlidersHorizontal,
  Copy,
  Check,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import { ChatMessage } from "@/lib/api-client";
import { FormattedMessage } from "@/components/chat/FormattedMessage";

const RESPONSE_STYLES = [
  { id: "default", label: "Default Balanced", desc: "Objective, concise synthesis" },
  { id: "learning_guide", label: "Learning Guide", desc: "Structured educational walkthrough" },
  { id: "analyst", label: "Executive Analyst", desc: "Strategic data-driven insights & risks" },
  { id: "academic", label: "Academic Scholar", desc: "Rigorous citation-dense examination" },
  { id: "concise", label: "Ultra Concise", desc: "High-density bullet points only" },
  { id: "detailed", label: "Comprehensive Deep Dive", desc: "Exhaustive multi-section breakdown" },
];

interface ChatPanelProps {
  messages: ChatMessage[];
  inputQuery: string;
  setInputQuery: (q: string) => void;
  isGenerating: boolean;
  responseStyle: string;
  setResponseStyle: (style: string) => void;
  onSendMessage: () => Promise<void>;
  onSaveAsNote: (msg: ChatMessage) => Promise<void>;
  sourcesCount: number;
  notebookTitle?: string;
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
  notebookTitle,
}: ChatPanelProps) {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Copy handler
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save note wrapper
  const handleSaveNote = async (msg: ChatMessage) => {
    await onSaveAsNote(msg);
    setSavedNoteId(msg.id);
    setTimeout(() => setSavedNoteId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const activeStyleLabel = RESPONSE_STYLES.find((s) => s.id === responseStyle)?.label || "Balanced";

  return (
    <div className="h-full flex flex-col min-h-0 bg-[var(--panel)] text-[var(--text-primary)] relative">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-12 h-12 rounded-2xl bg-[var(--panel-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-blue)] mb-4 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {notebookTitle || "Welcome to your notebook"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md leading-relaxed">
              {sourcesCount > 0
                ? `Ready with ${sourcesCount} active source${sourcesCount > 1 ? "s" : ""}. Ask complex questions, synthesize findings, or generate new learning artifacts.`
                : "Add documents, notes, or web links on the left to ground conversations in your knowledge."}
            </p>

            {/* Quick Prompt Chips */}
            {sourcesCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8 w-full max-w-md text-left">
                {[
                  "Summarize the key findings and conclusions",
                  "What are the main risks or limitations discussed?",
                  "Generate a step-by-step learning guide",
                  "Compare the critical data points across sources",
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--tile)] hover:bg-[var(--tile-hover)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left transition-colors font-medium leading-relaxed"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender_type === "user" ? "items-end" : "items-start"}`}
            >
              {msg.sender_type === "user" ? (
                <div className="max-w-[85%] rounded-3xl bg-[var(--accent-blue)] text-white px-5 py-3 text-sm font-medium leading-relaxed shadow-xs">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] sm:max-w-[90%] w-full space-y-3">
                  {/* Assistant Message Header */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    <span>Docora Intelligence</span>
                  </div>

                  {/* Formatted Markdown Body */}
                  <div className="text-sm leading-relaxed text-[var(--text-primary)] pl-0 sm:pl-5">
                    {msg.content ? (
                      <FormattedMessage content={msg.content} citations={msg.citations} />
                    ) : (
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs py-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-ping" />
                        <span>Synthesizing verified source evidence...</span>
                      </div>
                    )}
                  </div>

                  {/* Message Actions Row */}
                  {!msg.isStreaming && msg.content && (
                    <div className="flex items-center gap-1.5 pl-0 sm:pl-5 pt-1 text-[var(--text-muted)]">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 rounded-lg hover:bg-[var(--tile-hover)] hover:text-[var(--text-primary)] transition-colors text-xs flex items-center gap-1"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleSaveNote(msg)}
                        className="p-1.5 rounded-lg hover:bg-[var(--tile-hover)] hover:text-[var(--text-primary)] transition-colors text-xs flex items-center gap-1"
                        title="Save to notebook notes"
                      >
                        {savedNoteId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[11px] hidden sm:inline">Save note</span>
                      </button>

                      <div className="h-3 w-[1px] bg-[var(--border-subtle)] mx-1" />

                      <button
                        className="p-1.5 rounded-lg hover:bg-[var(--tile-hover)] hover:text-[var(--text-primary)] transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-[var(--tile-hover)] hover:text-[var(--text-primary)] transition-colors"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Composer Container */}
      <div className="p-3 sm:p-4 bg-transparent shrink-0">
        <div className="max-w-3xl mx-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--composer)] shadow-lg p-2 transition-all focus-within:ring-1 focus-within:ring-[var(--accent-blue)]">
          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sourcesCount > 0
                ? "Ask anything about your sources (Press Enter to send)..."
                : "Add sources on the left, then ask questions..."
            }
            className="w-full bg-transparent border-0 px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none max-h-32 min-h-[40px]"
          />

          {/* Bottom Bar inside Composer */}
          <div className="flex items-center justify-between px-2 pt-1">
            {/* Style Selector */}
            <div className="relative">
              <button
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)] transition-colors"
                title="Response Style"
              >
                <SlidersHorizontal className="w-3 h-3 text-[var(--accent-blue)]" />
                <span>{activeStyleLabel}</span>
              </button>

              {/* Dropdown Menu */}
              {showStyleMenu && (
                <div className="absolute bottom-9 left-0 w-64 rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel)] shadow-xl p-1.5 z-50 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Response Style
                  </div>
                  {RESPONSE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setResponseStyle(style.id);
                        setShowStyleMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                        responseStyle === style.id
                          ? "bg-[var(--accent-blue)] text-white"
                          : "text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
                      }`}
                    >
                      <div className="font-semibold">{style.label}</div>
                      <div
                        className={`text-[10px] ${
                          responseStyle === style.id ? "text-blue-100" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {style.desc}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={onSendMessage}
              disabled={!inputQuery.trim() || isGenerating}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                inputQuery.trim() && !isGenerating
                  ? "bg-[var(--accent-blue)] text-white shadow-xs hover:opacity-90"
                  : "bg-[var(--tile)] text-[var(--text-muted)] cursor-not-allowed"
              }`}
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
