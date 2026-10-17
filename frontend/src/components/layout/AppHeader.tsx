"use client";

import Link from "next/link";
import { Sparkles, Gift, BookHeart, Github, LogOut, User as UserIcon } from "lucide-react";
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
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#090c13]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href="/"
          id="brand-logo"
          className="flex items-center gap-3 text-white hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-violet-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-slate-950" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-sm text-white">GiftMind</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline -mt-0.5">
              Turn Memories Into Meaningful Gifts
            </span>
          </div>
        </Link>

        {/* Navigation Experiences */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            id="nav-experience-gifts"
            onClick={() => onSelectExperience("gifts")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeExperience === "gifts"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>AI Gift Ideas</span>
          </button>
          <button
            type="button"
            id="nav-experience-story"
            onClick={() => onSelectExperience("story")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeExperience === "story"
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookHeart className="w-3.5 h-3.5" />
            <span>Story Keepsake</span>
          </button>
        </nav>

        {/* User / Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/itsdevcode/giftmind"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-link-github"
            aria-label="View source code on GitHub"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03] transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>

          {currentUser ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/[0.08]">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 font-semibold">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="hidden lg:flex flex-col text-left">
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
                id="sign-out-button"
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="header-sign-in-button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
