"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookMarked,
  FolderOpen,
  Sparkles,
  CheckSquare,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo } from "@/components/brand/BrandLogo";

const mainNavItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "My Notebooks", href: "/notebooks", icon: BookMarked },
  { name: "My Documents", href: "/documents", icon: FolderOpen },
  { name: "AI Insights", href: "/insights", icon: Sparkles },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const handleSignOut = () => {
    logout();
    if (onCloseMobile) onCloseMobile();
    router.push("/login");
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "DC";
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full bg-surface border-r border-border-hairline text-ink font-sans">
      <div>
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border-hairline">
          <Link href="/" prefetch={false} className="flex items-center min-w-0 no-underline hover:opacity-90 transition-opacity">
            <BrandLogo
              variant="full"
              size="sm"
              showTagline
              tagline="Document Intelligence"
              textClassName="font-serif text-title font-medium text-ink tracking-tight"
            />
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-subtle md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Active Workspace Indicator */}
        <div className="px-3 pt-3 pb-2">
          <div className="px-3 py-1.5 rounded-md bg-surface-subtle border border-border-hairline flex items-center justify-between text-caption text-ink-secondary">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-verdigris shrink-0" title="Active Workspace" />
              <span className="text-caption font-medium truncate text-ink">
                {user?.workspaces?.[0]?.name || "Personal Workspace"}
              </span>
            </div>
            <span className="text-micro uppercase font-mono text-ink-muted">SYNCED</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="px-3 py-1 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/") ||
                  (item.href === "/insights" && pathname.startsWith("/intelligence"));

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-ui font-medium transition-colors",
                  isActive
                    ? "bg-surface-subtle text-ink font-semibold border border-border-hairline"
                    : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-gold" : "text-ink-muted")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Settings & Account Management */}
      <div className="p-3 border-t border-border-hairline space-y-2 bg-surface">
        <Link
          href="/settings"
          prefetch={false}
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-ui font-medium transition-colors",
            pathname === "/settings"
              ? "bg-surface-subtle text-ink font-semibold border border-border-hairline"
              : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 text-ink-muted" />
          <span>Settings</span>
        </Link>

        {/* Account Profile Card */}
        <div className="relative pt-1">
          <button
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full p-2 rounded-md bg-surface border border-border-hairline hover:bg-surface-subtle transition-colors flex items-center justify-between text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-md bg-surface-subtle border border-border-hairline text-ink flex items-center justify-center font-mono font-bold text-micro shrink-0">
                {getInitials(user?.full_name, user?.email)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-caption font-medium text-ink truncate">
                  {user?.full_name || "Researcher"}
                </span>
                <span className="text-micro font-mono text-ink-muted truncate">
                  {user?.email || "user@docora.internal"}
                </span>
              </div>
            </div>
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 text-ink-muted transition-transform",
                showAccountMenu ? "rotate-180" : ""
              )}
            />
          </button>

          {/* Account Popover Menu */}
          {showAccountMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-surface border border-border-hairline rounded-md shadow-lg z-30 space-y-1 animate-in fade-in duration-100">
              <div className="px-2.5 py-1 text-micro font-mono text-ink-muted border-b border-border-hairline flex items-center justify-between">
                <span>Account Status</span>
                <span className="text-verdigris">Active</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-caption font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Isolation Tag */}
        <div className="px-2 pt-1 flex items-center justify-center gap-1.5 text-micro font-mono text-ink-muted">
          <ShieldCheck className="h-3 w-3 text-verdigris shrink-0" />
          <span>Isolated & Encrypted</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border-hairline bg-surface shrink-0 h-screen sticky top-0 select-none z-20">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col w-64 max-w-[85vw] h-full bg-surface border-r border-border-hairline shadow-xl select-none z-50 animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
