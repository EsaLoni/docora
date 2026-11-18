"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Key, Check, ExternalLink, X, Clipboard, ShieldCheck, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiKeyModal({ isOpen, onClose }: GeminiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = apiClient.getGeminiApiKey();
      setApiKey(existing || "");
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKey(text.trim());
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    apiClient.setGeminiApiKey(cleanKey || null);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    apiClient.setGeminiApiKey(null);
    setApiKey("");
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const isAIzaKey = apiKey.trim().startsWith("AIzaSy");
  const isSuspiciousKey = apiKey.trim().length > 0 && !isAIzaKey;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0E1118] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col relative z-50 select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-[#0A0C12]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Connect Google Gemini AI</h3>
              <p className="text-[11px] text-neutral-400">Custom BYOK key or live platform default</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 bg-[#0E1118]">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2">
            <p className="text-neutral-200 font-medium leading-relaxed">
              Docora runs grounded RAG and Studio tools (Quizzes, Flashcards, Podcasts) directly via Google Gemini AI.
            </p>
            <div className="flex items-center justify-between pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                <span>Get a free key from Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                100% Free
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Google Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                <Clipboard className="w-3 h-3" />
                <span>{copiedNotification ? "Pasted!" : "Paste from Clipboard"}</span>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
              />
            </div>

            {isAIzaKey && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Valid Google Gemini API Key format detected.</span>
              </p>
            )}

            {isSuspiciousKey && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Note: Google AI Studio API keys typically start with "AIzaSy...".</span>
              </p>
            )}

            <p className="text-[11px] text-neutral-500">
              Your key is saved locally in your browser and used securely for inference.
            </p>
          </div>

          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Key saved successfully! Ready to generate.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
            {apiClient.getGeminiApiKey() ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                Clear key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!apiKey.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Connect</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
