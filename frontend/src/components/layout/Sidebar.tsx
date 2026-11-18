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
    <div className="flex flex-col justify-between h-full bg-[#F8F9FA] border-r border-black/[0.08] text-neutral-900">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-black/[0.08]">
          <Link href="/" prefetch={false} className="flex items-center min-w-0 no-underline hover:opacity-95 transition-opacity">
            <BrandLogo
              variant="full"
              size="sm"
              showTagline
              tagline="Document Intelligence"
              textClassName="text-sm font-semibold text-neutral-900 tracking-tight"
            />
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Active Workspace Indicator */}
        <div className="px-3 pt-3 pb-2">
          <div className="px-3 py-2 rounded-xl bg-white border border-black/[0.08] flex items-center justify-between text-xs text-neutral-600 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" title="Active Workspace" />
              <span className="text-xs font-medium truncate text-neutral-800">
                {user?.workspaces?.[0]?.name || "Personal Workspace"}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">LIVE</span>
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all",
                  isActive
                    ? "bg-neutral-900 text-white font-semibold shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-400" : "text-neutral-500")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Settings & Account Management */}
      <div className="p-3 border-t border-black/[0.08] space-y-2 bg-[#F8F9FA]">
        <Link
          href="/settings"
          prefetch={false}
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
            pathname === "/settings"
              ? "bg-neutral-900 text-white font-semibold"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 text-neutral-500" />
          <span>Settings & Isolation</span>
        </Link>

        {/* Account Profile Card */}
        <div className="relative pt-1">
          <button
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full p-2 rounded-xl bg-white border border-black/[0.08] hover:border-black/[0.16] hover:bg-neutral-50 transition-all flex items-center justify-between text-left group shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(user?.full_name, user?.email)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-neutral-900 truncate">
                  {user?.full_name || "Research Scientist"}
                </span>
                <span className="text-[11px] text-neutral-500 truncate">
                  {user?.email || "user@docora.internal"}
                </span>
              </div>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 text-neutral-400 transition-transform",
                showAccountMenu ? "rotate-180" : ""
              )}
            />
          </button>

          {/* Account Popover Menu */}
          {showAccountMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white border border-black/[0.08] rounded-xl shadow-xl z-30 space-y-1 animate-in fade-in duration-100">
              <div className="px-2.5 py-1.5 text-[11px] text-neutral-500 border-b border-black/[0.06] flex items-center justify-between">
                <span>Account Status</span>
                <span className="text-emerald-600 font-semibold">Verified Active</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Isolation Tag */}
        <div className="px-2 pt-1 flex items-center justify-center gap-1.5 text-[10px] text-neutral-500">
          <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
          <span>Tenant Isolated & Encrypted</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/[0.08] bg-[#0C0E15] shrink-0 h-screen sticky top-0 select-none z-20">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-[#0C0E15] border-r border-white/[0.08] shadow-2xl select-none z-50 animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
