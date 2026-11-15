"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/notebooks";

  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters in length.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    if (!agreeTerms) {
      setErrorMessage("You must accept the terms of service to create an account.");
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, fullName);
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMessage(
        err.message || err.detail || "Registration failed. An account with this email may already exist."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1F1F1F] border border-[#303030] shadow-2xl relative z-10">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <DocoraSymbol size={52} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F3F4]">
          Create Account
        </h1>
        <p className="text-sm text-[#B8BDC7] mt-1.5">
          Join Docora to start researching with grounded AI
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
          <span className="text-red-400 font-bold">•</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="full_name"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            Full Name (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
              <User className="w-4 h-4" />
            </div>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
          </div>
        </div>

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
          <label
            htmlFor="password"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            Password (min 8 characters)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        <div>
          <label
            htmlFor="confirm_password"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
          </div>
        </div>

        <div className="pt-1">
          <label className="flex items-start gap-2.5 text-xs text-[#B8BDC7] cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 rounded border-[#303030] bg-[#141414] text-[#8AB4F8] focus:ring-0 mt-0.5 cursor-pointer"
            />
            <span>
              I accept the Docora Terms of Service and acknowledge private storage of my research data.
            </span>
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
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Login Link */}
      <div className="mt-8 pt-6 border-t border-[#2A2A2A] text-center text-xs text-[#B8BDC7]">
        Already have an account?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
          className="text-[#8AB4F8] font-medium hover:underline ml-1"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full bg-[#0B0B0B] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8AB4F8]/5 rounded-full blur-3xl pointer-events-none" />
      <Suspense
        fallback={
          <div className="text-sm text-[#9299A4] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#8AB4F8]" />
            Loading registration...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
