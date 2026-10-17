"use client";

import React from "react";

/**
 * Architectural silhouette showcasing India Gate, Taj Mahal, and Lotus Temple
 * as a tasteful, editorial line-art backdrop.
 * Designed specifically for dark mode with subtle glowing amber & violet strokes.
 */
export function IndianLandmarkSilhouette({
  className = "w-full h-auto text-amber-500/20",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1200 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="landmarkGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="25%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="sunAura" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle warm halo behind central heritage monument */}
      <circle cx="600" cy="180" r="160" fill="url(#sunAura)" />

      {/* Ground Horizon Line */}
      <path
        d="M0 318 L1200 318"
        stroke="url(#landmarkGlow)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* LEFT SECTION: India Gate (Monumental Arc of Triumph) */}
      <g stroke="url(#landmarkGlow)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Base steps */}
        <path d="M120 318 L120 310 L280 310 L280 318" />
        <path d="M130 310 L130 304 L270 304 L270 310" />
        {/* Main pillars */}
        <path d="M140 304 L140 180 L180 180 L180 304" />
        <path d="M220 304 L220 180 L260 180 L260 304" />
        {/* Central Arch */}
        <path d="M180 304 L180 230 C180 200, 220 200, 220 230 L220 304" />
        {/* Inner small arch decoration */}
        <path d="M188 304 L188 238 C188 214, 212 214, 212 238 L212 304" strokeDasharray="3 3" opacity="0.6" />
        {/* Arch keystone and cornice */}
        <path d="M135 180 L265 180 L265 168 L135 168 Z" />
        {/* Upper tier pillars & relief */}
        <path d="M145 168 L145 140 L255 140 L255 168" />
        <path d="M165 168 L165 140" strokeDasharray="2 2" />
        <path d="M235 168 L235 140" strokeDasharray="2 2" />
        {/* Top attic & bowl pavilion */}
        <path d="M138 140 L262 140 L262 128 L138 128 Z" />
        <path d="M185 128 L185 116 L215 116 L215 128 Z" />
        <path d="M190 116 C190 110, 210 110, 210 116" />
      </g>

      {/* CENTER SECTION: Taj Mahal (Symmetrical Dome, Chhatris & Minarets) */}
      <g stroke="url(#landmarkGlow)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Plinth */}
        <path d="M420 318 L420 306 L780 306 L780 318" />
        <path d="M440 306 L440 300 L760 300 L760 306" />

        {/* Far Left Minaret */}
        <path d="M435 300 L445 140 L455 300" />
        <path d="M438 240 L452 240" />
        <path d="M440 185 L450 185" />
        {/* Minaret Cupola */}
        <path d="M441 140 C441 128, 449 128, 449 140 Z" />
        <path d="M445 128 L445 120" />

        {/* Far Right Minaret */}
        <path d="M745 300 L755 140 L765 300" />
        <path d="M748 240 L762 240" />
        <path d="M750 185 L760 185" />
        {/* Minaret Cupola */}
        <path d="M751 140 C751 128, 759 128, 759 140 Z" />
        <path d="M755 128 L755 120" />

        {/* Main Mausoleum Structure */}
        <path d="M490 300 L490 200 L710 200 L710 300" />
        {/* Cut corners (Chamfered octagonal plan) */}
        <path d="M490 220 L510 200" />
        <path d="M710 220 L690 200" />

        {/* Grand Iwan (Central Arch Portal) */}
        <path d="M560 300 L560 220 C560 195, 640 195, 640 220 L640 300" />
        {/* Inner pointed cusp of the Iwan */}
        <path d="M575 300 L575 235 C575 215, 625 215, 625 235 L625 300" strokeDasharray="3 3" opacity="0.6" />
        <path d="M588 300 L588 255 C588 245, 612 245, 612 255 L612 300" />

        {/* Left Double-tier side niches */}
        <path d="M510 295 L510 260 C510 250, 535 250, 535 260 L535 295" />
        <path d="M510 245 L510 215 C510 208, 535 208, 535 215 L535 245" />

        {/* Right Double-tier side niches */}
        <path d="M665 295 L665 260 C665 250, 690 250, 690 260 L690 295" />
        <path d="M665 245 L665 215 C665 208, 690 208, 690 215 L690 245" />

        {/* Left Chhatri (Rooftop Pavilion) */}
        <path d="M525 200 L525 180 L545 180 L545 200" />
        <path d="M520 180 C520 168, 550 168, 550 180 Z" />
        <path d="M535 168 L535 160" />

        {/* Right Chhatri (Rooftop Pavilion) */}
        <path d="M655 200 L655 180 L675 180 L675 200" />
        <path d="M650 180 C650 168, 680 168, 680 180 Z" />
        <path d="M665 168 L665 160" />

        {/* Central Bulbous Onion Dome & Lotus Finial */}
        <path d="M565 200 C565 180, 550 155, 600 120 C650 155, 635 180, 635 200" />
        {/* Finial / Kalash */}
        <path d="M600 120 L600 95" strokeWidth="1.5" />
        <circle cx="600" cy="100" r="2.5" />
        <path d="M595 105 C595 103, 605 103, 605 105" />
      </g>

      {/* RIGHT SECTION: Lotus Temple / Hawa Mahal Stylized Arch Accents */}
      <g stroke="url(#landmarkGlow)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Lotus Petal Array */}
        <path d="M960 318 C960 270, 1010 220, 1020 190 C1030 220, 1080 270, 1080 318" />
        {/* Inner Petals */}
        <path d="M980 318 C980 280, 1015 240, 1020 210 C1025 240, 1060 280, 1060 318" />
        <path d="M1000 318 C1000 290, 1018 260, 1020 230 C1022 260, 1040 290, 1040 318" />
        {/* Flanking Petals */}
        <path d="M935 318 C945 285, 975 260, 1000 250 C985 275, 970 300, 960 318" />
        <path d="M1105 318 C1095 285, 1065 260, 1040 250 C1055 275, 1070 300, 1080 318" />

        {/* Delicate Gateway/Archway Accents on far right */}
        <path d="M860 318 L860 240 C860 225, 880 215, 895 215 C910 215, 930 225, 930 240 L930 318" />
        <path d="M875 318 L875 250 C875 240, 885 235, 895 235 C905 235, 915 240, 915 250 L915 318" strokeDasharray="2 2" opacity="0.6" />
      </g>

      {/* Subtle star / diaspora constellation dots */}
      <circle cx="200" cy="80" r="1" fill="#f59e0b" opacity="0.5" />
      <circle cx="350" cy="110" r="1.5" fill="#f59e0b" opacity="0.4" />
      <circle cx="500" cy="70" r="1" fill="#8b5cf6" opacity="0.6" />
      <circle cx="700" cy="65" r="1.5" fill="#f59e0b" opacity="0.5" />
      <circle cx="850" cy="100" r="1" fill="#8b5cf6" opacity="0.4" />
      <circle cx="1050" cy="85" r="1.5" fill="#f59e0b" opacity="0.6" />
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
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-amber-500/30" />
      <div className="flex items-center gap-1.5 text-amber-400/50">
        <span className="w-1.5 h-1.5 rotate-45 border border-current" />
        <HeritageArch className="w-4 h-4 text-amber-400/70" />
        <span className="w-1.5 h-1.5 rotate-45 border border-current" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-500/20 to-violet-500/30" />
    </div>
  );
}
