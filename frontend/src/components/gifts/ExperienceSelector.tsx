"use client";

import { Gift, BookHeart, ArrowRight } from "lucide-react";

interface ExperienceSelectorProps {
  activeExperience: "gifts" | "story";
  onSelectExperience: (exp: "gifts" | "story") => void;
}

export function ExperienceSelector({
  activeExperience,
  onSelectExperience,
}: ExperienceSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full my-6">
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
        className={`p-6 saas-card saas-card-hover text-left cursor-pointer transition-all ${
          activeExperience === "gifts"
            ? "border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30"
            : "hover:border-white/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Gift className="w-5 h-5" />
          </div>
          {activeExperience === "gifts" && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Active Experience
            </span>
          )}
        </div>

        <h3 className="text-base font-semibold text-white tracking-tight mb-1">
          AI Gift Ideas
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Find thoughtful, personalized gifts tailored to someone&apos;s interests, occasion and budget.
        </p>

        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
          <span>Explore Gift Ideas</span>
          <ArrowRight className="w-3.5 h-3.5" />
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
        className={`p-6 saas-card saas-card-hover text-left cursor-pointer transition-all ${
          activeExperience === "story"
            ? "border-violet-500/50 bg-violet-950/20 shadow-lg shadow-violet-950/30 ring-1 ring-violet-500/30"
            : "hover:border-white/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <BookHeart className="w-5 h-5" />
          </div>
          {activeExperience === "story" && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30">
              Active Experience
            </span>
          )}
        </div>

        <h3 className="text-base font-semibold text-white tracking-tight mb-1">
          Story Keepsake
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Turn meaningful memories into a personalized story you can download as a beautifully formatted PDF.
        </p>

        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 group-hover:text-violet-300">
          <span>Create a Story Keepsake</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
