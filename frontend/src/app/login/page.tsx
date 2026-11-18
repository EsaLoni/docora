"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/notebooks";

  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, rememberMe);
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMessage(
        err.message || err.detail || "Authentication failed. Please verify your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFillDev = () => {
    setEmail("dev@udip.local");
    setPassword("password123!");
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-[#0F121A]/90 border border-white/[0.08] backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] relative z-10 select-none">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-200">
          <DocoraSymbol size={48} />
        </div>
        <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-white">
          Welcome to Docora
        </h1>
        <p className="text-xs text-neutral-400 mt-1.5 tracking-normal">
          Your documents. Your intelligence.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
          <span className="text-rose-400 font-bold shrink-0">•</span>
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              prefetch={false}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/[0.1] bg-white/[0.05] text-indigo-500 focus:ring-0 cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Demo helper */}
      <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
        <button
          type="button"
          onClick={handleQuickFillDev}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Quick fill demo credentials
        </button>
      </div>

      {/* Footer Registration Link */}
      <div className="mt-5 text-center text-xs text-neutral-400">
        Don't have an account?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
          prefetch={false}
          className="text-indigo-400 font-medium hover:underline ml-1"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#08090D] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <Suspense
        fallback={
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            Loading authentication...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
