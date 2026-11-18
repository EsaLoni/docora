"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface WorkspaceShellProps {
  header: React.ReactNode;
  sourcesPanel: React.ReactNode;
  chatPanel: React.ReactNode;
  studioPanel: React.ReactNode;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  setIsLeftPanelOpen: (open: boolean) => void;
  setIsRightPanelOpen: (open: boolean) => void;
  sourcesCount: number;
  artifactsCount: number;
}

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
  const [leftWidth, setLeftWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(380);

  // Load persisted widths
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem("udip-left-panel-width");
      const savedRight = localStorage.getItem("udip-right-panel-width");
      if (savedLeft) setLeftWidth(Math.max(280, Math.min(550, parseInt(savedLeft))));
      if (savedRight) setRightWidth(Math.max(300, Math.min(550, parseInt(savedRight))));
    } catch {}
  }, []);

  // Resizing logic for Left Panel
  const isResizingLeft = useRef(false);
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingLeft.current) return;
      const newWidth = Math.max(280, Math.min(550, moveEvent.clientX));
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingLeft.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem("udip-left-panel-width", leftWidth.toString());
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Resizing logic for Right Panel
  const isResizingRight = useRef(false);
  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRight.current) return;
      const newWidth = Math.max(300, Math.min(550, window.innerWidth - moveEvent.clientX));
      setRightWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingRight.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem("udip-right-panel-width", rightWidth.toString());
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleResetLeftWidth = () => {
    setLeftWidth(360);
    localStorage.setItem("udip-left-panel-width", "360");
  };

  const handleResetRightWidth = () => {
    setRightWidth(380);
    localStorage.setItem("udip-right-panel-width", "380");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--canvas)] overflow-hidden font-sans select-none text-[var(--text-primary)]">
      {/* Header */}
      {header}

      {/* Main Floating Workspace Canvas */}
      <main className="flex-1 w-full px-3 pb-3 pt-0 flex gap-3 min-h-0 overflow-hidden relative">
        {/* DESKTOP / TABLET THREE-PANEL LAYOUT */}
        <div className="hidden md:flex w-full h-full gap-3 min-h-0 overflow-hidden">
          {/* LEFT: SOURCES PANEL */}
          {isLeftPanelOpen ? (
            <section
              style={{ width: `${leftWidth}px` }}
              className="h-full shrink-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col transition-all duration-200"
            >
              {sourcesPanel}
            </section>
          ) : (
            <aside
              onClick={() => setIsLeftPanelOpen(true)}
              className="h-full w-12 shrink-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-neutral-50 cursor-pointer flex flex-col items-center py-4 transition-colors group"
              title="Expand Sources"
            >
              <div className="p-2 rounded-xl text-neutral-500 group-hover:text-amber-600">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="mt-4 flex-1 flex items-center justify-center">
                <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-semibold tracking-wider text-neutral-500 group-hover:text-neutral-800 uppercase">
                  Sources ({sourcesCount})
                </span>
              </div>
              <BookOpen className="w-4 h-4 text-neutral-400" />
            </aside>
          )}

          {/* Left Resize Divider */}
          {isLeftPanelOpen && (
            <div
              onMouseDown={handleLeftResizeStart}
              onDoubleClick={handleResetLeftWidth}
              className="w-1.5 h-full cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500 transition-colors rounded-full shrink-0 flex items-center justify-center group"
              title="Drag to resize, double-click to reset"
            >
              <div className="w-0.5 h-8 bg-black/[0.12] rounded-full group-hover:bg-amber-600" />
            </div>
          )}

          {/* CENTER: CHAT PANEL */}
          <section className="flex-1 h-full min-w-[320px] rounded-2xl border border-black/[0.08] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col relative">
            {chatPanel}
          </section>

          {/* Right Resize Divider */}
          {isRightPanelOpen && (
            <div
              onMouseDown={handleRightResizeStart}
              onDoubleClick={handleResetRightWidth}
              className="w-1.5 h-full cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500 transition-colors rounded-full shrink-0 flex items-center justify-center group"
              title="Drag to resize, double-click to reset"
            >
              <div className="w-0.5 h-8 bg-black/[0.12] rounded-full group-hover:bg-amber-600" />
            </div>
          )}

          {/* RIGHT: STUDIO PANEL */}
          {isRightPanelOpen ? (
            <section
              style={{ width: `${rightWidth}px` }}
              className="h-full shrink-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col transition-all duration-200"
            >
              {studioPanel}
            </section>
          ) : (
            <aside
              onClick={() => setIsRightPanelOpen(true)}
              className="h-full w-12 shrink-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-neutral-50 cursor-pointer flex flex-col items-center py-4 transition-colors group"
              title="Expand Studio"
            >
              <div className="p-2 rounded-xl text-neutral-500 group-hover:text-amber-600">
                <ChevronLeft className="w-4 h-4" />
              </div>
              <div className="mt-4 flex-1 flex items-center justify-center">
                <span className="[writing-mode:vertical-lr] text-xs font-semibold tracking-wider text-neutral-500 group-hover:text-neutral-800 uppercase">
                  Studio ({artifactsCount})
                </span>
              </div>
              <Sparkles className="w-4 h-4 text-[var(--text-muted)]" />
            </aside>
          )}
        </div>

        {/* MOBILE VIEW (Single Active Panel) */}
        <div className="flex md:hidden w-full h-full flex-col min-h-0">
          <div className="flex-1 rounded-3xl border border-[var(--border-subtle)] bg-[var(--panel)] shadow-sm overflow-hidden flex flex-col">
            {mobileTab === "sources" && sourcesPanel}
            {mobileTab === "chat" && chatPanel}
            {mobileTab === "studio" && studioPanel}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="h-14 mt-2 px-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel)] flex items-center justify-around shrink-0">
            <button
              onClick={() => setMobileTab("sources")}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                mobileTab === "sources"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Sources ({sourcesCount})</span>
            </button>

            <button
              onClick={() => setMobileTab("chat")}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                mobileTab === "chat"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setMobileTab("studio")}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                mobileTab === "studio"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Studio ({artifactsCount})</span>
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}
