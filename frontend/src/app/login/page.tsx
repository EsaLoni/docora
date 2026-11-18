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
    <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] relative z-10 select-none">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-200">
          <DocoraSymbol size={48} />
        </div>
        <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-neutral-900">
          Welcome to Docora
        </h1>
        <p className="text-xs text-neutral-500 mt-1.5 tracking-normal">
          Your documents. Your intelligence.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
          <span className="text-rose-500 font-bold shrink-0">•</span>
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              prefetch={false}
              className="text-[11px] text-amber-700 hover:text-amber-800 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
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
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-neutral-300 text-amber-600 focus:ring-amber-500/30 cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
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
      <div className="mt-6 pt-5 border-t border-black/[0.08] text-center">
        <button
          type="button"
          onClick={handleQuickFillDev}
          className="text-xs text-amber-700 hover:text-amber-800 font-semibold transition-colors"
        >
          Quick fill demo credentials
        </button>
      </div>

      {/* Footer Registration Link */}
      <div className="mt-5 text-center text-xs text-neutral-600">
        Don't have an account?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
          prefetch={false}
          className="text-amber-700 font-semibold hover:underline ml-1"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Suspense
        fallback={
          <div className="text-xs text-neutral-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            Loading authentication...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
