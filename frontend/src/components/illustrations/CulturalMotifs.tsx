"use client";

import React from "react";

/**
 * Traditional Indian Lotus & Floral ornamental motif (Kamal / Floral Paisley)
 */
export function LotusFlowerPattern({
  className = "w-16 h-16 text-amber-400",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lotusGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#lotusGlow)" opacity="0.3" />

      {/* Central Lotus Petal */}
      <path
        d="M 50 15 C 44 32, 44 58, 50 78 C 56 58, 56 32, 50 15 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.1"
      />

      {/* Left Petals */}
      <path
        d="M 50 78 C 36 68, 25 50, 32 30 C 42 42, 46 62, 50 78 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M 50 78 C 28 72, 14 58, 18 42 C 28 50, 42 66, 50 78 Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.8"
      />

      {/* Right Petals */}
      <path
        d="M 50 78 C 64 68, 75 50, 68 30 C 58 42, 54 62, 50 78 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M 50 78 C 72 72, 86 58, 82 42 C 72 50, 58 66, 50 78 Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.8"
      />

      {/* Floating Dewdrop / Bindi Accent */}
      <circle cx="50" cy="28" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="50" cy="85" r="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/**
 * Traditional Indian Jali (latticework) & Arch motif for card headers,
 * dividers, or empty states.
 */
export function HeritageArch({
  className = "w-6 h-6 text-amber-400",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 28V14C6 8.5 10.5 4 16 4C21.5 4 26 8.5 26 14V28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Cusped multi-foil inner arch */}
      <path
        d="M9 28V15C9 12 11 10 13 10C14.5 10 15.5 11 16 12C16.5 11 17.5 10 19 10C21 10 23 12 23 15V28"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Keystoned Lotus Finial */}
      <path
        d="M16 1.5L16 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="18" r="1.2" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

/**
 * Rangoli / Mandala geometric ornamental accent for gift discovery,
 * empty states, and section anchors.
 */
export function MandalaAccent({
  className = "w-12 h-12 text-amber-500/30",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer concentric rings */}
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
      
      {/* 8-Petal Geometric Flower */}
      <circle cx="32" cy="18" r="7" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <circle cx="32" cy="46" r="7" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <circle cx="18" cy="32" r="7" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <circle cx="46" cy="32" r="7" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      
      {/* Diagonal diamonds */}
      <rect
        x="26"
        y="26"
        width="12"
        height="12"
        stroke="currentColor"
        strokeWidth="1"
        transform="rotate(45 32 32)"
      />
      <circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/**
 * Tasteful cultural divider ribbon with subtle geometric rangoli diamonds
 */
export function CulturalDivider({
  className = "w-full my-6",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/25 to-amber-500/35" />
      <div className="flex items-center gap-2 text-amber-400/70">
        <span className="w-1.5 h-1.5 rotate-45 border border-current opacity-70" />
        <LotusFlowerPattern className="w-5 h-5 text-amber-400" />
        <span className="w-1.5 h-1.5 rotate-45 border border-current opacity-70" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-500/25 to-violet-500/35" />
    </div>
  );
}
