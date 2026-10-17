"use client";

import { Sparkles, Gift, BookHeart, ShieldCheck } from "lucide-react";

interface HeroSectionProps {
  onSelectGifts: () => void;
  onSelectStory: () => void;
  onExploreDemo?: () => void;
}

export function HeroSection({
  onSelectGifts,
  onSelectStory,
  onExploreDemo,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full text-center">
      {/* Decorative ambient gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-32 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl opacity-25"
      >
        <div className="aspect-[1155/678] w-[60rem] bg-gradient-to-tr from-amber-500/40 via-violet-600/30 to-amber-600/30" />
      </div>

      {/* Main Headline & Supporting copy */}
      <div className="relative space-y-4">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-tight">
          A thoughtful gift starts with a{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-violet-300 bg-clip-text text-transparent">
            meaningful connection.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
          Discover personalized gift ideas or turn your favorite shared memories into a keepsake they&apos;ll treasure.
        </p>

        {/* Primary and secondary CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            type="button"
            id="hero-create-gift-button"
            onClick={onSelectGifts}
            className="px-5 py-2.5 btn-primary flex items-center gap-2 text-sm"
          >
            <Gift className="w-4 h-4" />
            <span>Create a Gift</span>
          </button>

          <button
            type="button"
            id="hero-explore-story-button"
            onClick={onSelectStory}
            className="px-5 py-2.5 btn-secondary flex items-center gap-2 text-sm"
          >
            <BookHeart className="w-4 h-4 text-violet-400" />
            <span>Explore Story Keepsakes</span>
          </button>

          {onExploreDemo && (
            <button
              type="button"
              id="hero-sample-demo-button"
              onClick={onExploreDemo}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Try Sample Demo</span>
            </button>
          )}
        </div>

        {/* Accurate Trust Statement (no misleading local claims) */}
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-normal">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Powered by open-weight Gemma 4, hosted securely through Google&apos;s API.</span>
        </div>
      </div>
    </section>
  );
}
