"use client";

import { useState, useEffect } from "react";
import { BookHeart, CheckCircle2, AlertCircle, Save, Sparkles, Trash2, ArrowRight } from "lucide-react";
import type { GiftProject, Recipient, MemoryAnswersListResponse } from "@/lib/api";

const CANONICAL_QUESTIONS = [
  {
    key: "how_we_met",
    prompt: "How did you first meet this person?",
    hint: "Describe the first encounter, the setting, or the beginning of your connection...",
  },
  {
    key: "favorite_memory",
    prompt: "What is your favorite memory together?",
    hint: "A memorable road trip, a late-night discussion, an adventure, or a shared milestone...",
  },
  {
    key: "what_makes_them_special",
    prompt: "What makes this person special to you?",
    hint: "Their unique personality traits, generosity, sense of humor, or inner strength...",
  },
  {
    key: "shared_milestone",
    prompt: "What challenge, milestone or experience have you shared?",
    hint: "A hurdle navigated together, an achievement celebrated, or a personal breakthrough...",
  },
  {
    key: "gift_feeling",
    prompt: "What do you want this person to remember or feel when receiving this gift?",
    hint: "Deeply appreciated, cherished, confident, or reminded of your enduring bond...",
  },
];

interface MemoryInterviewProps {
  recipient: Recipient;
  project: GiftProject;
  initialAnswers: Record<string, string>;
  hasSufficientMemories: boolean;
  guidanceMessage: string;
  onSaveAnswers: (answers: { question_key: string; answer: string }[]) => Promise<MemoryAnswersListResponse>;
  onReadyToGenerateStory: () => void;
  storyLoading: boolean;
}

export function MemoryInterview({
  recipient,
  project,
  initialAnswers,
  hasSufficientMemories,
  guidanceMessage,
  onSaveAnswers,
  onReadyToGenerateStory,
  storyLoading,
}: MemoryInterviewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Sync state if project changed or initial answers reloaded
  useEffect(() => {
    setAnswers(initialAnswers);
    setDirty(false);
  }, [project.id, initialAnswers]);

  const handleChange = (key: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaveFeedback(null);
  };

  const handleClear = (key: string) => {
    handleChange(key, "");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = Object.entries(answers).map(([question_key, answer]) => ({
        question_key,
        answer: answer.trim(),
      }));

      await onSaveAnswers(payload);
      setDirty(false);
      setSaveFeedback("Memories saved successfully.");
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: unknown) {
      setSaveFeedback(err instanceof Error ? err.message : "Failed to save memories.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      {/* Header and Guidance */}
      <div className="p-6 saas-card bg-gradient-to-r from-violet-950/30 to-slate-900/60 border-violet-500/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">
              <BookHeart className="w-3.5 h-3.5" />
              <span>Guided Memory Interview</span>
            </div>
            <h3 className="text-xl font-semibold text-white tracking-tight">
              Share Authentic Shared Memories for {recipient.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                hasSufficientMemories
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-300"
              }`}
            >
              {hasSufficientMemories ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Story Input Ready</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>More Detail Needed</span>
                </>
              )}
            </span>
          </div>
        </div>

        {guidanceMessage && (
          <p className="text-xs text-slate-300 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06] leading-relaxed">
            {guidanceMessage}
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-4">
          {CANONICAL_QUESTIONS.map((q, idx) => {
            const val = answers[q.key] || "";
            const wordCount = val.trim().split(/\s+/).filter(Boolean).length;

            return (
              <div key={q.key} className="p-5 saas-card space-y-2 border-white/[0.08] hover:border-violet-500/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <label htmlFor={`memory-${q.key}`} className="block text-xs font-semibold text-white">
                    {idx + 1}. {q.prompt}
                  </label>
                  {val && (
                    <button
                      type="button"
                      onClick={() => handleClear(q.key)}
                      title="Clear this answer"
                      className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <textarea
                  id={`memory-${q.key}`}
                  rows={3}
                  value={val}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  placeholder={q.hint}
                  className="w-full px-3.5 py-2.5 saas-input text-xs leading-relaxed"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                  <span>{wordCount} words</span>
                  <span className="italic">Empty answers can be cleared to delete</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs">
            {dirty && (
              <span className="text-amber-400">
                You have unsaved changes in your memory answers.
              </span>
            )}
            {saveFeedback && (
              <span className={saveFeedback.includes("success") ? "text-emerald-400" : "text-rose-400"}>
                {saveFeedback}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="submit"
              id="btn-save-memory-answers"
              disabled={saving}
              className="px-5 py-2.5 btn-secondary text-xs flex items-center gap-2 flex-1 sm:flex-initial disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Memories"}</span>
            </button>

            <button
              type="button"
              id="btn-generate-story-keepsake"
              disabled={storyLoading || !hasSufficientMemories}
              onClick={onReadyToGenerateStory}
              className="px-6 py-2.5 btn-ai text-xs flex items-center justify-center gap-2 flex-1 sm:flex-initial disabled:opacity-50"
            >
              {storyLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing Story (30–60s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Story Keepsake</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
