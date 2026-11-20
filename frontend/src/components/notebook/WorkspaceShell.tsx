"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { ShortcutsModal } from "./ShortcutsModal";

export interface WorkspaceShellProps {
  header: React.ReactNode;
  sourcesPanel: React.ReactNode;
  chatPanel: React.ReactNode;
  studioPanel: React.ReactNode;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  setIsLeftPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsRightPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  sourcesCount: number;
  artifactsCount: number;
}

const DEFAULT_LEFT_WIDTH = 340;
const DEFAULT_RIGHT_WIDTH = 360;

export function WorkspaceShell({
  header,
  sourcesPanel,
  chatPanel,
  studioPanel,
  isLeftPanelOpen,
  isRightPanelOpen,
  setIsLeftPanelOpen,
  setIsRightPanelOpen,
  sourcesCount,
  artifactsCount,
}: WorkspaceShellProps) {
  // Mobile active tab: "sources" | "chat" | "studio"
  const [mobileTab, setMobileTab] = useState<"sources" | "chat" | "studio">("chat");

  // Panel widths
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Load persisted widths from localStorage
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem("docora-left-panel-width");
      const savedRight = localStorage.getItem("docora-right-panel-width");
      if (savedLeft) setLeftWidth(Math.max(260, Math.min(480, parseInt(savedLeft))));
      if (savedRight) setRightWidth(Math.max(280, Math.min(500, parseInt(savedRight))));
    } catch {}
  }, []);

  // Keyboard shortcuts: Cmd+B (sources), Cmd+J (studio), ? (shortcuts overlay)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Cmd+B / Ctrl+B: Toggle sources panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsLeftPanelOpen((prev: boolean) => !prev);
        return;
      }

      // Cmd+J / Ctrl+J: Toggle studio panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsRightPanelOpen((prev: boolean) => !prev);
        return;
      }

      // ?: Open shortcuts overlay (when not in an input)
      if (e.key === "?" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }
    },
    [setIsLeftPanelOpen, setIsRightPanelOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Resizing logic for Left Panel (rAF throttled for 60/120fps fluidity)
  const isResizingLeft = useRef(false);
  const latestLeftWidthRef = useRef(leftWidth);
  latestLeftWidthRef.current = leftWidth;

  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let rafId: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingLeft.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const newWidth = Math.max(260, Math.min(480, moveEvent.clientX));
        latestLeftWidthRef.current = newWidth;
        setLeftWidth(newWidth);
      });
    };

    const onMouseUp = () => {
      isResizingLeft.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem("docora-left-panel-width", latestLeftWidthRef.current.toString());
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Resizing logic for Right Panel (rAF throttled)
  const isResizingRight = useRef(false);
  const latestRightWidthRef = useRef(rightWidth);
  latestRightWidthRef.current = rightWidth;

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let rafId: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRight.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const newWidth = Math.max(280, Math.min(500, window.innerWidth - moveEvent.clientX));
        latestRightWidthRef.current = newWidth;
        setRightWidth(newWidth);
      });
    };

    const onMouseUp = () => {
      isResizingRight.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem("docora-right-panel-width", latestRightWidthRef.current.toString());
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleResetLeftWidth = () => {
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    localStorage.setItem("docora-left-panel-width", DEFAULT_LEFT_WIDTH.toString());
  };

  const handleResetRightWidth = () => {
    setRightWidth(DEFAULT_RIGHT_WIDTH);
    localStorage.setItem("docora-right-panel-width", DEFAULT_RIGHT_WIDTH.toString());
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans select-none">
      {/* Header Bar */}
      {header}

      {/* Main Workspace 3-Panel Canvas */}
      <main className="flex-1 w-full p-2.5 pt-0 flex gap-2.5 min-h-0 overflow-hidden relative">
        {/* DESKTOP / TABLET THREE-PANEL LAYOUT (>= 768px) */}
        <div className="hidden md:flex w-full h-full gap-2.5 min-h-0 overflow-hidden">
          {/* LEFT: SOURCES & NOTES PANEL */}
          {isLeftPanelOpen ? (
            <section
              style={{ width: `${leftWidth}px` }}
              className="h-full shrink-0 rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col transition-all duration-150"
            >
              {sourcesPanel}
            </section>
          ) : (
            <aside
              onClick={() => setIsLeftPanelOpen(true)}
              className="h-full w-12 shrink-0 rounded-xl border border-hairline bg-surface shadow-xs hover:bg-surface-subtle cursor-pointer flex flex-col items-center py-4 transition-colors duration-150 group select-none"
              title="Expand Sources (⌘/Ctrl + B)"
            >
              <div className="p-1 rounded text-ink-muted group-hover:text-ink transition-colors duration-150">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="mt-4 flex-1 flex items-center justify-center">
                <span className="[writing-mode:vertical-lr] rotate-180 text-micro uppercase tracking-wider text-ink-muted group-hover:text-ink font-medium">
                  Sources ({sourcesCount})
                </span>
              </div>
              <BookOpen className="w-4 h-4 text-ink-muted" />
            </aside>
          )}

          {/* Left Resize Divider */}
          {isLeftPanelOpen && (
            <div
              onMouseDown={handleLeftResizeStart}
              onDoubleClick={handleResetLeftWidth}
              className="w-1.5 h-full cursor-col-resize hover:bg-border-strong active:bg-gold transition-colors duration-150 rounded-full shrink-0 flex items-center justify-center group"
              title="Drag to resize, double-click to reset width"
            >
              <div className="w-0.5 h-8 bg-border-hairline rounded-full group-hover:bg-ink-muted" />
            </div>
          )}

          {/* CENTER: READING & SYNTHESIS CANVAS (PRIMARY FOCAL POINT) */}
          <section className="flex-1 h-full min-w-[320px] rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col relative transition-all duration-150">
            {chatPanel}
          </section>

          {/* Right Resize Divider */}
          {isRightPanelOpen && (
            <div
              onMouseDown={handleRightResizeStart}
              onDoubleClick={handleResetRightWidth}
              className="w-1.5 h-full cursor-col-resize hover:bg-border-strong active:bg-gold transition-colors duration-150 rounded-full shrink-0 flex items-center justify-center group"
              title="Drag to resize, double-click to reset width"
            >
              <div className="w-0.5 h-8 bg-border-hairline rounded-full group-hover:bg-ink-muted" />
            </div>
          )}

          {/* RIGHT: STUDIO WORKSHOP SHELF */}
          {isRightPanelOpen ? (
            <section
              style={{ width: `${rightWidth}px` }}
              className="h-full shrink-0 rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col transition-all duration-150"
            >
              {studioPanel}
            </section>
          ) : (
            <aside
              onClick={() => setIsRightPanelOpen(true)}
              className="h-full w-12 shrink-0 rounded-xl border border-hairline bg-surface shadow-xs hover:bg-surface-subtle cursor-pointer flex flex-col items-center py-4 transition-colors duration-150 group select-none"
              title="Expand Studio (⌘/Ctrl + J)"
            >
              <div className="p-1 rounded text-ink-muted group-hover:text-ink transition-colors duration-150">
                <ChevronLeft className="w-4 h-4" />
              </div>
              <div className="mt-4 flex-1 flex items-center justify-center">
                <span className="[writing-mode:vertical-lr] text-micro uppercase tracking-wider text-ink-muted group-hover:text-ink font-medium">
                  Studio ({artifactsCount})
                </span>
              </div>
              <Sparkles className="w-4 h-4 text-ink-muted" />
            </aside>
          )}
        </div>

        {/* MOBILE VIEW (< 768px): Single Active Panel with Bottom Tabs */}
        <div className="flex md:hidden w-full h-full flex-col min-h-0">
          <div className="flex-1 rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col min-h-0">
            {mobileTab === "sources" && sourcesPanel}
            {mobileTab === "chat" && chatPanel}
            {mobileTab === "studio" && studioPanel}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="h-13 mt-2 px-4 rounded-xl border border-hairline bg-surface flex items-center justify-around shrink-0 shadow-xs">
            <button
              onClick={() => setMobileTab("sources")}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-caption font-medium transition-colors duration-150 cursor-pointer ${
                mobileTab === "sources"
                  ? "text-verdigris font-semibold"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Sources ({sourcesCount})</span>
            </button>

            <button
              onClick={() => setMobileTab("chat")}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-caption font-medium transition-colors duration-150 cursor-pointer ${
                mobileTab === "chat"
                  ? "text-verdigris font-semibold"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setMobileTab("studio")}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-caption font-medium transition-colors duration-150 cursor-pointer ${
                mobileTab === "studio"
                  ? "text-verdigris font-semibold"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Studio ({artifactsCount})</span>
            </button>
          </nav>
        </div>
      </main>

      {/* Global Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
