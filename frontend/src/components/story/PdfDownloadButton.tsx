"use client";

import { useState, useEffect } from "react";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { StoryKeepsake } from "@/lib/api";

interface PdfDownloadButtonProps {
  story: StoryKeepsake;
  isDirty: boolean;
  onDownload: () => Promise<void>;
}

export function PdfDownloadButton({
  story,
  isDirty,
  onDownload,
}: PdfDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isDirty) {
      const confirmProceed = window.confirm(
        "You have unsaved changes in the story editor. The PDF will reflect the last saved version. Do you want to proceed?"
      );
      if (!confirmProceed) return;
    }

    try {
      setDownloading(true);
      setError(null);
      await onDownload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to download keepsake PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
      {isDirty && (
        <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Unsaved edits will not appear in PDF</span>
        </span>
      )}

      {error && (
        <span className="text-xs text-rose-400">{error}</span>
      )}

      <button
        type="button"
        id="btn-download-pdf-keepsake"
        disabled={downloading}
        onClick={handleClick}
        className="px-5 py-2.5 btn-primary text-xs flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
      >
        {downloading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            <span>Generating Archival PDF...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-slate-950" />
            <span>Download Keepsake PDF</span>
          </>
        )}
      </button>
    </div>
  );
}
