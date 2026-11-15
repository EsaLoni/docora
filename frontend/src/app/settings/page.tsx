"use client";

import React, { useState } from "react";
import { Settings, ShieldCheck, Database, HardDrive, Bell, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [devEmail, setDevEmail] = useState(user?.email || "dev@docora.local");
  const [retrievalMode, setRetrievalMode] = useState("hybrid");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              Connected to FastAPI backend at <code className="font-mono text-[#F1F5FC]">http://127.0.0.1:8000</code>
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
