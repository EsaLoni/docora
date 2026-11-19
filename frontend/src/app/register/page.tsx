"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter an email address to create your account.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMessage("Enter a valid email address (e.g., name@company.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Enter a password for your account.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Re-enter your password to confirm.");
      return;
    }

    setIsLoading(true);
    try {
      await register(cleanEmail, password, fullName.trim() || undefined);
      router.push(redirectUrl);
    } catch (err: any) {
      const msg = err.message || err.detail || "";
      if (msg.includes("already exists") || msg.includes("unique")) {
        setErrorMessage("An account with this email address already exists. Try signing in instead.");
      } else if (msg.includes("fetch") || msg.includes("network")) {
        setErrorMessage("Unable to connect to the registration server. Check your connection or retry in a few moments.");
      } else {
        setErrorMessage(msg || "Registration failed. Verify your details and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm p-6 sm:p-8 rounded-xl bg-surface border border-hairline shadow-xs select-none text-ink font-sans">
      {/* Brand Header */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="font-serif text-title font-semibold text-ink tracking-tight">
          Create Docora Account
        </h1>
        <p className="text-caption text-ink-muted">
          Start researching with verified document intelligence.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-lg bg-destructive-subtle border border-destructive-border text-destructive text-ui flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <label htmlFor="full_name" className="block text-caption font-medium text-ink">
            Full Name (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <User className="w-4 h-4" />
            </div>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Jane Doe"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-muted text-[16px] sm:text-ui outline-none focus:ring-1 focus:ring-border-strong transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-caption font-medium text-ink">
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
          <label htmlFor="password" className="block text-caption font-medium text-ink">
            Password (Min. 8 characters)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        <div className="space-y-1">
          <label htmlFor="confirm_password" className="block text-caption font-medium text-ink">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-muted text-[16px] sm:text-ui outline-none focus:ring-1 focus:ring-border-strong transition-colors"
            />
          </div>
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
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </form>

      {/* Footer Sign In Link */}
      <div className="mt-5 text-center text-caption text-ink-muted">
        Already have an account?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
          prefetch={false}
          className="text-ink font-medium hover:underline ml-1"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
        <RegisterForm />
      </Suspense>
    </div>
  );
}
