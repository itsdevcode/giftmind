"use client";

import { Gift, BookHeart, ArrowRight } from "lucide-react";
import { HeritageArch } from "@/components/illustrations/CulturalMotifs";

interface ExperienceSelectorProps {
  activeExperience: "gifts" | "story";
  onSelectExperience: (exp: "gifts" | "story") => void;
}

export function ExperienceSelector({
  activeExperience,
  onSelectExperience,
}: ExperienceSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto w-full my-6">
      {/* Experience 1: Gift Ideas */}
      <div
        id="card-experience-gifts"
        role="button"
        tabIndex={0}
        onClick={() => onSelectExperience("gifts")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectExperience("gifts");
          }
        }}
        className={`relative overflow-hidden p-6 sm:p-7 saas-card saas-card-hover text-left cursor-pointer transition-all ${
          activeExperience === "gifts"
            ? "border-amber-500/50 bg-amber-950/25 shadow-xl shadow-amber-950/40 ring-1 ring-amber-500/30"
            : "hover:border-white/20 hover:bg-slate-900/60"
        }`}
      >
        {/* Subtle decorative heritage arch watermark */}
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-10 text-amber-400">
          <HeritageArch className="w-24 h-24" />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Gift className="w-5 h-5" />
          </div>
          {activeExperience === "gifts" && (
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide uppercase">
              Active Experience
            </span>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="text-lg font-semibold text-white tracking-tight mb-1.5 flex items-center gap-2">
            <span>AI Gift Ideas</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
            Discover thoughtful, personalized gifts tailored to your recipient&apos;s personality, occasion, and budget.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
            <span>Explore Gift Ideas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Experience 2: Story Keepsake */}
      <div
        id="card-experience-story"
        role="button"
        tabIndex={0}
        onClick={() => onSelectExperience("story")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectExperience("story");
          }
        }}
        className={`relative overflow-hidden p-6 sm:p-7 saas-card saas-card-hover text-left cursor-pointer transition-all ${
          activeExperience === "story"
            ? "border-violet-500/50 bg-violet-950/25 shadow-xl shadow-violet-950/40 ring-1 ring-violet-500/30"
            : "hover:border-white/20 hover:bg-slate-900/60"
        }`}
      >
        {/* Subtle decorative heritage arch watermark */}
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-10 text-violet-400">
          <HeritageArch className="w-24 h-24" />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-inner">
            <BookHeart className="w-5 h-5" />
          </div>
          {activeExperience === "story" && (
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/40 tracking-wide uppercase">
              Active Experience
            </span>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="text-lg font-semibold text-white tracking-tight mb-1.5 flex items-center gap-2">
            <span>Story Keepsake</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
            Turn meaningful memories into an emotionally rich narrative keepsake you can edit and download as a formatted PDF.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 group-hover:text-violet-300">
            <span>Create a Story Keepsake</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

