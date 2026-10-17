"use client";

import { Sparkles, Tag, Gift, HelpCircle, Lightbulb } from "lucide-react";
import type { GiftRecommendation } from "@/lib/api";

interface GiftIdeaCardProps {
  recommendation: GiftRecommendation;
  index: number;
}

export function GiftIdeaCard({ recommendation, index }: GiftIdeaCardProps) {
  const budget = parseFloat(recommendation.estimated_budget);
  const formattedBudget = isNaN(budget) ? recommendation.estimated_budget : `$${budget.toFixed(2)}`;

  return (
    <article
      data-recommendation-card
      className="p-6 saas-card saas-card-hover flex flex-col justify-between space-y-4 border-white/[0.08] hover:border-amber-500/40 relative overflow-hidden"
    >
      {/* Top badges */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center font-mono">
            0{index + 1}
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-medium text-slate-300">
            <Tag className="w-3 h-3 text-amber-400" />
            <span>{recommendation.category}</span>
          </div>
        </div>

        <h4 className="text-base font-semibold text-white tracking-tight leading-snug">
          {recommendation.title}
        </h4>

        {/* Estimated Budget Banner (Clear disclaimer: estimated, not merchant-guaranteed) */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/25 text-emerald-300 text-xs font-medium font-mono">
          <span>Estimated Budget:</span>
          <span className="font-semibold text-emerald-200">
            ~ {formattedBudget} {recommendation.currency}
          </span>
        </div>

        {recommendation.description && (
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {recommendation.description}
          </p>
        )}

        {/* Why this gift fits */}
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            <span>Why this fits</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {recommendation.personalization_reason}
          </p>
        </div>
      </div>

      {/* Presentation Suggestion */}
      <div className="pt-3 border-t border-white/[0.08] bg-white/[0.02] -mx-6 -mb-6 p-4 rounded-b-2xl">
        <div className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
          <Lightbulb className="w-3 h-3" />
          <span>Presentation Idea</span>
        </div>
        <p className="text-xs text-slate-300 italic font-normal">
          &ldquo;{recommendation.presentation_idea}&rdquo;
        </p>
      </div>
    </article>
  );
}
