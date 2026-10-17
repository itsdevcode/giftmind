import Image from "next/image";
import { Gift, BookHeart, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { HeritageArch } from "@/components/illustrations/CulturalMotifs";

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

        {/* Right Column: Cultural Heritage Illustration Showcase Panel */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-sm sm:max-w-md rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-1.5 sm:p-2 border border-amber-500/25 shadow-2xl shadow-amber-950/30 backdrop-blur-md group">
            {/* Ambient card back glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-violet-600/15 to-amber-500/10 rounded-2xl blur-lg -z-10 opacity-70 group-hover:opacity-100 transition-opacity" />

            {/* Inner Header Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-t-xl bg-[#0b0f17]/80 border-b border-white/[0.06] text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5 font-medium text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Cultural Heritage &amp; Keepsakes
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
                Gemma 4 AI
              </span>
            </div>

            {/* Artwork Frame */}
            <div className="relative overflow-hidden rounded-b-xl border border-white/[0.05] bg-[#080b12] aspect-[1024/372]">
              <Image
                src="/images/incredible_india_heritage.png"
                alt="Incredible India cultural heritage illustration featuring decorated ceremonial elephant, Taj Mahal, Red Fort, India Gate, and Qutub Minar"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 420px"
                className="object-cover rounded-b-xl transform group-hover:scale-[1.02] transition-transform duration-500"
              />
              {/* Subtle luxury gradient vignette overlay for seamless dark theme harmony */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090c13]/70 via-transparent to-black/10" />
              
              {/* Floating caption chip */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="text-[10px] font-medium text-amber-100 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                  Celebrations • Milestones • Memories
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

