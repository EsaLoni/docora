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
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isExpanded = expandedId === toast.id;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl border border-[#273247] bg-[#151B27] shadow-2xl p-3.5 text-[#F1F5FC] transition-all animate-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-500" />}
                {toast.type === "info" && <Info className="w-4 h-4 text-blue-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{toast.title}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {toast.message}
                </p>

                {toast.diagnostic && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : toast.id)}
                      className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
                    >
                      <span>Diagnostic info</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isExpanded && (
                      <pre className="mt-1 p-2 rounded-xl bg-[var(--panel-raised)] text-[9px] font-mono text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(toast.diagnostic, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => onRemoveToast(toast.id)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
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
