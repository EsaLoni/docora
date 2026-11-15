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
    <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1F1F1F] border border-[#303030] shadow-2xl relative z-10">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <DocoraSymbol size={52} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F3F4]">
          Welcome to Docora
        </h1>
        <p className="text-sm text-[#B8BDC7] mt-1.5">
          Your documents. Your intelligence.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
          <span className="text-red-400 font-bold">•</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wider text-[#9299A4]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#8AB4F8] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
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
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9299A4] hover:text-[#F1F3F4] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs text-[#B8BDC7] cursor-pointer">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#303030] bg-[#141414] text-[#8AB4F8] focus:ring-0 cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-[#3156D8] hover:bg-[#2546C4] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Demo helper */}
      <div className="mt-6 pt-5 border-t border-[#2A2A2A] text-center">
        <button
          type="button"
          onClick={handleQuickFillDev}
          className="text-xs text-[#6D8FFF] hover:text-[#84A2FF] font-medium transition-colors underline decoration-dotted"
        >
          Quick fill demo credentials (dev@docora.local)
        </button>
      </div>

      {/* Footer Registration Link */}
      <div className="mt-6 text-center text-xs text-[#B8BDC7]">
        Don't have an account?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
          className="text-[#8AB4F8] font-medium hover:underline ml-1"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#0B0B0B] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8AB4F8]/5 rounded-full blur-3xl pointer-events-none" />
      <Suspense
        fallback={
          <div className="text-sm text-[#9299A4] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#8AB4F8]" />
            Loading authentication...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
