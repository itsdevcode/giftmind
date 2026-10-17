"use client";

import { useState, useEffect } from "react";
import { BookOpen, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { PdfDownloadButton } from "./PdfDownloadButton";
import type { StoryKeepsake } from "@/lib/api";

interface StoryEditorProps {
  story: StoryKeepsake;
  onSaveStory: (payload: {
    title: string;
    dedication: string;
    story_body: string;
    closing_message: string;
  }) => Promise<void>;
  onDownloadPdf: () => Promise<void>;
}

export function StoryEditor({
  story,
  onSaveStory,
  onDownloadPdf,
}: StoryEditorProps) {
  const [title, setTitle] = useState(story.title);
  const [dedication, setDedication] = useState(story.dedication);
  const [body, setBody] = useState(story.story_body);
  const [closing, setClosing] = useState(story.closing_message);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if user has modified anything compared to props
  const isDirty =
    title !== story.title ||
    dedication !== story.dedication ||
    body !== story.story_body ||
    closing !== story.closing_message;

  // Sync if new story generation arrives
  useEffect(() => {
    setTitle(story.title);
    setDedication(story.dedication);
    setBody(story.story_body);
    setClosing(story.closing_message);
  }, [story.id, story.title, story.dedication, story.story_body, story.closing_message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await onSaveStory({
        title: title.trim(),
        dedication: dedication.trim(),
        story_body: body.trim(),
        closing_message: closing.trim(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save story changes.");
    } finally {
      setSaving(false);
    }
  };

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div id="story-keepsake-container" className="space-y-6 max-w-4xl mx-auto w-full pt-6">
      {/* Top Banner and Download */}
      <div className="p-6 saas-card bg-gradient-to-r from-amber-950/20 via-violet-950/20 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-amber-500/20">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            <span>AI Story Keepsake</span>
          </div>
          <h3 className="text-xl font-semibold text-white tracking-tight">
            &ldquo;{story.title}&rdquo;
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {story.model_name} • Prompt {story.prompt_version}
          </p>
        </div>

        <PdfDownloadButton
          story={story}
          isDirty={isDirty}
          onDownload={onDownloadPdf}
        />
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Story Edit Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 saas-card space-y-5 border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <span className="text-xs font-semibold text-slate-300 tracking-tight flex items-center gap-1.5">
            <span>✏️</span> Review &amp; Personalize Story Keepsake
          </span>
          {success && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Story saved successfully</span>
            </span>
          )}
        </div>

        <div>
          <label htmlFor="story-title" className="block text-xs font-medium text-slate-300 mb-1.5">
            Keepsake Title
          </label>
          <input
            id="story-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 saas-input text-xs font-medium"
          />
        </div>

        <div>
          <label htmlFor="story-dedication" className="block text-xs font-medium text-slate-300 mb-1.5">
            Dedication
          </label>
          <textarea
            id="story-dedication"
            rows={2}
            required
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
            className="w-full px-3.5 py-2.5 saas-input text-xs italic"
          />
        </div>

        <div>
          <label htmlFor="story-body" className="block text-xs font-medium text-slate-300 mb-1.5">
            Story Body (Suggested: 350–550 words)
          </label>
          <textarea
            id="story-body"
            rows={12}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3.5 py-2.5 saas-input text-xs leading-relaxed"
          />
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Word count: {wordCount} words</span>
            <span>Formatted directly into in-memory printable PDF keepsake</span>
          </div>
        </div>

        <div>
          <label htmlFor="story-closing" className="block text-xs font-medium text-slate-300 mb-1.5">
            Closing Blessing &amp; Message
          </label>
          <textarea
            id="story-closing"
            rows={2}
            required
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            className="w-full px-3.5 py-2.5 saas-input text-xs font-medium"
          />
        </div>

        <div className="flex justify-end pt-3 border-t border-white/[0.08]">
          <button
            type="submit"
            id="btn-save-story-edits"
            disabled={saving || !isDirty}
            className="px-6 py-2.5 btn-primary text-xs flex items-center gap-2 disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving Story..." : "Save Story Edits"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
