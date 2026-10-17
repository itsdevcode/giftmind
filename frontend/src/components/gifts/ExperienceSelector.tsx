"use client";

import { Gift, BookHeart, ArrowRight, Sparkles } from "lucide-react";
import { HeritageArch, MandalaAccent } from "@/components/illustrations/CulturalMotifs";

interface ExperienceSelectorProps {
  activeExperience: "gifts" | "story";
  onSelectExperience: (exp: "gifts" | "story") => void;
}

export function ExperienceSelector({
  activeExperience,
  onSelectExperience,
}: ExperienceSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto w-full my-4">
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
        className={`group relative overflow-hidden p-6 sm:p-7 rounded-2xl border transition-all text-left cursor-pointer ${
          activeExperience === "gifts"
            ? "border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-[#0e1422] to-[#090c13] shadow-xl shadow-amber-950/30 ring-1 ring-amber-400/25"
            : "border-white/[0.08] bg-slate-900/40 hover:border-amber-400/30 hover:bg-slate-900/70"
        }`}
      >
        {/* Subtle decorative heritage arch watermark */}
        <div className="pointer-events-none absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 text-amber-400 transition-opacity">
          <HeritageArch className="w-32 h-32" />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm group-hover:scale-105 transition-transform">
            <Gift className="w-5 h-5" />
          </div>
          {activeExperience === "gifts" ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 tracking-wide">
              Selected
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors">
              Gemma 4 AI
            </span>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight mb-1.5 flex items-center gap-2">
            <span>AI Gift Ideas</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed mb-4">
            Personalized gift recommendations curated around their personality, passions, occasion, and your target budget.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
            <span>Explore Gift Ideas</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
        className={`group relative overflow-hidden p-6 sm:p-7 rounded-2xl border transition-all text-left cursor-pointer ${
          activeExperience === "story"
            ? "border-violet-400/40 bg-gradient-to-br from-violet-950/30 via-[#0e1422] to-[#090c13] shadow-xl shadow-violet-950/30 ring-1 ring-violet-400/25"
            : "border-white/[0.08] bg-slate-900/40 hover:border-violet-400/30 hover:bg-slate-900/70"
        }`}
      >
        {/* Subtle decorative heritage arch watermark */}
        <div className="pointer-events-none absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 text-violet-400 transition-opacity">
          <HeritageArch className="w-32 h-32" />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm group-hover:scale-105 transition-transform">
            <BookHeart className="w-5 h-5" />
          </div>
          {activeExperience === "story" ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-400/15 text-violet-300 border border-violet-400/30 tracking-wide">
              Selected
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors">
              Printable PDF
            </span>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight mb-1.5 flex items-center gap-2">
            <span>Story Keepsake</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed mb-4">
            Turn your favorite memories into an emotional narrative story that you can edit and download as a formatted keepsake PDF.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
            <span>Create a Story Keepsake</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

