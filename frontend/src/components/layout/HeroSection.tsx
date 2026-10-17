import Image from "next/image";
import { Gift, BookHeart, ShieldCheck, ArrowRight } from "lucide-react";
import { HeritageArch, LotusFlowerPattern, MandalaAccent } from "@/components/illustrations/CulturalMotifs";

interface HeroSectionProps {
  onSelectGifts: () => void;
  onSelectStory: () => void;
}

export function HeroSection({
  onSelectGifts,
  onSelectStory,
}: HeroSectionProps) {
  return (
    <section className="relative w-full overflow-hidden pt-12 sm:pt-16 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 text-center border-b border-white/[0.06]">
      {/* Full-width Background Image with seamless dark luxury blending */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none select-none">
        <Image
          src="/images/incredible_india_heritage.png"
          alt="Incredible India cultural heritage background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-25 filter blur-[0.5px] scale-105"
        />

        {/* Multi-layered dark gradient blend masks so text is 100% crisp and readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090c13] via-[#090c13]/70 to-[#090c13]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090c13] via-transparent to-[#090c13]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.12)_0%,rgba(9,12,19,0.85)_65%,#090c13_100%)]" />
      </div>

      {/* Decorative Floral & Mandala Corner Accents */}
      <div className="pointer-events-none absolute -left-12 -top-12 opacity-15 text-amber-400 -z-10">
        <MandalaAccent className="w-56 h-56" />
      </div>
      <div className="pointer-events-none absolute -right-12 -top-12 opacity-15 text-violet-400 -z-10">
        <MandalaAccent className="w-56 h-56" />
      </div>
      <div className="pointer-events-none absolute left-6 bottom-4 opacity-20 text-amber-400 -z-10 hidden sm:block">
        <LotusFlowerPattern className="w-24 h-24" />
      </div>
      <div className="pointer-events-none absolute right-6 bottom-4 opacity-20 text-amber-400 -z-10 hidden sm:block">
        <LotusFlowerPattern className="w-24 h-24" />
      </div>

      {/* Hero Content Stack */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-5">
        {/* Eyebrow Pill Badge with Lotus Motif */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 border border-amber-400/30 text-amber-300 backdrop-blur-md shadow-lg shadow-amber-950/20">
          <LotusFlowerPattern className="w-4 h-4 text-amber-400" />
          <span>AI Gifting &amp; Memory Keepsakes</span>
          <span className="w-1 h-1 rounded-full bg-amber-400 opacity-60" />
          <span className="text-amber-200/80">Indian Cultural Edition</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.16] font-sans">
          A thoughtful gift starts with a{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-violet-300 bg-clip-text text-transparent">
            meaningful connection.
          </span>
        </h1>

        {/* Subheading */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-200 font-normal leading-relaxed drop-shadow-sm">
          Discover personalized gift ideas and turn shared memories into beautiful keepsakes they&apos;ll treasure.
        </p>

        {/* Primary and Secondary CTA Button Group */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3.5">
          <button
            type="button"
            id="hero-create-gift-button"
            onClick={onSelectGifts}
            className="px-7 py-3 btn-primary text-sm font-semibold flex items-center gap-2.5 cursor-pointer shadow-xl shadow-amber-500/25 hover:shadow-amber-500/35"
          >
            <Gift className="w-4 h-4" />
            <span>Create a Gift</span>
            <ArrowRight className="w-4 h-4 -mr-0.5 opacity-80" />
          </button>

          <button
            type="button"
            id="hero-explore-story-button"
            onClick={onSelectStory}
            className="px-7 py-3 btn-secondary text-sm font-medium flex items-center gap-2.5 cursor-pointer hover:border-violet-400/40 hover:bg-violet-950/30 backdrop-blur-md"
          >
            <BookHeart className="w-4 h-4 text-violet-400" />
            <span>Create a Story Keepsake</span>
          </button>
        </div>

        {/* Trust Statement */}
        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-300 font-normal">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>Powered by hosted, open-weight Gemma 4 AI.</span>
        </div>
      </div>
    </section>
  );
}

