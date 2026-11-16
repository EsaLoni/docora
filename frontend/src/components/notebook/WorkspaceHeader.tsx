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
  User as UserIcon,
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
  modelLabel = "Gemini 3 Flash",
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
  const [isDark, setIsDark] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  useEffect(() => {
    setHasGeminiKey(Boolean(apiClient.getGeminiApiKey()));
    const interval = setInterval(() => {
      setHasGeminiKey(Boolean(apiClient.getGeminiApiKey()));
    }, 1500);
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
  React.useEffect(() => {
    setTempTitle(title);
  }, [title]);

  // Initial theme check
  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("docora-theme", "dark");
      localStorage.setItem("udip-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("docora-theme", "light");
      localStorage.setItem("udip-theme", "light");
    }
  };

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
    <header className="h-14 w-full flex items-center justify-between px-4 z-20 shrink-0 bg-transparent select-none">
      {/* Left: Brand + Back + Notebook Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/notebooks"
          className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)] transition-colors"
          title="Back to Notebooks"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Brand Mark */}
        <Link href="/" className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity">
          <BrandLogo variant="compact" size="xs" textClassName="text-sm font-semibold" />
        </Link>

        <div className="h-4 w-[1px] bg-[var(--border-subtle)] mx-1" />

        {/* Editable Title */}
        <div className="flex items-center gap-2 min-w-0 max-w-[320px] lg:max-w-[420px]">
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
              className="px-2 py-0.5 rounded-lg text-sm font-medium bg-[var(--panel-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent-blue)] w-full"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="group flex items-center gap-2 text-left truncate hover:bg-[var(--tile-hover)] px-2 py-1 rounded-lg transition-colors"
              title="Click to rename"
            >
              <span className="text-sm font-semibold truncate text-[var(--text-primary)]">
                {title || "Untitled Notebook"}
              </span>
              <Edit2 className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Model Badge / Key Configuration */}
        <button
          onClick={onOpenGeminiKey}
          type="button"
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer group shadow-xs ${
            hasGeminiKey
              ? "bg-[var(--panel-raised)] border-emerald-500/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              : "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
          }`}
          title={hasGeminiKey ? "Gemini 3.8 Flash Connected (Click to configure)" : "Click to connect your free Google Gemini API Key"}
        >
          <Sparkles className={`w-3.5 h-3.5 ${hasGeminiKey ? "text-[var(--accent-blue)]" : "text-amber-400"} group-hover:scale-110 transition-transform`} />
          <span>{modelLabel}</span>
          {hasGeminiKey ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
              Connected
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-black font-semibold animate-pulse">
              Connect Key
            </span>
          )}
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)] border border-[var(--border-subtle)] transition-colors"
          title="Command Palette (Cmd/Ctrl + K)"
        >
          <Command className="w-3 h-3" />
          <span>Cmd K</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)] transition-colors border border-[var(--border-subtle)]"
          title="Copy Link to Notebook"
        >
          {copiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)] transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-subtle)] mx-1" />

        {/* Left Panel Toggle */}
        <button
          onClick={onToggleLeftPanel}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
            isLeftPanelOpen
              ? "text-[var(--text-primary)] bg-[var(--tile-hover)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
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
              ? "text-[var(--text-primary)] bg-[var(--tile-hover)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
          }`}
          title={isRightPanelOpen ? "Collapse Studio" : "Expand Studio"}
        >
          {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>

        {/* User Account Menu */}
        <div className="relative ml-1" ref={accountRef}>
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3156D8] to-[#8AB4F8] text-white flex items-center justify-center font-medium text-xs shadow-sm hover:ring-2 hover:ring-[#8AB4F8]/50 transition-all cursor-pointer"
            title={user?.email || "Account Menu"}
          >
            {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
          </button>

          {isAccountOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#1F1F1F] border border-[#303030] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2.5 border-b border-[#2A2A2A] mb-1">
                <p className="text-sm font-semibold text-[#F1F3F4] truncate">
                  {user?.full_name || "User Account"}
                </p>
                <p className="text-xs text-[#9299A4] truncate">{user?.email || "Authenticated"}</p>
                {user?.workspaces?.[0]?.name && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-[#282828] text-[10px] text-[#8AB4F8] font-medium border border-[#3A3A3A]">
                    {user.workspaces[0].name}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/notebooks"
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#B8BDC7] hover:text-[#F1F3F4] hover:bg-[#282828] transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-[#8AB4F8]" />
                  <span>All Notebooks</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#B8BDC7] hover:text-[#F1F3F4] hover:bg-[#282828] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#9299A4]" />
                  <span>Account Settings</span>
                </Link>

                {onOpenGeminiKey && (
                  <button
                    onClick={() => {
                      setIsAccountOpen(false);
                      onOpenGeminiKey();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#B8BDC7] hover:text-[#F1F3F4] hover:bg-[#282828] transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4 text-[#8AB4F8]" />
                    <span>Gemini AI Key</span>
                  </button>
                )}
              </div>

              <div className="pt-1 mt-1 border-t border-[#2A2A2A]">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
