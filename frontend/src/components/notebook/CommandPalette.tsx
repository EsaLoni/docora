"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  StickyNote,
  Headphones,
  HelpCircle,
  GitFork,
  Layers,
  PanelLeftClose,
  PanelRightClose,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddSource: () => void;
  onOpenCreateNote: () => void;
  onOpenTool: (toolId: string) => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onFocusChat: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenAddSource,
  onOpenCreateNote,
  onOpenTool,
  onToggleLeftPanel,
  onToggleRightPanel,
  onFocusChat,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    {
      id: "add_source",
      title: "Add Knowledge Source...",
      desc: "Link PDF, URL, or raw text to notebook",
      category: "Sources",
      icon: Plus,
      action: () => onOpenAddSource(),
    },
    {
      id: "create_note",
      title: "Create Note",
      desc: "Write a new notebook note or synthesis",
      category: "Sources",
      icon: StickyNote,
      action: () => onOpenCreateNote(),
    },
    {
      id: "focus_chat",
      title: "Focus Chat Composer",
      desc: "Jump straight to the inquiry prompt",
      category: "Workspace",
      icon: MessageSquare,
      action: () => onFocusChat(),
    },
    {
      id: "tool_quiz",
      title: "Studio: Interactive Quiz",
      desc: "Generate knowledge check questions",
      category: "Studio",
      icon: HelpCircle,
      action: () => onOpenTool("quiz"),
    },
    {
      id: "tool_flashcards",
      title: "Studio: Flashcards",
      desc: "Generate revision cards for memorization",
      category: "Studio",
      icon: Layers,
      action: () => onOpenTool("flashcards"),
    },
    {
      id: "tool_audio",
      title: "Studio: Audio Overview",
      desc: "Generate two-host AI podcast dialogue",
      category: "Studio",
      icon: Headphones,
      action: () => onOpenTool("audio"),
    },
    {
      id: "tool_mindmap",
      title: "Studio: Mind Map",
      desc: "Generate visual concept ontology graph",
      category: "Studio",
      icon: GitFork,
      action: () => onOpenTool("mindmap"),
    },
    {
      id: "toggle_sources",
      title: "Toggle Sources Panel",
      desc: "Collapse or expand left panel rail",
      category: "Panels",
      icon: PanelLeftClose,
      action: () => onToggleLeftPanel(),
    },
    {
      id: "toggle_studio",
      title: "Toggle Studio Panel",
      desc: "Collapse or expand right panel rail",
      category: "Panels",
      icon: PanelRightClose,
      action: () => onToggleRightPanel(),
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.desc.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setSearch("");
        }
      }
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4 select-none">
      <div className="w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.08] bg-[#F4F5F7]">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search actions..."
            autoFocus
            className="w-full bg-transparent border-0 text-xs text-neutral-900 placeholder-neutral-400 outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded-sm border border-border-hairline bg-surface text-micro text-ink-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-84 overflow-y-auto p-2 space-y-1 bg-surface">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-gold text-gold-fg shadow-xs"
                      : "text-ink hover:bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md border shrink-0 ${
                        isSelected
                          ? "bg-white/20 border-white/30 text-gold-fg"
                          : "bg-surface-subtle border-border-hairline text-ink-secondary"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-ui font-medium truncate tracking-tight">{cmd.title}</p>
                      <p
                        className={`text-caption truncate ${
                          isSelected ? "text-gold-fg/90" : "text-ink-muted"
                        }`}
                      >
                        {cmd.desc}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-micro text-gold-fg pr-1 shrink-0 font-mono">
                      <span>↵</span>
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-caption text-ink-muted">
              No matching commands found.
            </div>
          )}
        </div>

        {/* Keyboard hints footer */}
        <div className="px-4 py-2 bg-surface-subtle border-t border-border-hairline flex items-center justify-between text-micro text-ink-muted font-mono">
          <span>Navigate with <kbd className="text-ink">↑</kbd> <kbd className="text-ink">↓</kbd></span>
          <span>Select with <kbd className="text-ink">↵ Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}
