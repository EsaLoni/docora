"use client";

import React, { useState, useEffect } from "react";
import { Settings, ShieldCheck, Database, HardDrive, Bell, Check, Sparkles, Key, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [devEmail, setDevEmail] = useState(user?.email || "dev@docora.local");
  const [retrievalMode, setRetrievalMode] = useState("hybrid");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);

  useEffect(() => {
    const existingKey = apiClient.getGeminiApiKey();
    if (existingKey) {
      setGeminiApiKey(existingKey);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setGeminiApiKey(geminiApiKey.trim() || null);
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2000);
  };

  const handleClearGeminiKey = () => {
    apiClient.setGeminiApiKey(null);
    setGeminiApiKey("");
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-[30px] font-semibold text-[#F1F5FC] tracking-tight leading-tight">
          Settings & Environment
        </h1>
        <p className="text-[13px] text-[#A0AEC0] mt-1">
          Configure application parameters, active credentials, and workspace security preferences.
        </p>
      </div>

      <div className="bg-[#151B27] border border-[#273247] rounded-2xl divide-y divide-[#273247] text-xs shadow-sm">
        {/* Workspace Security & Isolation */}
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#F1F5FC]">
            <ShieldCheck className="h-5 w-5 text-[#34D399]" />
            <span>Workspace Security & Tenant Isolation</span>
          </div>
          <p className="text-[#A0AEC0] leading-relaxed text-[13px]">
            All document chunks, vector embeddings, conversations, and tasks are strictly partitioned by cryptographic Workspace ID.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#1B2332] border border-[#273247]">
              <span className="text-[10px] text-[#A0AEC0] uppercase tracking-wider font-semibold">Active Tenant</span>
              <p className="font-semibold text-[#F1F5FC] mt-0.5 text-sm">
                {user?.workspaces?.[0]?.name || "Personal Workspace"}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#1B2332] border border-[#273247]">
              <span className="text-[10px] text-[#A0AEC0] uppercase tracking-wider font-semibold">Storage Quota</span>
              <p className="font-semibold text-[#F1F5FC] mt-0.5 text-sm">100 MB Allocation</p>
            </div>
          </div>
        </div>

        {/* Google Gemini AI Integration (BYOK) */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm text-[#F1F5FC]">
              <Sparkles className="h-5 w-5 text-[#6D8FFF]" />
              <span>Google Gemini AI Integration</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#6D8FFF] hover:underline font-medium"
            >
              <span>Get Free API Key</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-[#A0AEC0] leading-relaxed text-[13px]">
            Provide your Google Gemini API key to run grounded RAG synthesis, document querying, and Studio tools directly with zero queue delay or shared rate limits.
          </p>

          <form onSubmit={handleSaveGeminiKey} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="font-medium text-[#A0AEC0] text-xs">Personal Gemini API Key</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A0AEC0]">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs font-mono focus:border-[#6D8FFF] outline-hidden placeholder:text-[#A0AEC0]/40"
                />
              </div>
              <p className="text-[11px] text-[#A0AEC0]">
                Keys are stored locally in your browser session and sent encrypted via HTTPS directly to your API endpoint.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={handleClearGeminiKey}
                  className="px-3 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  Clear Key
                </button>
              ) : <div />}

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] font-semibold text-xs shadow-sm hover:bg-[#84A2FF] transition"
              >
                {geminiSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Key Saved
                  </>
                ) : (
                  "Save Gemini Key"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Runtime Settings Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#F1F5FC]">
            <Database className="h-5 w-5 text-[#6D8FFF]" />
            <span>Active Configuration</span>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="font-medium text-[#A0AEC0] text-xs">Authenticated Email Identity</label>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs focus:border-[#6D8FFF] outline-hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#A0AEC0] text-xs">Default Retrieval Algorithm</label>
              <select
                value={retrievalMode}
                onChange={(e) => setRetrievalMode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs focus:border-[#6D8FFF] outline-hidden"
              >
                <option value="hybrid">Hybrid (Reciprocal Rank Fusion - 384d Dense MiniLM + Lexical)</option>
                <option value="vector">Pure Dense Vector Search (Cosine Similarity)</option>
                <option value="keyword">Pure Keyword BM25 / Trigram Search</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-[11px] text-[#A0AEC0]">
              Connected to FastAPI backend at <code className="font-mono text-[#F1F5FC]">{apiClient.getBaseUrl() || "relative API origin"}</code>
            </span>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] font-semibold text-xs shadow-sm hover:bg-[#84A2FF] transition"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
