import { useEffect, useState, type CSSProperties } from "react";
import { sfx } from "../lib/sfx";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function Witch({ className }: { className?: string }) {
  const [lunge, setLunge] = useState(false);
  const poke = () => {
    if (lunge) return;
    setLunge(true);
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    sfx.sting();
    window.setTimeout(() => void Haptics.vibrate({ duration: 120 }).catch(() => undefined), 260);
    window.setTimeout(() => setLunge(false), 950);
  };
  return (
    <svg viewBox="0 0 200 270" className={`${className ?? ""} spectre ${lunge ? "lunge" : ""}`} onPointerDown={poke} role="img" aria-label="bhoot">
      <defs>
        <radialGradient id="sp-face" cx="48%" cy="38%" r="68%">
          <stop offset="0" stopColor="#d6d9ce" />
          <stop offset="0.55" stopColor="#8d9389" />
          <stop offset="1" stopColor="#2a2c29" />
        </radialGradient>
        <radialGradient id="sp-socket" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="1" />
          <stop offset="0.7" stopColor="#050505" stopOpacity="0.92" />
          <stop offset="1" stopColor="#050505" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sp-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.62" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="sp-mask"><rect width="200" height="270" fill="url(#sp-fade)" /></mask>
        <filter id="sp-skin" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="9" result="m" />
          <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 1.1 -0.28" result="mm" />
          <feComposite in="mm" in2="d" operator="in" result="mc" />
          <feMerge><feMergeNode in="d" /><feMergeNode in="mc" /></feMerge>
        </filter>
        <filter id="sp-wisp" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
        </filter>
        <filter id="sp-soft"><feGaussianBlur stdDeviation="2.2" /></filter>
        <filter id="sp-glint" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g mask="url(#sp-mask)">
        {/* tattered wet shroud */}
        <g filter="url(#sp-wisp)">
          <path d="M52 150 Q100 182 148 150 L186 270 L14 270 Z" fill="#0b0809" />
          <path d="M70 168 C64 210 58 240 50 270 M100 176 C100 214 98 244 96 270 M130 168 C136 210 142 240 152 270" stroke="#241d22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
        {/* long wet hair, back layer */}
        <g className="hair-sway" style={{ transformOrigin: "100px 40px" }} filter="url(#sp-wisp)">
          <path d="M100 14 C34 14 8 92 20 160 C26 206 4 236 14 270 L186 270 C196 236 174 206 180 160 C192 92 166 14 100 14 Z" fill="#050304" />
          <path d="M36 110 C26 168 44 214 28 262 M58 120 C54 178 68 226 54 268 M164 110 C174 168 156 214 172 262 M142 120 C146 178 132 226 146 268" stroke="#2a2128" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
        </g>
        {/* head, tilted */}
        <g className="spectre-head" style={{ transformOrigin: "100px 130px" }}>
          <g filter="url(#sp-skin)">
            <ellipse cx="100" cy="98" rx="37" ry="51" fill="url(#sp-face)" />
            <ellipse cx="72" cy="112" rx="9" ry="20" fill="#14160f" opacity="0.5" filter="url(#sp-soft)" />
            <ellipse cx="128" cy="112" rx="9" ry="20" fill="#14160f" opacity="0.5" filter="url(#sp-soft)" />
            <path d="M82 56 C94 48 110 50 120 58" stroke="#3c3f39" strokeWidth="1.4" fill="none" opacity="0.5" />
            <path d="M88 70 L86 84 M112 68 L116 80" stroke="#4a2a2a" strokeWidth="0.8" fill="none" opacity="0.55" />
          </g>
          {/* deep hollow eye sockets */}
          <ellipse cx="84" cy="92" rx="14" ry="11" fill="url(#sp-socket)" />
          <ellipse cx="117" cy="92" rx="14" ry="11" fill="url(#sp-socket)" />
          <g className="eye-glow" filter="url(#sp-glint)">
            <ellipse cx="85" cy="93" rx="2.6" ry="2.2" fill="#e8d9cf" />
            <ellipse cx="116" cy="93" rx="2.6" ry="2.2" fill="#e8d9cf" />
            <circle cx="85" cy="93" r="1" fill="#a3070e" />
            <circle cx="116" cy="93" r="1" fill="#a3070e" />
          </g>
          {/* nose shadow */}
          <path d="M100 98 L96 116 Q100 119 104 116 Z" fill="#555b53" opacity="0.55" />
          {/* gaunt stretched mouth */}
          <path d="M80 130 Q100 142 121 130 Q100 164 80 130 Z" fill="#050203" />
          <path d="M80 130 Q100 140 121 130" stroke="#6a4a4a" strokeWidth="1" fill="none" opacity="0.8" />
          <path d="M86 134 L87 141 M93 137 L94 146 M101 138 L101 148 M108 137 L107 146 M115 134 L114 141" stroke="#c9c6b8" strokeWidth="1" opacity="0.55" />
        </g>
        {/* front hair strands over face */}
        <g className="hair-sway" style={{ transformOrigin: "100px 40px", animationDelay: "-1.4s" }} filter="url(#sp-wisp)">
          <path d="M68 52 C44 110 64 154 48 214" stroke="#050304" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M134 52 C158 110 138 154 154 214" stroke="#050304" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M96 40 C88 62 90 76 82 92" stroke="#050304" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
        </g>
        {/* long thin fingers */}
        <g stroke="#a9aea4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.88">
          <path d="M66 178 l-10 -16 l-4 -14 M72 180 l-5 -22 l-1 -16 M80 182 l-1 -24 l1 -16 M88 182 l5 -20 l3 -14" />
          <path d="M134 178 l10 -16 l4 -14 M128 180 l5 -22 l1 -16 M120 182 l1 -24 l-1 -16 M112 182 l-5 -20 l-3 -14" />
        </g>
      </g>
    </svg>
  );
}

export function Ghost({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 76" className={className} style={style} aria-hidden="true">
      <path d="M30 4 C14 4 6 18 6 34 L6 70 L14 62 L22 72 L30 62 L38 72 L46 62 L54 70 L54 34 C54 18 46 4 30 4 Z" fill="rgb(236 240 255 / 0.9)" />
      <ellipse cx="21" cy="30" rx="4.5" ry="6" fill="#120816" />
      <ellipse cx="39" cy="30" rx="4.5" ry="6" fill="#120816" />
      <ellipse cx="30" cy="46" rx="5" ry="7" fill="#120816" />
    </svg>
  );
}

export function Bat({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 30" className={className} style={style} aria-hidden="true">
      <path className="bat-wings" d="M30 20 C26 8 14 2 2 6 C8 10 8 16 12 20 C16 16 20 18 24 24 C26 22 28 21 30 21 C32 21 34 22 36 24 C40 18 44 16 48 20 C52 16 52 10 58 6 C46 2 34 8 30 20 Z" fill="#0a050e" />
    </svg>
  );
}

export function Moon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="moon-g" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff6e0" />
          <stop offset="1" stopColor="#d9a86a" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="44" fill="url(#moon-g)" />
      <circle cx="44" cy="48" r="7" fill="#c8955a" opacity="0.45" />
      <circle cx="74" cy="70" r="10" fill="#c8955a" opacity="0.4" />
      <circle cx="68" cy="40" r="4" fill="#c8955a" opacity="0.4" />
    </svg>
  );
}

const STARS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 60,
  s: 1 + (i % 3),
  d: (i % 7) * 0.6,
}));

export function HauntedBg({ lightning = true }: { lightning?: boolean }) {
  // ambient horror soundscape: drone + wind, with random thunder / whispers / creaks / a distant cackle
  useEffect(() => {
    const stopDrone = sfx.startDrone();
    let t = 0;
    const loop = () => {
      t = window.setTimeout(() => {
        const r = Math.random();
        if (r < 0.4) sfx.thunder();
        else if (r < 0.7) sfx.whisper();
        else sfx.creak();
        loop();
      }, 6_000 + Math.random() * 9_000);
    };
    window.setTimeout(() => sfx.thunder(), 700);
    loop();
    return () => {
      window.clearTimeout(t);
      stopDrone();
    };
  }, []);
  return (
    <div className="haunt-sky" aria-hidden="true">
      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />
      ))}
      <Moon className="moon" />
      <span className="fog fog-a" />
      <span className="fog fog-b" />
      <Bat className="bat bat-1" />
      <Bat className="bat bat-2" />
      <Bat className="bat bat-3" />
      <Ghost className="ghost ghost-1" />
      <Ghost className="ghost ghost-2" />
      {lightning ? <span className="lightning" /> : null}
      <span className="vignette" />
    </div>
  );
}

export function Drips() {
  return (
    <span className="flex justify-center gap-3" aria-hidden="true">
      {[18, 30, 14, 36, 22, 28, 16].map((h, i) => (
        <span key={i} className="drip" style={{ "--h": `${h}px`, animationDelay: `${i * 0.35}s` } as CSSProperties} />
      ))}
    </span>
  );
}
