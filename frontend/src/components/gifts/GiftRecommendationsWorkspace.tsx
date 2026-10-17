"use client";

import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, DollarSign, Calendar, User } from "lucide-react";
import { GiftIdeaCard } from "./GiftIdeaCard";
import type { GiftProject, Recipient, RecommendationGeneration } from "@/lib/api";

interface GiftRecommendationsWorkspaceProps {
  recipient: Recipient;
  project: GiftProject;
  generation: RecommendationGeneration | null;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onSwitchProject: () => void;
}

export function GiftRecommendationsWorkspace({
  recipient,
  project,
  generation,
  generating,
  error,
  onGenerate,
  onSwitchProject,
}: GiftRecommendationsWorkspaceProps) {
  const budgetMin = project.budget_min ? `$${Number(project.budget_min)}` : "$0";
  const budgetMax = `$${Number(project.budget_max)} ${project.currency}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      {/* Context Summary Bar */}
      <div className="p-4 sm:p-5 saas-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-amber-500/20">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recipient</span>
              <span className="text-white font-medium">{recipient.name} ({recipient.relationship})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Occasion</span>
              <span className="text-white font-medium">{project.occasion}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Budget Range</span>
              <span className="text-white font-medium font-mono">{budgetMin} – {budgetMax}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchProject}
          className="text-xs text-amber-400 hover:text-amber-300 font-medium underline text-left sm:text-right"
        >
          Change project parameters
        </button>
      </div>

      {/* Trigger & Explanation Banner */}
      <div className="p-6 saas-card bg-gradient-to-r from-amber-950/20 via-violet-950/20 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-white/[0.08]">
        <div className="space-y-1 max-w-xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Recommendation Studio</span>
          </div>
          <h3 className="text-lg font-semibold text-white tracking-tight">
            Curate 3 Meaningful Gift Ideas
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            Gemma 4 examines your recipient profile and budget limits to suggest three distinct, personalized gifts with presentation guidance.
          </p>
        </div>

        <button
          type="button"
          id="btn-generate-recommendations"
          onClick={onGenerate}
          disabled={generating}
          className="px-6 py-3 btn-ai text-xs font-semibold flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Analyzing with Gemma 4...</span>
            </>
          ) : generation ? (
            <>
              <RefreshCw className="w-4 h-4 text-amber-300" />
              <span>Regenerate New Ideas</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Generate 3 Gift Ideas</span>
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Results grid */}
      {generation && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">
                3 Personalized Ideas for {recipient.name}
              </h4>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Generated {new Date(generation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {generation.recommendations.map((rec, idx) => (
              <GiftIdeaCard key={rec.id} recommendation={rec} index={idx} />
            ))}
          </div>

          <p className="text-[11px] text-slate-500 text-center pt-2">
            * Estimated budgets reflect realistic price expectations and are not affiliate or merchant prices.
          </p>
        </div>
      )}
    </div>
  );
}
