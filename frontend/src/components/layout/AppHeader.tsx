"use client";

import Link from "next/link";
import { Sparkles, Gift, BookHeart, Github, LogOut, User as UserIcon } from "lucide-react";
import { HeritageArch } from "@/components/illustrations/CulturalMotifs";
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
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#090c13]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <Link
          href="/"
          id="brand-logo"
          className="flex items-center gap-2.5 text-white hover:opacity-95 transition-all group flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-violet-400 p-[1px] shadow-sm shadow-amber-500/20">
            <div className="w-full h-full rounded-full bg-[#0b0f17] flex items-center justify-center">
              <HeritageArch className="w-4 h-4 text-amber-400 group-hover:scale-105 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight text-sm text-white font-sans">
              GiftMind
            </span>
            <span className="hidden md:inline-block text-[11px] font-normal text-slate-400 border-l border-white/10 pl-2">
              Meaningful Gifting &amp; Keepsakes
            </span>
          </div>
        </Link>

        {/* User / External Actions */}
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/itsdevcode/giftmind"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-link-github"
            aria-label="View source code on GitHub"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 font-semibold text-xs">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="font-medium text-slate-200 text-xs leading-none">
                    {currentUser.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="nav-button-logout"
                onClick={onLogout}
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1 cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="nav-button-signin"
              onClick={onOpenAuth}
              className="px-4 py-1.5 btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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
