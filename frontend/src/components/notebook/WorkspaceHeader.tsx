"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Share2,
  Sparkles,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Check,
  Edit2,
  LogOut,
  Settings,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { apiClient } from "@/lib/api-client";
import { ShortcutsModal } from "./ShortcutsModal";

export interface WorkspaceHeaderProps {
  title: string;
  modelLabel?: string;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onOpenCommandPalette: () => void;
  onSaveTitle: (newTitle: string) => Promise<void>;
  onOpenAddSource: () => void;
  onOpenGeminiKey?: () => void;
}

export function WorkspaceHeader({
  title,
  modelLabel = "Gemini AI",
  isLeftPanelOpen,
  isRightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
  onOpenCommandPalette,
  onSaveTitle,
  onOpenAddSource,
  onOpenGeminiKey,
}: WorkspaceHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [copiedShare, setCopiedShare] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    setHasGeminiKey(Boolean(apiClient.getGeminiApiKey()));
    const interval = setInterval(() => {
      setHasGeminiKey(Boolean(apiClient.getGeminiApiKey()));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const router = useRouter();
  const { user, logout } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  // Sync title when prop changes
  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  const handleTitleSubmit = async () => {
    setIsEditing(false);
    if (tempTitle.trim() && tempTitle !== title) {
      await onSaveTitle(tempTitle.trim());
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <>
      <header className="h-12 w-full flex items-center justify-between px-3 z-20 shrink-0 bg-surface border-b border-hairline select-none shadow-xs">
        {/* Left: Brand + Back Navigation + Notebook Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/notebooks"
            prefetch={false}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors duration-150"
            title="Back to Notebooks Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Brand Mark */}
          <Link href="/" prefetch={false} className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity">
            <BrandLogo variant="compact" size="xs" textClassName="text-ui font-semibold tracking-tight text-ink" />
          </Link>

          <div className="h-4 w-[1px] bg-border-hairline mx-1" />

          {/* Editable Notebook Title */}
          <div className="flex items-center gap-1.5 min-w-0 max-w-[220px] sm:max-w-[340px] lg:max-w-[420px]">
            {isEditing ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSubmit();
                  if (e.key === "Escape") {
                    setTempTitle(title);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                className="px-2 py-0.5 rounded-lg text-ui font-semibold bg-surface-subtle border border-border-strong text-ink outline-none ring-1 ring-gold w-full shadow-xs"
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="group flex items-center gap-1.5 text-left truncate hover:bg-surface-subtle px-2 py-1 rounded-lg transition-colors duration-150 border border-transparent hover:border-hairline"
                title="Click to rename notebook"
              >
                <span className="text-ui font-semibold truncate text-ink">
                  {title || "Untitled Notebook"}
                </span>
                <Edit2 className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" />
              </button>
            )}
          </div>

          {/* Model Status Indicator */}
          <button
            onClick={onOpenGeminiKey}
            type="button"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-hairline bg-surface-subtle hover:bg-surface text-caption font-medium text-ink-secondary transition-colors duration-150 cursor-pointer shadow-xs"
            title="Active Model Status (Click to configure key)"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-verdigris shrink-0" />
            <span>Gemini 2.5 Flash</span>
            {hasGeminiKey ? (
              <span className="text-micro text-gold font-mono uppercase bg-amber-500/10 px-1 rounded">
                BYOK
              </span>
            ) : (
              <span className="text-micro text-ink-muted font-mono">
                Live
              </span>
            )}
          </button>
        </div>

        {/* Right: Actions & Panel Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Keyboard Shortcuts Trigger (?) */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-secondary hover:text-ink hover:bg-surface-subtle border border-hairline transition-colors duration-150"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Command Palette Trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-medium text-ink-secondary hover:text-ink hover:bg-surface-subtle border border-hairline transition-colors duration-150"
            title="Command Palette (Cmd/Ctrl + K)"
          >
            <Command className="w-3 h-3" />
            <span className="font-mono">Cmd K</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-ui font-medium text-ink hover:bg-surface-subtle transition-colors duration-150 border border-hairline shadow-xs"
            title="Copy link to notebook"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5 text-verdigris" />
                <span className="text-verdigris text-caption font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-ink-secondary" />
                <span className="hidden sm:inline text-caption">Share</span>
              </>
            )}
          </button>

          <div className="h-4 w-[1px] bg-border-hairline mx-1 hidden sm:block" />

          {/* Left Panel Toggle (Ctrl/Cmd + B) */}
          <button
            onClick={onToggleLeftPanel}
            className={`h-8 w-8 rounded-lg hidden md:flex items-center justify-center transition-colors duration-150 border border-hairline ${
              isLeftPanelOpen
                ? "text-ink bg-surface-subtle"
                : "text-ink-muted hover:text-ink hover:bg-surface-subtle"
            }`}
            title={isLeftPanelOpen ? "Collapse Sources (Cmd+B)" : "Expand Sources (Cmd+B)"}
          >
            {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Right Panel Toggle (Ctrl/Cmd + J) */}
          <button
            onClick={onToggleRightPanel}
            className={`h-8 w-8 rounded-lg hidden md:flex items-center justify-center transition-colors duration-150 border border-hairline ${
              isRightPanelOpen
                ? "text-ink bg-surface-subtle"
                : "text-ink-muted hover:text-ink hover:bg-surface-subtle"
            }`}
            title={isRightPanelOpen ? "Collapse Studio (Cmd+J)" : "Expand Studio (Cmd+J)"}
          >
            {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          {/* User Account Menu */}
          <div className="relative ml-1" ref={accountRef}>
            <button
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="w-8 h-8 rounded-full bg-ink text-canvas flex items-center justify-center font-sans font-medium text-caption shadow-xs hover:ring-2 hover:ring-gold/50 transition-all duration-150 cursor-pointer"
              title={user?.email || "Account Menu"}
            >
              {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
            </button>

            {isAccountOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface border border-hairline shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-ink">
                <div className="px-3 py-2 border-b border-hairline mb-1">
                  <p className="text-ui font-semibold text-ink truncate">
                    {user?.full_name || "User Account"}
                  </p>
                  <p className="text-caption text-ink-muted truncate">{user?.email || "Authenticated"}</p>
                  {user?.workspaces?.[0]?.name && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-micro text-ink-secondary bg-surface-subtle border border-hairline">
                      {user.workspaces[0].name}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <Link
                    href="/notebooks"
                    prefetch={false}
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-ui font-medium text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors duration-150"
                  >
                    <BookOpen className="w-4 h-4 text-ink-muted" />
                    <span>All Notebooks</span>
                  </Link>

                  <Link
                    href="/settings"
                    prefetch={false}
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-ui font-medium text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors duration-150"
                  >
                    <Settings className="w-4 h-4 text-ink-muted" />
                    <span>Account Settings</span>
                  </Link>

                  {onOpenGeminiKey && (
                    <button
                      onClick={() => {
                        setIsAccountOpen(false);
                        onOpenGeminiKey();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-ui font-medium text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors duration-150 text-left cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-ink-muted" />
                      <span>Gemini API Key</span>
                    </button>
                  )}
                </div>

                <div className="pt-1 mt-1 border-t border-hairline">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-ui font-medium text-destructive hover:bg-destructive-subtle transition-colors duration-150 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Keyboard Shortcuts Overlay Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}
