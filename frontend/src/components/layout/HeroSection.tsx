"use client";

import { Gift, BookHeart, ShieldCheck } from "lucide-react";
import { IndianLandmarkSilhouette, HeritageArch } from "@/components/illustrations/CulturalMotifs";

interface HeroSectionProps {
  onSelectGifts: () => void;
  onSelectStory: () => void;
}

export function HeroSection({
  onSelectGifts,
  onSelectStory,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-10 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-center">
      {/* Decorative ambient gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-28 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl opacity-20"
      >
        <div className="aspect-[1155/678] w-[64rem] bg-gradient-to-tr from-amber-500/40 via-violet-600/30 to-amber-600/30" />
      </div>

      {/* Subtle cultural landmark illustration in background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-30 select-none overflow-hidden max-h-48"
      >
        <IndianLandmarkSilhouette className="w-full max-w-4xl text-amber-500/25" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 space-y-5 max-w-3xl mx-auto">
        {/* Subtle Cultural Tagline Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-300">
          <HeritageArch className="w-3.5 h-3.5 text-amber-400" />
          <span>Thoughtful Gifting &amp; Keepsakes</span>
        </div>

        {/* Brand Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.15]">
          A thoughtful gift starts with a{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-violet-300 bg-clip-text text-transparent">
            meaningful connection.
          </span>
        </h1>

        {/* Subheading */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
          Discover personalized gift ideas and turn shared memories into beautiful keepsakes they&apos;ll treasure.
        </p>

        {/* Primary and secondary CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <button
            type="button"
            id="hero-create-gift-button"
            onClick={onSelectGifts}
            className="px-6 py-3 btn-primary flex items-center gap-2.5 text-sm font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 cursor-pointer"
          >
            <Gift className="w-4 h-4" />
            <span>Create a Gift</span>
          </button>

          <button
            type="button"
            id="hero-explore-story-button"
            onClick={onSelectStory}
            className="px-6 py-3 btn-secondary flex items-center gap-2.5 text-sm font-semibold hover:border-violet-500/40 hover:bg-violet-950/20 cursor-pointer"
          >
            <BookHeart className="w-4 h-4 text-violet-400" />
            <span>Create a Story Keepsake</span>
          </button>
        </div>

        {/* Accurate Trust Statement (explicit requirement: open-weight Gemma 4 AI, no local claims) */}
        <div className="pt-3 flex items-center justify-center gap-2 text-xs text-slate-400 font-normal">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Powered by hosted, open-weight Gemma 4 AI.</span>
        </div>
      </div>
    </section>
  );
}

