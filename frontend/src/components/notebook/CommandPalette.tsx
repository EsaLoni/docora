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
  Moon,
  Sun,
  PanelLeftClose,
  PanelRightClose,
  MessageSquare,
  Sparkles,
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
      title: "Add Source...",
      desc: "Link PDF, URL, or raw text to notebook",
      icon: Plus,
      action: () => onOpenAddSource(),
    },
    {
      id: "create_note",
      title: "Create Note",
      desc: "Write a new notebook note",
      icon: StickyNote,
      action: () => onOpenCreateNote(),
    },
    {
      id: "focus_chat",
      title: "Focus Chat Composer",
      desc: "Jump straight to the inquiry prompt",
      icon: MessageSquare,
      action: () => onFocusChat(),
    },
    {
      id: "tool_audio",
      title: "Studio: Audio Overview",
      desc: "Generate two-host deep dive conversation",
      icon: Headphones,
      action: () => onOpenTool("audio"),
    },
    {
      id: "tool_quiz",
      title: "Studio: Interactive Quiz",
      desc: "Generate knowledge check questions",
      icon: HelpCircle,
      action: () => onOpenTool("quiz"),
    },
    {
      id: "tool_mindmap",
      title: "Studio: Mind Map",
      desc: "Generate hierarchical visual concepts",
      icon: GitFork,
      action: () => onOpenTool("mindmap"),
    },
    {
      id: "tool_flashcards",
      title: "Studio: Flashcards",
      desc: "Generate study cards for memorization",
      icon: Layers,
      action: () => onOpenTool("flashcards"),
    },
    {
      id: "toggle_sources",
      title: "Toggle Sources Panel",
      desc: "Collapse or expand left panel rail",
      icon: PanelLeftClose,
      action: () => onToggleLeftPanel(),
    },
    {
      id: "toggle_studio",
      title: "Toggle Studio Panel",
      desc: "Collapse or expand right panel rail",
      icon: PanelRightClose,
      action: () => onToggleRightPanel(),
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.desc.toLowerCase().includes(search.toLowerCase())
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
          // Open handled by parent
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-24 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border-subtle)] bg-[var(--panel)] shadow-2xl overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--panel-raised)]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search actions..."
            autoFocus
            className="w-full bg-transparent border-0 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          <kbd className="px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--panel)] text-[10px] text-[var(--text-muted)] font-mono">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
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
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-colors ${
                    isSelected
                      ? "bg-[var(--accent-blue)] text-white"
                      : "text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-xl border ${
                        isSelected
                          ? "bg-white/20 border-white/30 text-white"
                          : "bg-[var(--panel)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{cmd.title}</p>
                      <p
                        className={`text-[10px] truncate ${
                          isSelected ? "text-blue-100" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {cmd.desc}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              No matching commands found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
