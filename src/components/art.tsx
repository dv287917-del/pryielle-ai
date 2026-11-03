/** Pryielle AI starburst logo (orange) */
export function Burst({ size = 64, className = "" }: { size?: number; className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className={className} aria-hidden="true">
      {rays.map((a, i) => (
        <line
          key={a}
          x1="0"
          y1={-(8 + (i % 3) * 2)}
          x2="0"
          y2={-(40 - (i % 2) * 8)}
          stroke="#d97757"
          strokeWidth="5"
          strokeLinecap="round"
          transform={`rotate(${a + (i % 2) * 6})`}
        />
      ))}
    </svg>
  );
}

/** Sign-in hero illustration: orange node-graph + white hand-drawn line */
export function Hero() {
  const o = "#d97757";
  return (
    <svg viewBox="0 0 480 500" className="hero" aria-hidden="true">
      <g stroke={o} strokeLinecap="round" fill="none">
        <path d="M107 58 L165 180" strokeWidth="14" />
        <path d="M182 32 L170 178" strokeWidth="10" />
        <path d="M165 180 L238 170 L440 153" strokeWidth="9" />
        <path d="M165 180 L35 265" strokeWidth="14" />
        <path d="M165 185 L190 260 L440 160" strokeWidth="9" />
        <path d="M120 215 L190 260" strokeWidth="9" />
      </g>
      <g fill={o}>
        <circle cx="107" cy="58" r="28" />
        <circle cx="182" cy="32" r="28" />
        <circle cx="165" cy="180" r="26" />
        <circle cx="238" cy="170" r="26" />
        <circle cx="440" cy="153" r="30" />
        <circle cx="38" cy="262" r="26" />
        <circle cx="190" cy="262" r="24" />
      </g>
      <g stroke="#fbf9f4" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M430 27 C380 30 350 55 340 100 C330 140 305 160 325 200 C345 245 360 255 400 262 C455 275 470 320 445 372 C420 430 370 478 330 478 C275 478 238 440 230 380 C224 335 226 300 224 280" />
        <path d="M8 365 C14 330 22 300 40 270" />
        <path d="M72 352 C78 322 88 296 104 278" />
        <path d="M120 342 C124 322 132 302 148 292" />
        <path d="M188 325 C190 295 210 280 224 300 C232 340 214 366 188 360" />
      </g>
    </svg>
  );
}

export const GoogleG = () => (
  <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export const MenuIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="#e8e4da" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 9h22M4 15h15M4 21h8" />
  </svg>
);

export const GhostIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 28V15a10 10 0 0 1 20 0v13l-3.5-3-3.3 3-3.2-3-3.2 3-3.3-3z" />
    <circle cx="12.5" cy="15" r=".8" fill="#fff" />
    <circle cx="19.5" cy="15" r=".8" fill="#fff" />
  </svg>
);

export const PlusIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M15 5v20M5 15h20" />
  </svg>
);

export const MicIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#e8e4da" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="2.5" width="8" height="13" rx="4" />
    <path d="M4.5 12.5a8.5 8.5 0 0 0 17 0M13 21v3" />
  </svg>
);

export const WaveIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 15h.01M11 11v8M15.5 6v18M20 10v10M25 15h.01" />
  </svg>
);

export const ArrowUpIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 22V6M7 13l7-7 7 7" />
  </svg>
);

export const StopIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="#e8e4da" aria-hidden="true">
    <rect x="4" y="4" width="14" height="14" rx="3" />
  </svg>
);

export const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#9a968c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
  </svg>
);
