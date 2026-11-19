"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UploadQueueWidget } from "@/components/upload/UploadQueueWidget";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const isNotebookWorkspace = Boolean(
    pathname?.startsWith("/notebooks/") && pathname !== "/notebooks"
  );
  const isAuthPage = Boolean(
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/notebooks")}`);
    }
  }, [isLoading, isAuthenticated, isAuthPage, pathname, router]);

  const offlineBanner = isOffline ? (
    <div className="bg-surface-subtle border-b border-border-hairline px-4 py-1 text-center text-caption text-ink-secondary flex items-center justify-center gap-2 shrink-0 z-50">
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      <span>Offline: Viewing locally cached research data. Reconnecting to sync...</span>
    </div>
  ) : null;

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-canvas text-ink flex flex-col font-sans">
        {offlineBanner}
        {children}
      </div>
    );
  }

  if (isNotebookWorkspace) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-canvas text-ink flex flex-col font-sans">
        {offlineBanner}
        {children}
        <UploadQueueWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased flex w-full relative">
      {/* 5-Item Navigation Sidebar (Responsive Desktop & Mobile Drawer) */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {offlineBanner}
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Background Upload Indicator */}
      <UploadQueueWidget />
    </div>
  );
}
