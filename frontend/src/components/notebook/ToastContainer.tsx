"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { ToastNotification } from "@/hooks/useNotebook";

interface ToastContainerProps {
  toasts: ToastNotification[];
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const isExpanded = expandedId === toast.id;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-[#0E1118]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-3.5 text-white transition-all animate-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
                {toast.type === "info" && <Info className="w-4 h-4 text-indigo-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white tracking-tight">{toast.title}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  {toast.message}
                </p>

                {toast.diagnostic && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : toast.id)}
                      className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                    >
                      <span>Diagnostic info</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isExpanded && (
                      <pre className="mt-1 p-2 rounded-xl bg-black/40 border border-white/[0.06] text-[9px] font-mono text-neutral-400 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(toast.diagnostic, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => onRemoveToast(toast.id)}
                className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
