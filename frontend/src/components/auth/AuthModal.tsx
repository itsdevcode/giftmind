"use client";

import { useState } from "react";
import { User, Lock, Mail, X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mode: "login" | "register", payload: { name?: string; email: string; password: string }) => Promise<void>;
  error: string | null;
  submitting: boolean;
}

export function AuthModal({
  isOpen,
  onClose,
  onSubmit,
  error,
  submitting,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(mode, {
      name: mode === "register" ? name.trim() : undefined,
      email: email.trim(),
      password,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 sm:p-8 saas-card border-white/[0.12] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {mode === "register" ? "Create Your Account" : "Sign In to GiftMind"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mode === "register"
                ? "Preserve memories and discover thoughtful gifts"
                : "Welcome back to your gifting workspace"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arun Kumar"
                  className="w-full pl-10 pr-3.5 py-2.5 saas-input text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arun@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 saas-input text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 saas-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={submitting}
            className="w-full py-2.5 mt-2 btn-primary text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : mode === "register" ? (
              "Create Account & Continue"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="text-center pt-4 mt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {mode === "register"
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
