"use client";

import React from "react";

/**
 * Editorial, high-fidelity Indian landmark composition:
 * Featuring Taj Mahal, India Gate, Lotus Temple, and Qutub Minar silhouette.
 * Rendered as an intentional, artistic visual artwork for the hero panel.
 */
export function IndianHeritageArtwork({
  className = "w-full h-auto",
}: {
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Outer ambient glow frame */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-violet-600/10 to-amber-500/5 rounded-2xl blur-xl -z-10" />

      <svg
        viewBox="0 0 560 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="artGoldGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#fbbf24" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.5" />
          </linearGradient>

          <linearGradient id="subtleStroke" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
          </linearGradient>

          <radialGradient id="monumentMoon" cx="50%" cy="35%" r="45%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#151b2b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0b0f17" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Ambient Moon Aura */}
        <circle cx="280" cy="170" r="140" fill="url(#monumentMoon)" />

        {/* Decorative Constellation Stars */}
        <circle cx="90" cy="80" r="1.5" fill="#fde68a" opacity="0.6" />
        <circle cx="160" cy="50" r="2" fill="#fbbf24" opacity="0.8" />
        <circle cx="280" cy="30" r="2.5" fill="#fde68a" opacity="0.9" />
        <circle cx="400" cy="55" r="2" fill="#a78bfa" opacity="0.75" />
        <circle cx="480" cy="95" r="1.5" fill="#fde68a" opacity="0.6" />

        {/* Framing Arch Silhouette (Traditional Jharokha / Gateway Frame) */}
        <path
          d="M 50 350 V 160 C 50 90, 160 50, 280 50 C 400 50, 510 90, 510 160 V 350"
          stroke="url(#artGoldGlow)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity="0.4"
        />
        <path
          d="M 70 350 V 170 C 70 115, 170 70, 280 70 C 390 70, 490 115, 490 170 V 350"
          stroke="url(#artGoldGlow)"
          strokeWidth="0.8"
          opacity="0.25"
        />

        {/* Ground Platform Horizon */}
        <path d="M 30 350 H 530" stroke="url(#artGoldGlow)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 60 356 H 500" stroke="#f59e0b" strokeWidth="0.8" opacity="0.4" />

        {/* LEFT MONUMENT: Qutub Minar & India Gate Facet */}
        <g stroke="url(#artGoldGlow)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* India Gate Base & Portal */}
          <path d="M 80 350 V 220 H 170 V 350" />
          <path d="M 95 350 V 230 H 155 V 350" strokeDasharray="3 3" opacity="0.5" />
          {/* Main Archway */}
          <path d="M 105 350 V 270 C 105 245, 145 245, 145 270 V 350" />
          {/* Attic & Cornice */}
          <path d="M 75 220 H 175 V 205 H 75 Z" />
          <path d="M 95 205 V 190 H 155 V 205" />
          <path d="M 115 190 C 115 180, 135 180, 135 190" />

          {/* Slender Minaret in background */}
          <path d="M 60 350 L 68 150 L 76 350" opacity="0.6" strokeWidth="0.9" />
          <line x1="63" y1="280" x2="73" y2="280" opacity="0.6" />
          <line x1="65" y1="210" x2="71" y2="210" opacity="0.6" />
          <circle cx="68" cy="148" r="2" fill="#fbbf24" opacity="0.8" />
        </g>

        {/* CENTER ICONIC MONUMENT: Taj Mahal Symphony */}
        <g stroke="url(#artGoldGlow)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {/* Plinth */}
          <path d="M 180 350 V 335 H 380 V 350" />

          {/* Left Taj Minaret */}
          <path d="M 195 335 L 202 180 L 209 335" />
          <line x1="197" y1="275" x2="207" y2="275" />
          <line x1="199" y1="225" x2="205" y2="225" />
          {/* Minaret Dome & Kalash */}
          <path d="M 199 180 C 199 170, 205 170, 205 180 Z" fill="#fbbf24" fillOpacity="0.2" />
          <line x1="202" y1="170" x2="202" y2="162" />

          {/* Right Taj Minaret */}
          <path d="M 351 335 L 358 180 L 365 335" />
          <line x1="353" y1="275" x2="363" y2="275" />
          <line x1="355" y1="225" x2="361" y2="225" />
          {/* Minaret Dome & Kalash */}
          <path d="M 355 180 C 355 170, 361 170, 361 180 Z" fill="#fbbf24" fillOpacity="0.2" />
          <line x1="358" y1="170" x2="358" y2="162" />

          {/* Main Mausoleum Base */}
          <path d="M 225 335 V 235 L 240 220 H 320 L 335 235 V 335" />

          {/* Central Grand Iwan Arch */}
          <path d="M 252 335 V 255 C 252 232, 308 232, 308 255 V 335" />
          {/* Multi-foil inner arch */}
          <path d="M 262 335 V 270 C 262 252, 298 252, 298 270 V 335" strokeDasharray="2 2" opacity="0.6" />

          {/* Side Niches Double Deck */}
          <path d="M 233 330 V 295 C 233 288, 247 288, 247 295 V 330" />
          <path d="M 233 285 V 255 C 233 250, 247 250, 247 255 V 285" />

          <path d="M 313 330 V 295 C 313 288, 327 288, 327 295 V 330" />
          <path d="M 313 285 V 255 C 313 250, 327 250, 327 255 V 285" />

          {/* Left Chhatri */}
          <path d="M 245 220 V 205 H 257 V 220" />
          <path d="M 243 205 C 243 194, 259 194, 259 205 Z" fill="#fbbf24" fillOpacity="0.15" />
          <line x1="251" y1="194" x2="251" y2="186" />

          {/* Right Chhatri */}
          <path d="M 303 220 V 205 H 315 V 220" />
          <path d="M 301 205 C 301 194, 317 194, 317 205 Z" fill="#fbbf24" fillOpacity="0.15" />
          <line x1="309" y1="194" x2="309" y2="186" />

          {/* Central Bulbous Onion Dome with soft fill */}
          <path
            d="M 260 220 C 260 198, 248 165, 280 135 C 312 165, 300 198, 300 220"
            fill="#fbbf24"
            fillOpacity="0.12"
          />
          {/* Finial / Brass Kalash Spike */}
          <line x1="280" y1="135" x2="280" y2="105" strokeWidth="1.8" />
          <circle cx="280" cy="112" r="3" fill="#fbbf24" />
          <circle cx="280" cy="122" r="2" fill="#fbbf24" />
        </g>

        {/* RIGHT SECTION: Lotus Temple Petal Sculpture */}
        <g stroke="url(#artGoldGlow)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Outer Petals */}
          <path d="M 400 350 C 400 300, 440 240, 455 210 C 470 240, 510 300, 510 350" />
          {/* Inner Layer */}
          <path d="M 420 350 C 420 310, 450 260, 455 230 C 460 260, 490 310, 490 350" />
          <path d="M 435 350 C 435 320, 452 280, 455 250 C 458 280, 475 320, 475 350" strokeDasharray="3 3" opacity="0.7" />
        </g>

        {/* Floating Keepsake Ribbon & Gift Sparkle Emblem Overlay */}
        <g transform="translate(230, 290)">
          {/* Small floating gift badge */}
          <rect
            x="0"
            y="0"
            width="100"
            height="36"
            rx="18"
            fill="url(#cardGrad)"
            stroke="url(#artGoldGlow)"
            strokeWidth="1"
            className="filter drop-shadow-md"
          />
          {/* Tiny Diya flame / Lotus icon */}
          <circle cx="24" cy="18" r="6" fill="#f59e0b" fillOpacity="0.25" />
          <path d="M 24 13 C 25 15, 27 18, 24 22 C 21 18, 23 15, 24 13 Z" fill="#fbbf24" />
          <text x="38" y="22" fill="#fde68a" fontSize="10.5" fontWeight="600" fontFamily="sans-serif">
            GiftMind
          </text>
        </g>
      </svg>
    </div>
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
      <div className="flex items-center gap-1.5 text-amber-400/60">
        <span className="w-1.5 h-1.5 rotate-45 border border-current opacity-70" />
        <HeritageArch className="w-4 h-4 text-amber-400" />
        <span className="w-1.5 h-1.5 rotate-45 border border-current opacity-70" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-500/25 to-violet-500/35" />
    </div>
  );
}
