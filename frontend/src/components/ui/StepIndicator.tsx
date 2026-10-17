"use client";

import { Check } from "lucide-react";

export interface StepItem {
  id: number;
  label: string;
  description: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Progress Workflow" className="w-full max-w-4xl mx-auto mb-8">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isAccessible = step.id <= currentStep;

          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!isAccessible}
                onClick={() => onStepClick?.(step.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 ${
                  isCurrent
                    ? "border-amber-500/50 bg-amber-950/20 shadow-sm"
                    : isCompleted
                    ? "border-emerald-500/30 bg-emerald-950/10 text-slate-300"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    isCurrent
                      ? "bg-amber-500 text-slate-950"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs font-semibold tracking-tight truncate ${
                      isCurrent
                        ? "text-white"
                        : isCompleted
                        ? "text-slate-200"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {step.description}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
