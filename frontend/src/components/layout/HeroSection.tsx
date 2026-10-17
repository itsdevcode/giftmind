"use client";

import { Gift, BookHeart, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { IndianHeritageArtwork, HeritageArch } from "@/components/illustrations/CulturalMotifs";

interface HeroSectionProps {
  onSelectGifts: () => void;
  onSelectStory: () => void;
}

export function HeroSection({
  onSelectGifts,
  onSelectStory,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-8 sm:pt-12 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Decorative ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-40 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl opacity-25 -z-10"
      >
        <div className="aspect-[1155/678] w-[68rem] bg-gradient-to-tr from-amber-500/30 via-violet-600/25 to-amber-600/20" />
      </div>

      {/* 2-Column Hero Composition: Editorial Left, Artistic Supporting Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Headline, Copy, CTAs, Trust */}
        <div className="lg:col-span-7 text-center lg:text-left space-y-5">
          {/* Eyebrow Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-300 backdrop-blur-sm">
            <HeritageArch className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Gifting &amp; Memory Keepsakes</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-[1.18] font-sans">
            A thoughtful gift starts with a{" "}
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-violet-300 bg-clip-text text-transparent">
              meaningful connection.
            </span>
          </h1>

          {/* Subheading */}
          <p className="max-w-xl mx-auto lg:mx-0 text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            Discover personalized gift ideas and turn shared memories into beautiful keepsakes they&apos;ll treasure.
          </p>

          {/* Primary and Secondary CTA Button Group */}
          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <button
              type="button"
              id="hero-create-gift-button"
              onClick={onSelectGifts}
              className="px-6 py-2.5 btn-primary text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Gift className="w-4 h-4" />
              <span>Create a Gift</span>
              <ArrowRight className="w-3.5 h-3.5 -mr-0.5 opacity-80" />
            </button>

            <button
              type="button"
              id="hero-explore-story-button"
              onClick={onSelectStory}
              className="px-6 py-2.5 btn-secondary text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <BookHeart className="w-4 h-4 text-violet-400" />
              <span>Create a Story Keepsake</span>
            </button>
          </div>

          {/* Trust Statement */}
          <div className="pt-2 flex items-center justify-center lg:justify-start gap-2 text-xs text-slate-400 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Powered by hosted, open-weight Gemma 4 AI.</span>
          </div>
        </div>

        {/* Right Column: Indian Cultural Artwork & Keepsake Silhouette Panel */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-sm sm:max-w-md p-3 sm:p-5 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] shadow-2xl backdrop-blur-sm">
            {/* Subtle top pill accent */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Heritage AI Studio
              </span>
              <span className="text-slate-500 font-mono">Gemma 4 • Keepsake</span>
            </div>

            <IndianHeritageArtwork className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

