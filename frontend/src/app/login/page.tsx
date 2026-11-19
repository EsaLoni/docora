"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter your email address to continue.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMessage("Enter a valid email address (e.g., name@company.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Enter your account password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(cleanEmail, password, rememberMe);
      router.push(redirectUrl);
    } catch (err: any) {
      const msg = err.message || err.detail || "";
      if (msg.includes("401") || msg.toLowerCase().includes("credential") || msg.toLowerCase().includes("invalid")) {
        setErrorMessage("Incorrect email or password. Verify your credentials and try again.");
      } else if (msg.includes("fetch") || msg.includes("network")) {
        setErrorMessage("Unable to connect to the authentication server. Check your connection or retry in a few moments.");
      } else {
        setErrorMessage(msg || "Authentication failed. Please verify your email and password.");
      }
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
    <div className="w-full max-w-sm p-6 sm:p-8 rounded-xl bg-surface border border-hairline shadow-xs select-none text-ink font-sans">
      {/* Brand Header */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="font-serif text-title font-semibold text-ink tracking-tight">
          Sign in to Docora
        </h1>
        <p className="text-caption text-ink-muted">
          Access your research notebooks and grounded documents.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-lg bg-destructive-subtle border border-destructive-border text-destructive text-ui flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-caption font-medium text-ink"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="name@company.com"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-muted text-[16px] sm:text-ui outline-none focus:ring-1 focus:ring-border-strong transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-caption font-medium text-ink"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              prefetch={false}
              className="text-caption text-ink-muted hover:text-ink transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-muted text-[16px] sm:text-ui outline-none focus:ring-1 focus:ring-border-strong transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 text-caption text-ink-secondary cursor-pointer">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-hairline text-gold focus:ring-gold cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          className="w-full py-2 text-ui flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </form>

      {/* Demo helper */}
      <div className="mt-5 pt-4 border-t border-hairline text-center">
        <button
          type="button"
          onClick={handleQuickFillDev}
          className="text-caption text-ink-secondary hover:text-ink transition-colors cursor-pointer"
        >
          Fill demo test credentials
        </button>
      </div>

      {/* Footer Registration Link */}
      <div className="mt-4 text-center text-caption text-ink-muted">
        Don't have an account?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
          prefetch={false}
          className="text-ink font-medium hover:underline ml-1"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col items-center justify-center p-4 select-none">
      <Suspense
        fallback={
          <div className="text-ui text-ink-muted flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-ink-muted" />
            <span>Loading...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
