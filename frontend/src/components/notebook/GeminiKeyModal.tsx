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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#273247] bg-[#151B27] shadow-2xl overflow-hidden flex flex-col relative z-50 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#273247] bg-[#10141D]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6D8FFF]/10 border border-[#6D8FFF]/30 flex items-center justify-center text-[#6D8FFF]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5FC]">Connect Google Gemini AI</h3>
              <p className="text-[11px] text-[#A0AEC0]">Required for document chat & Studio generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#1B2332] border border-[#273247] text-xs space-y-2">
            <p className="text-[#F1F5FC] font-medium leading-relaxed">
              Docora runs grounded RAG and Studio tools (Quizzes, Flashcards, Podcasts) directly via Google Gemini AI.
            </p>
            <div className="flex items-center justify-between pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[#6D8FFF] hover:underline font-semibold"
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
              <label className="block text-xs font-medium text-[#A0AEC0]">
                Google Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 text-[11px] text-[#6D8FFF] hover:underline cursor-pointer"
              >
                <Clipboard className="w-3 h-3" />
                <span>{copiedNotification ? "Pasted!" : "Paste from Clipboard"}</span>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A0AEC0]">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs placeholder:text-[#A0AEC0]/40 focus:border-[#6D8FFF] outline-hidden font-mono"
              />
            </div>

            {isAIzaKey && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Valid Google Gemini API Key format detected.</span>
              </p>
            )}

            {isSuspiciousKey && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Note: Google AI Studio API keys typically start with "AIzaSy...".</span>
              </p>
            )}

            <p className="text-[11px] text-[#A0AEC0]">
              Your key is saved locally in your browser and sent securely only for your queries.
            </p>
          </div>

          {isSaved && (
            <div className="p-2.5 rounded-xl bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Key saved successfully! Ready to generate.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {apiClient.getGeminiApiKey() ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-400/10 transition-colors"
              >
                Clear key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!apiKey.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#6D8FFF] text-[#0B0D12] hover:bg-[#84A2FF] disabled:opacity-50 transition-colors flex items-center gap-1.5"
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
