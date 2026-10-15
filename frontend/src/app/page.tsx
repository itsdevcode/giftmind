"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth, API_BASE_URL, type HealthCheckResponse } from "@/lib/api";

export default function HomePage() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  useEffect(() => {
    let isMounted = true;
    checkBackendHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setHealthStatus("connected");
        }
      })
      .catch(() => {
        if (isMounted) {
          setHealthStatus("disconnected");
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        {/* Glow ambient background effects */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -top-40 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#9333ea] to-[#4f46e5] opacity-25"></div>
        </div>

        {/* Phase Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-8">
          <span>🚀 Phase 1 Foundation</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-300">Hacktoberfest 2026 Week 2</span>
        </div>

        {/* Main Title & Tagline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6">
          GiftMind
        </h1>
        <p className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 bg-clip-text text-transparent mb-6">
          Turn Memories Into Meaningful Gifts.
        </p>

        {/* Description */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed mb-10">
          Discover thoughtful gift ideas and create personalized stories inspired by the
          people and memories that matter most.
        </p>

        {/* Call-to-Action with Honest Upcoming Feature State */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <button
            id="cta-create-gift"
            type="button"
            disabled
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-purple-600/50 text-purple-200 font-medium text-sm border border-purple-500/30 cursor-not-allowed shadow-inner transition-colors"
          >
            <span>Create a Gift</span>
            <span className="text-xs bg-purple-900/80 px-2 py-0.5 rounded text-purple-300 border border-purple-400/20 font-mono">
              Coming in Phase 2
            </span>
          </button>

          <a
            id="cta-explore-docs"
            href="https://github.com/itsdevcode/giftmind#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-medium text-sm border border-white/10 hover:border-white/20 transition-all"
          >
            View Architecture Docs
          </a>
        </div>

        {/* API Connection Smoke Status Card */}
        <div className="mt-14 max-w-lg mx-auto p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-sm text-left shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              System Health & Connectivity
            </span>
            <span className="font-mono text-[11px] text-slate-500">{API_BASE_URL}</span>
          </div>

          <div className="pt-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  healthStatus === "connected"
                    ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                    : healthStatus === "checking"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-slate-200 font-medium">FastAPI Backend:</span>
              <span className="font-mono text-xs text-slate-300">
                {healthStatus === "connected" && health
                  ? `${health.service} (${health.status})`
                  : healthStatus === "checking"
                  ? "Verifying connection..."
                  : "Offline / Waiting for API"}
              </span>
            </div>

            <span className="text-xs font-mono text-purple-400">GET /health</span>
          </div>
        </div>
      </section>

      {/* Feature & Architecture Highlights */}
      <section id="features" className="py-16 border-t border-white/5 bg-slate-950/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white tracking-tight">Platform Roadmap</h2>
            <p className="text-slate-400 text-sm mt-2">
              Clean separation of current production foundation versus planned AI modules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Phase 1 (Active)
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Core Foundation</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  FastAPI backend with async SQLAlchemy 2.x, PostgreSQL pooling, Alembic async
                  migrations, and Next.js 14 App Router.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-500/10 text-xs text-emerald-300 font-mono">
                Status: Completed & Tested
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-3 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Phase 2 (Upcoming)
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Memory & Gift Engine</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Memory ingestion, preference vectors, and AI-powered gift recommendations
                  powered by open-weight models.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-500 font-mono">
                Status: In Design
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-3 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Phase 3 (Upcoming)
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Storytelling & Keepsakes</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Transform curated memories into personalized narrative keepsakes with printable
                  PDF rendering and digital exports.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-500 font-mono">
                Status: Planned
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
