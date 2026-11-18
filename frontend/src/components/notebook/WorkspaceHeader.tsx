"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Share2,
  Moon,
  Sun,
  SlidersHorizontal,
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
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { apiClient } from "@/lib/api-client";

interface WorkspaceHeaderProps {
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
    <header className="h-12 w-full flex items-center justify-between px-3 z-20 shrink-0 bg-white border-b border-black/[0.08] select-none shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left: Brand + Back + Notebook Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          href="/notebooks"
          prefetch={false}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          title="Back to Notebooks"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Brand Mark */}
        <Link href="/" prefetch={false} className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity">
          <BrandLogo variant="compact" size="xs" textClassName="text-xs font-semibold tracking-tight text-neutral-900" />
        </Link>

        <div className="h-4 w-[1px] bg-black/[0.08] mx-1" />

        {/* Editable Title */}
        <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[360px] lg:max-w-[440px]">
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
              className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold bg-neutral-50 border border-neutral-300 text-neutral-900 outline-none ring-1 ring-amber-500/50 w-full shadow-xs"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="group flex items-center gap-2 text-left truncate hover:bg-neutral-100 px-2.5 py-1 rounded-lg transition-colors border border-transparent hover:border-black/[0.06]"
              title="Click to rename"
            >
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-700">
                <BookOpen className="w-3 h-3" />
              </div>
              <span className="text-xs sm:text-sm font-semibold truncate text-neutral-900">
                {title || "Untitled Notebook"}
              </span>
              <Edit2 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Model Badge */}
        <button
          onClick={onOpenGeminiKey}
          type="button"
          className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.08] bg-neutral-50 hover:bg-neutral-100 text-[11px] font-medium text-neutral-700 transition-all cursor-pointer group shadow-xs"
          title="Google Gemini AI Active (Click to manage key)"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shadow-[0_0_6px_rgba(5,150,105,0.6)] shrink-0" />
          <span>Gemini 2.5 Flash</span>
          {hasGeminiKey ? (
            <span className="text-[10px] text-amber-700 font-mono bg-amber-500/10 px-1 rounded">BYOK</span>
          ) : (
            <span className="text-[10px] text-neutral-500 font-mono">Live</span>
          )}
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-black/[0.08] transition-colors"
          title="Command Palette (Cmd/Ctrl + K)"
        >
          <Command className="w-3 h-3" />
          <span>Cmd K</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors border border-black/[0.08]"
          title="Copy Link to Notebook"
        >
          {copiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>

        <div className="h-4 w-[1px] bg-black/[0.08] mx-1" />

        {/* Left Panel Toggle */}
        <button
          onClick={onToggleLeftPanel}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
            isLeftPanelOpen
              ? "text-neutral-900 bg-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
          title={isLeftPanelOpen ? "Collapse Sources" : "Expand Sources"}
        >
          {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Right Panel Toggle */}
        <button
          onClick={onToggleRightPanel}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
            isRightPanelOpen
              ? "text-neutral-900 bg-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
          title={isRightPanelOpen ? "Collapse Studio" : "Expand Studio"}
        >
          {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>

        {/* User Account Menu */}
        <div className="relative ml-1" ref={accountRef}>
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-medium text-xs shadow-xs hover:ring-2 hover:ring-neutral-400/40 transition-all cursor-pointer"
            title={user?.email || "Account Menu"}
          >
            {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
          </button>

          {isAccountOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-black/[0.08] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-neutral-800">
              <div className="px-3 py-2.5 border-b border-black/[0.06] mb-1">
                <p className="text-xs font-semibold text-neutral-900 truncate">
                  {user?.full_name || "User Account"}
                </p>
                <p className="text-[11px] text-neutral-500 truncate">{user?.email || "Authenticated"}</p>
                {user?.workspaces?.[0]?.name && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-neutral-100 text-[10px] text-neutral-700 font-medium border border-black/[0.06]">
                    {user.workspaces[0].name}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/notebooks"
                  prefetch={false}
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <span>All Notebooks</span>
                </Link>

                <Link
                  href="/settings"
                  prefetch={false}
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  <Settings className="w-4 h-4 text-neutral-500" />
                  <span>Account Settings</span>
                </Link>

                {onOpenGeminiKey && (
                  <button
                    onClick={() => {
                      setIsAccountOpen(false);
                      onOpenGeminiKey();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Gemini AI Key</span>
                  </button>
                )}
              </div>

              <div className="pt-1 mt-1 border-t border-black/[0.06]">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
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
  );
}
