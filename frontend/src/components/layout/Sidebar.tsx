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
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#273247]">
          <Link href="/" className="flex items-center min-w-0 no-underline hover:opacity-95 transition-opacity">
            <BrandLogo
              variant="full"
              size="sm"
              showTagline
              tagline="AI Research Workspace"
              textClassName="text-[15px] text-[#F1F5FC]"
            />
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Active Workspace Indicator */}
        <div className="px-3 pt-3 pb-2">
          <div className="px-3 py-2 rounded-xl bg-[#151B27] border border-[#273247] flex items-center justify-between text-xs text-[#A0AEC0]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-[#34D399] shrink-0" title="Active Workspace" />
              <span className="text-xs font-medium truncate text-[#F1F5FC]">
                {user?.workspaces?.[0]?.name || "Personal Workspace"}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-[#A0AEC0]/80 font-mono">LIVE</span>
          </div>
        </div>

        {/* Primary Unified 5-Item Navigation */}
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
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-[#1B2332] text-[#6D8FFF] font-semibold border border-[#273247] shadow-xs"
                    : "text-[#A0AEC0] hover:bg-[#151B27] hover:text-[#F1F5FC]"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#6D8FFF]" : "text-[#A0AEC0]")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Settings & Interactive Account Management */}
      <div className="p-3 border-t border-[#273247] space-y-2 bg-[#10141D]">
        <Link
          href="/settings"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
            pathname === "/settings"
              ? "bg-[#1B2332] text-[#6D8FFF] font-semibold border border-[#273247]"
              : "text-[#A0AEC0] hover:bg-[#151B27] hover:text-[#F1F5FC]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings & Isolation</span>
        </Link>

        {/* Interactive Account Profile / Sign Out Card */}
        <div className="relative pt-1">
          <button
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full p-2 rounded-xl bg-[#151B27] border border-[#273247] hover:border-[#3A4A68] transition flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-[#1B2332] text-[#6D8FFF] border border-[#273247] flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(user?.full_name, user?.email)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#F1F5FC] truncate">
                  {user?.full_name || "Research Scientist"}
                </span>
                <span className="text-[11px] text-[#A0AEC0] truncate">
                  {user?.email || "dev@docora.local"}
                </span>
              </div>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 text-[#A0AEC0] transition-transform",
                showAccountMenu ? "rotate-180" : ""
              )}
            />
          </button>

          {/* Account Popover Menu */}
          {showAccountMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-[#151B27] border border-[#273247] rounded-xl shadow-xl z-30 space-y-1">
              <div className="px-2.5 py-1.5 text-[11px] text-[#A0AEC0] border-b border-[#273247] flex items-center justify-between">
                <span>Account Status</span>
                <span className="text-[#34D399] font-medium">Verified Active</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition text-left"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Isolation Tag */}
        <div className="px-2 pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[#A0AEC0]/70">
          <ShieldCheck className="h-3 w-3 text-[#34D399] shrink-0" />
          <span>Tenant Isolated & Encrypted</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#273247] bg-[#10141D] shrink-0 h-screen sticky top-0 select-none z-20">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-[#10141D] border-r border-[#273247] shadow-2xl select-none z-50 animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
