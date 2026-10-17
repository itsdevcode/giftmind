import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090c13",
};

export const metadata: Metadata = {
  title: "GiftMind — Turn Memories Into Meaningful Gifts",
  description:
    "Discover personalized gift ideas or turn your favorite shared memories into an authentic keepsake story powered by hosted Gemma 4 AI.",
  keywords: [
    "GiftMind",
    "AI Gifts",
    "Story Keepsake",
    "Personalized Gifts",
    "Memory Keepsake",
    "Gemma 4",
  ],
  authors: [{ name: "GiftMind Contributors" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#090c13] text-[#f3f4f6] antialiased">
        {children}
      </body>
    </html>
  );
}
