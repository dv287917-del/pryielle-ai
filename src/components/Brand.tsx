import type { CSSProperties } from "react";

/** IronRoses emblem: a polished steel-blue rose (replaces the old bucket / ghost art). */
export function IronRose({ className, style }: { className?: string; style?: CSSProperties }) {
  const outer = [0, 60, 120, 180, 240, 300];
  const mid = [30, 102, 174, 246, 318];
  const inner = [0, 90, 180, 270];
  const petal = "M100 104 C58 84 60 22 100 10 C140 22 142 84 100 104Z";
  const petalM = "M100 104 C70 90 72 44 100 34 C128 44 130 90 100 104Z";
  const petalI = "M100 104 C84 94 86 66 100 58 C114 66 116 94 100 104Z";
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="ir-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f8ff" /><stop offset="0.45" stopColor="#8fb8ff" /><stop offset="1" stopColor="#1f4fd8" />
        </linearGradient>
        <linearGradient id="ir-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#6fa2ff" /><stop offset="1" stopColor="#1638a8" />
        </linearGradient>
        <radialGradient id="ir-c" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#a9c8ff" /><stop offset="1" stopColor="#2f63e6" />
        </radialGradient>
        <linearGradient id="ir-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="0.5" stopColor="#9db4d8" stopOpacity="0.5" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
        <filter id="ir-sh" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0a2a8a" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="92" fill="none" stroke="url(#ir-ring)" strokeWidth="1.6" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="1 7" strokeLinecap="round" />
      <g filter="url(#ir-sh)">
        {outer.map((r) => <path key={`o${r}`} d={petal} fill="url(#ir-a)" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" transform={`rotate(${r} 100 100)`} />)}
        {mid.map((r) => <path key={`m${r}`} d={petalM} fill="url(#ir-b)" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" transform={`rotate(${r} 100 100)`} />)}
        {inner.map((r) => <path key={`i${r}`} d={petalI} fill="url(#ir-a)" stroke="#fff" strokeOpacity="0.7" strokeWidth="1" transform={`rotate(${r + 45} 100 100)`} />)}
        <circle cx="100" cy="100" r="11" fill="url(#ir-c)" stroke="#fff" strokeOpacity="0.8" strokeWidth="1" />
        <path d="M94 96 C98 90 106 90 108 96" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden="true">
      <path d="M20 0 C21.5 12 28 18.5 40 20 C28 21.5 21.5 28 20 40 C18.5 28 12 21.5 0 20 C12 18.5 18.5 12 20 0Z" fill="#fff" />
    </svg>
  );
}

/** Deep-blue → white premium gradient with glow orbs (Boot / Auth / Start / Setup). */
export function BlueBg({ fadeToWhite = true }: { fadeToWhite?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: fadeToWhite ? "linear-gradient(180deg,#0a2fb8 0%,#0a4be0 30%,#2f7bff 52%,#cfe0ff 78%,#ffffff 100%)" : "linear-gradient(180deg,#071a66 0%,#0a3bc9 55%,#1d5cf0 100%)" }} />
      <div className="glow-orb absolute -left-24 top-[8%] size-72 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="glow-orb late absolute -right-28 top-[26%] size-80 rounded-full bg-indigo-400/50 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />
    </div>
  );
}

/** YouTube-style rounded play glyph for the dock (replaces the old reels icon). */
export function TubeIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="4.5" />
      <path d="M10 9.2v5.6l4.9-2.8z" fill="currentColor" />
    </svg>
  );
}
