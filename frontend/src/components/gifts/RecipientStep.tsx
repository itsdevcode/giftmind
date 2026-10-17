"use client";

import { useState } from "react";
import { User, Users, Plus, Check } from "lucide-react";
import type { Recipient } from "@/lib/api";

interface RecipientStepProps {
  recipients: Recipient[];
  selectedRecipientId: string;
  onSelectRecipient: (recipientId: string) => void;
  onCreateRecipient: (payload: {
    name: string;
    relationship: string;
    interests?: string[];
    notes?: string;
  }) => Promise<void>;
  loading: boolean;
  onContinue: () => void;
}

export function RecipientStep({
  recipients,
  selectedRecipientId,
  onSelectRecipient,
  onCreateRecipient,
  loading,
  onContinue,
}: RecipientStepProps) {
  const [showCreateForm, setShowCreateForm] = useState(recipients.length === 0);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [interests, setInterests] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !relationship.trim()) {
      setError("Please provide both a name and relationship.");
      return;
    }

    try {
      setSubmitting(true);
      const interestList = interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await onCreateRecipient({
        name: name.trim(),
        relationship: relationship.trim(),
        interests: interestList.length > 0 ? interestList : undefined,
        notes: notes.trim() || undefined,
      });

      setName("");
      setRelationship("");
      setInterests("");
      setNotes("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create recipient profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="saas-card p-6 sm:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
            <User className="w-3.5 h-3.5" />
            <span>Step 1 of 3</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Who is this gift or keepsake for?
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose an existing recipient profile or add a new one.
          </p>
        </div>

        {recipients.length > 0 && !showCreateForm && (
          <button
            type="button"
            id="btn-add-another-recipient"
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 btn-secondary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Existing Recipient List / Picker */}
      {recipients.length > 0 && !showCreateForm ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Select Recipient Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recipients.map((rec) => {
                const isSelected = rec.id === selectedRecipientId;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onSelectRecipient(rec.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "border-amber-500/50 bg-amber-950/20 shadow-sm"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-white">
                        {rec.name}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-amber-300/80 mt-0.5">
                      {rec.relationship}
                    </div>
                    {rec.interests && rec.interests.length > 0 && (
                      <div className="text-[11px] text-slate-400 mt-2 truncate">
                        {rec.interests.slice(0, 3).join(", ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRecipient && (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-1">
              <span className="text-slate-400">Personal Notes:</span>
              <p className="text-slate-300 italic">
                {selectedRecipient.notes || "No notes added yet."}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.08] flex justify-end">
            <button
              type="button"
              id="btn-confirm-recipient-continue"
              disabled={!selectedRecipientId || loading}
              onClick={onContinue}
              className="px-6 py-2.5 btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <span>Continue to Gift Project</span>
            </button>
          </div>
        </div>
      ) : (
        /* New Recipient Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipient-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name *
              </label>
              <input
                id="recipient-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="w-full px-3.5 py-2.5 saas-input text-xs"
              />
            </div>

            <div>
              <label htmlFor="recipient-relationship" className="block text-xs font-medium text-slate-300 mb-1.5">
                Relationship *
              </label>
              <input
                id="recipient-relationship"
                type="text"
                required
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Sister, Mom, Best Friend"
                className="w-full px-3.5 py-2.5 saas-input text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recipient-interests" className="block text-xs font-medium text-slate-300 mb-1.5">
              Interests &amp; Hobbies (comma-separated)
            </label>
            <input
              id="recipient-interests"
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. Specialty coffee, vintage cameras, trail running"
              className="w-full px-3.5 py-2.5 saas-input text-xs"
            />
          </div>

          <div>
            <label htmlFor="recipient-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
              Personal Quirks, Preferences &amp; Memories
            </label>
            <textarea
              id="recipient-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Loves heartfelt handwritten notes, prefers experiences over clutter..."
              className="w-full px-3.5 py-2.5 saas-input text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
            {recipients.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel and pick existing
              </button>
            ) : <div />}

            <button
              type="submit"
              id="btn-save-recipient-profile"
              disabled={submitting}
              className="px-5 py-2.5 btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? "Saving Profile..." : "Save Profile & Continue"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
