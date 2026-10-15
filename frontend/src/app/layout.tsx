import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "GiftMind — Turn Memories Into Meaningful Gifts",
  description:
    "Discover thoughtful gift ideas and create personalized stories inspired by the people and memories that matter most.",
  keywords: [
    "GiftMind",
    "AI Gifts",
    "Memories",
    "Keepsakes",
    "Personalized Gifts",
    "Storytelling",
  ],
  authors: [{ name: "GiftMind Contributors" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 antialiased selection:bg-purple-600 selection:text-white">
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#090d16]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a
              href="/"
              id="brand-logo"
              className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                ✨
              </div>
              <span>GiftMind</span>
            </a>

            <nav aria-label="Main Navigation" className="flex items-center gap-6">
              <a
                href="#features"
                id="nav-link-features"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#architecture"
                id="nav-link-architecture"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Architecture
              </a>
              <a
                href="https://github.com/itsdevcode/giftmind"
                target="_blank"
                rel="noopener noreferrer"
                id="nav-link-github"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full border border-white/10 hover:border-white/20 bg-white/5 transition-all"
              >
                <span>GitHub</span>
                <span className="text-xs text-purple-400 font-mono">v0.1.0</span>
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-white/10 bg-black/40 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 GiftMind Open Source. Turn Memories Into Meaningful Gifts.</p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Phase 1: Foundation Ready
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
