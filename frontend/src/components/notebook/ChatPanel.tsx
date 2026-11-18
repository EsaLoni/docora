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
import { ChatMessage, apiClient } from "@/lib/api-client";
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
  onOpenGeminiKey?: () => void;
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
  onOpenGeminiKey,
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
    <div className="h-full flex flex-col min-h-0 bg-[#0E1118] text-[#F3F4F6] relative">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Grounded Research Intelligence</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              {notebookTitle || "Research Workspace"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-md leading-relaxed">
              {sourcesCount > 0
                ? `Ready with ${sourcesCount} active source${sourcesCount > 1 ? "s" : ""}. Ask complex queries, explore connections, or generate learning guides.`
                : "Add documents, notes, or web links on the left to ground conversations in your knowledge."}
            </p>

            {/* Quick Prompt Chips */}
            {sourcesCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full max-w-md text-left">
                {[
                  "Summarize key findings and conclusions",
                  "What are the main risks or limitations?",
                  "Generate a step-by-step learning guide",
                  "Compare the critical data points across sources",
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 text-xs text-neutral-300 hover:text-white text-left transition-all font-medium leading-relaxed shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] active:scale-[0.99]"
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
                <div className="max-w-[85%] rounded-2xl bg-indigo-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium leading-relaxed shadow-sm shadow-indigo-600/10">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] sm:max-w-[90%] w-full space-y-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
                  {/* Assistant Message Header */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-neutral-300">Docora Intelligence</span>
                  </div>

                  {/* Formatted Markdown Body */}
                  <div className="text-xs sm:text-sm leading-relaxed text-neutral-200">
                    {msg.content ? (
                      <FormattedMessage content={msg.content} citations={msg.citations} />
                    ) : (
                      <div className="flex items-center gap-2 text-neutral-400 text-xs py-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        <span>Synthesizing verified source evidence...</span>
                      </div>
                    )}
                  </div>

                  {/* Message Actions Row */}
                  {!msg.isStreaming && msg.content && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.04] text-neutral-400">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors text-xs flex items-center gap-1"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSaveNote(msg)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors text-xs flex items-center gap-1"
                        title="Save to Notes"
                      >
                        {savedNoteId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] text-emerald-400">Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Save as Note</span>
                          </>
                        )}
                      </button>

                      <div className="h-3 w-[1px] bg-white/[0.08] mx-1" />

                      <button
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
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
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/[0.08] bg-[#11141D] shadow-2xl p-2 transition-all focus-within:ring-1 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50">
          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sourcesCount > 0
                ? "Ask anything grounded in your sources (Enter to send)..."
                : "Add sources on the left, then ask questions..."
            }
            className="w-full bg-transparent border-0 px-3 py-2 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 outline-none resize-none max-h-32 min-h-[40px]"
          />

          {/* Bottom Bar inside Composer */}
          <div className="flex items-center justify-between px-2 pt-1 border-t border-white/[0.04]">
            {/* Style Selector */}
            <div className="relative">
              <button
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Response Style"
              >
                <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                <span>{activeStyleLabel}</span>
              </button>

              {/* Dropdown Menu */}
              {showStyleMenu && (
                <div className="absolute bottom-9 left-0 w-64 rounded-xl border border-white/[0.08] bg-[#151824] shadow-2xl p-1.5 z-50 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Response Mode
                  </div>
                  {RESPONSE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setResponseStyle(style.id);
                        setShowStyleMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        responseStyle === style.id
                          ? "bg-indigo-600 text-white font-medium"
                          : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <div className="font-semibold">{style.label}</div>
                      <div
                        className={`text-[10px] ${
                          responseStyle === style.id ? "text-indigo-200" : "text-neutral-400"
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
              onClick={() => onSendMessage()}
              disabled={!inputQuery.trim() || isGenerating}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                inputQuery.trim() && !isGenerating
                  ? "bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 active:scale-95"
                  : "bg-white/[0.04] text-neutral-600 cursor-not-allowed"
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
