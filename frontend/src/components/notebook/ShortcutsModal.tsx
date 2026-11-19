"use client";

import React, { useEffect } from "react";
import { X, Command } from "lucide-react";
import { Button } from "@/components/ui";

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Panels & Navigation" | "Workspace & Search";
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["⌘ / Ctrl", "B"],
    description: "Toggle Sources / Notes panel",
    category: "Panels & Navigation",
  },
  {
    keys: ["⌘ / Ctrl", "J"],
    description: "Toggle Studio shelf",
    category: "Panels & Navigation",
  },
  {
    keys: ["⌘ / Ctrl", "K"],
    description: "Open Command Palette",
    category: "Workspace & Search",
  },
  {
    keys: ["?"],
    description: "Open Keyboard Shortcuts overlay",
    category: "Workspace & Search",
  },
  {
    keys: ["Esc"],
    description: "Close active drawer, modal, or preview",
    category: "Panels & Navigation",
  },
  {
    keys: ["Enter"],
    description: "Submit query in composer dock",
    category: "Workspace & Search",
  },
  {
    keys: ["Shift", "Enter"],
    description: "Insert new line in query composer",
    category: "Workspace & Search",
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-hairline rounded-2xl shadow-xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-surface-subtle border border-hairline text-ink-secondary">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-title font-sans text-ink leading-tight">
                Keyboard Shortcuts
              </h3>
              <p className="text-caption text-ink-secondary">
                Quick commands to navigate and control the research workspace.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-8 w-8 text-ink-muted hover:text-ink"
            aria-label="Close shortcuts modal"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map((category) => (
            <div key={category} className="space-y-2">
              <h4 className="text-micro font-mono uppercase tracking-wider text-ink-muted">
                {category}
              </h4>
              <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface-subtle overflow-hidden">
                {SHORTCUTS.filter((s) => s.category === category).map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 text-ui hover:bg-surface/50 transition-colors duration-150"
                  >
                    <span className="text-ink text-[13px] font-sans">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded border border-hairline bg-surface text-ink font-mono text-[11px] shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="pt-2 border-t border-hairline flex items-center justify-between text-caption text-ink-muted">
          <span>Press <kbd className="px-1.5 py-0.2 rounded border border-hairline bg-surface-subtle font-mono text-micro text-ink">?</kbd> anywhere to open</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
