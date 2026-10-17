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
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                  isCurrent
                    ? "border-amber-400/50 bg-gradient-to-r from-amber-950/30 to-[#0e1422] shadow-md shadow-amber-950/20 ring-1 ring-amber-400/25"
                    : isCompleted
                    ? "border-emerald-500/30 bg-emerald-950/15 text-slate-300 hover:border-emerald-500/50"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all ${
                    isCurrent
                      ? "bg-gradient-to-tr from-amber-400 to-amber-300 text-slate-950 shadow-sm shadow-amber-500/30"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : step.id}
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
