"use client";

import { useState } from "react";
import { Gift, Plus, Check, ArrowLeft } from "lucide-react";
import type { GiftProject, Recipient } from "@/lib/api";

interface GiftProjectStepProps {
  projects: GiftProject[];
  selectedRecipient: Recipient | undefined;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (payload: {
    recipient_id: string;
    title: string;
    occasion: string;
    budget_min?: number | null;
    budget_max: number;
    currency?: string;
  }) => Promise<void>;
  onBack: () => void;
  onContinue: () => void;
}

export function GiftProjectStep({
  projects,
  selectedRecipient,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onBack,
  onContinue,
}: GiftProjectStepProps) {
  // Filter projects belonging to currently selected recipient
  const recipientProjects = selectedRecipient
    ? projects.filter((p) => p.recipient_id === selectedRecipient.id)
    : projects;

  const [showCreateForm, setShowCreateForm] = useState(recipientProjects.length === 0);
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [budgetMin, setBudgetMin] = useState("30");
  const [budgetMax, setBudgetMax] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRecipient) {
      setError("Please choose a recipient first.");
      return;
    }

    if (!title.trim() || !occasion.trim()) {
      setError("Please provide a project title and occasion.");
      return;
    }

    const min = budgetMin ? parseFloat(budgetMin) : null;
    const max = parseFloat(budgetMax);

    if (isNaN(max) || max <= 0) {
      setError("Please provide a valid maximum budget.");
      return;
    }

    if (min !== null && !isNaN(min) && min > max) {
      setError("Minimum budget cannot exceed maximum budget.");
      return;
    }

    try {
      setSubmitting(true);
      await onCreateProject({
        recipient_id: selectedRecipient.id,
        title: title.trim(),
        occasion: occasion.trim(),
        budget_min: min !== null && !isNaN(min) ? min : null,
        budget_max: max,
        currency,
      });

      setTitle("");
      setOccasion("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create gift project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="saas-card p-6 sm:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
            <Gift className="w-3.5 h-3.5" />
            <span>Step 2 of 3</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Set up the Gift Project
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            For: <span className="text-amber-300 font-medium">{selectedRecipient?.name}</span> ({selectedRecipient?.relationship})
          </p>
        </div>

        {recipientProjects.length > 0 && !showCreateForm && (
          <button
            type="button"
            id="btn-add-another-project"
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 btn-secondary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Existing Project Selector */}
      {recipientProjects.length > 0 && !showCreateForm ? (
        <div className="space-y-4">
          <label className="block text-xs font-medium text-slate-300">
            Select an Occasion / Project
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recipientProjects.map((proj) => {
              const isSelected = proj.id === selectedProjectId;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => onSelectProject(proj.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? "border-amber-500/50 bg-amber-950/20 shadow-sm"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-white truncate">
                      {proj.title}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-amber-300/80 mt-1">
                    Occasion: {proj.occasion}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono">
                    Budget: ${Number(proj.budget_min || 0)} – ${Number(proj.budget_max)} {proj.currency}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 btn-secondary text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Recipient</span>
            </button>

            <button
              type="button"
              id="btn-confirm-project-continue"
              disabled={!selectedProjectId}
              onClick={onContinue}
              className="px-6 py-2.5 btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <span>Continue to Gifting Studio</span>
            </button>
          </div>
        </div>
      ) : (
        /* Create Project Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-title" className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name / Title *
            </label>
            <input
              id="project-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Maya's 30th Birthday Celebration"
              className="w-full px-3.5 py-2.5 saas-input text-xs"
            />
          </div>

          <div>
            <label htmlFor="project-occasion" className="block text-xs font-medium text-slate-300 mb-1.5">
              Occasion *
            </label>
            <input
              id="project-occasion"
              type="text"
              required
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="e.g. 30th Birthday, Promotion, Housewarming, Anniversary"
              className="w-full px-3.5 py-2.5 saas-input text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="project-budget-min" className="block text-xs font-medium text-slate-300 mb-1.5">
                Min Budget ($)
              </label>
              <input
                id="project-budget-min"
                type="number"
                min="0"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="20"
                className="w-full px-3.5 py-2.5 saas-input text-xs"
              />
            </div>

            <div>
              <label htmlFor="project-budget-max" className="block text-xs font-medium text-slate-300 mb-1.5">
                Max Budget ($) *
              </label>
              <input
                id="project-budget-max"
                type="number"
                min="1"
                required
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="100"
                className="w-full px-3.5 py-2.5 saas-input text-xs"
              />
            </div>

            <div>
              <label htmlFor="project-currency" className="block text-xs font-medium text-slate-300 mb-1.5">
                Currency
              </label>
              <select
                id="project-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 saas-input text-xs"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 btn-secondary text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              id="btn-create-gift-project"
              disabled={submitting}
              className="px-6 py-2.5 btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? "Creating Project..." : "Create & Continue"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
