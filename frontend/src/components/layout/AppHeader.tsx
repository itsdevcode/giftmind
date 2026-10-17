"use client";

import Link from "next/link";
import { Sparkles, Github, LogOut, User as UserIcon, HeartHandshake, ShieldCheck } from "lucide-react";
import { HeritageArch, LotusFlowerPattern } from "@/components/illustrations/CulturalMotifs";
import type { User } from "@/lib/api";

interface AppHeaderProps {
  currentUser: User | null;
  activeExperience: "gifts" | "story";
  onSelectExperience: (exp: "gifts" | "story") => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export function AppHeader({
  currentUser,
  activeExperience,
  onSelectExperience,
  onLogout,
  onOpenAuth,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#090c13]/90 backdrop-blur-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Left: Brand Lockup & Tagline Badge */}
        <div className="flex items-center gap-3.5 sm:gap-5 flex-shrink-0">
          <Link
            href="/"
            id="brand-logo"
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
          >
            {/* Architectural Emblem Icon */}
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/25 via-amber-400/20 to-violet-500/20 border border-amber-400/40 p-[1.5px] shadow-md shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
              <div className="w-full h-full rounded-[10px] bg-[#0c101a] flex items-center justify-center">
                <LotusFlowerPattern className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>

            {/* Typography Lockup */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight text-[15px] text-white font-sans leading-none">
                  GiftMind
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400 tracking-wide uppercase leading-none mt-1">
                AI Keepsakes
              </span>
            </div>
          </Link>

          {/* Subtitle Badge */}
          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.03] border border-white/[0.08] text-slate-300">
            <HeritageArch className="w-3 h-3 text-amber-400" />
            <span>Turn Shared Memories Into Lasting Gifts</span>
          </div>
        </div>

        {/* Center / Right: Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Trust indicator pill */}
          <div className="hidden lg:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-white/[0.02] border border-white/[0.06] px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="font-medium text-slate-300 text-[11px]">Gemma 4 AI</span>
          </div>

          {/* GitHub button */}
          <a
            href="https://github.com/itsdevcode/giftmind"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-link-github"
            aria-label="View source code on GitHub"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.1] hover:border-white/[0.22] bg-white/[0.03] hover:bg-white/[0.08] transition-all cursor-pointer shadow-sm"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Star on GitHub</span>
          </a>

          {/* Auth State Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/[0.1]">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-300/10 border border-amber-400/40 flex items-center justify-center text-amber-300 font-semibold text-xs shadow-inner">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-medium text-slate-200 text-xs leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-none mt-1">
                    {currentUser.email}
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="nav-button-logout"
                onClick={onLogout}
                aria-label="Sign out"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1 cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="nav-button-signin"
              onClick={onOpenAuth}
              className="px-5 py-2 btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-950" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
