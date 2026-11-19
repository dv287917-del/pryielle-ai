import { useEffect, useRef, useState } from "react";
import appLogo from "../assets/brand/logo.png";
import { useStatusBar } from "./Brand";
import { buzz } from "../lib/util";
import "./pryielle.css";

// "Pryielle" ke strokes — ek ek karke likhe jaate hain (handwriting). t = seconds
const STROKES: { d: string; t: number }[] = [
  { d: "M62 34 C58 70 55 110 50 150", t: 0.45 },
  { d: "M56 40 C108 18 138 56 112 86 C96 104 68 102 50 98", t: 0.7 },
  { d: "M152 142 C154 122 154 102 152 86", t: 0.3 },
  { d: "M154 112 C162 90 180 80 196 88", t: 0.35 },
  { d: "M214 88 C216 114 226 138 248 132 C260 128 266 106 266 86", t: 0.55 },
  { d: "M266 86 C270 132 270 170 248 196 C234 212 216 204 224 190", t: 0.6 },
  { d: "M298 90 C298 108 296 126 302 138 C306 144 312 140 318 132", t: 0.4 },
  { d: "M336 114 C362 114 376 102 368 92 C360 82 338 90 336 118 C334 144 352 152 374 136", t: 0.7 },
  { d: "M392 140 C390 100 404 44 414 32 C422 24 422 52 408 102 C402 130 406 144 420 136", t: 0.7 },
  { d: "M452 140 C450 100 464 44 474 32 C482 24 482 52 468 102 C462 130 466 144 480 136", t: 0.7 },
  { d: "M500 114 C526 114 540 102 532 92 C524 82 502 90 500 118 C498 144 516 152 538 136", t: 0.7 },
];
const START = 0.4; // likhna shuru hone ka delay (s)
const GAP = 0.03;
const SPEED = 0.4; // chhota = tez likhai
const TIMING = (() => {
  let at = START;
  return STROKES.map((s) => {
    const d = at;
    at += s.t * SPEED + GAP;
    return d;
  });
})();
const WRITE_END = TIMING[TIMING.length - 1] + STROKES[STROKES.length - 1].t * SPEED;
const DOT_AT = TIMING[6] + STROKES[6].t * SPEED; // 'i' ke baad dot

type Pick = "blue" | "pink" | "yellow";

export function PryielleScreen({ onDone }: { onDone: () => void }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useStatusBar("#cfe8fb");
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function choose(p: Pick) {
    if (pick) return;
    setPick(p);
    buzz();
    timer.current = window.setTimeout(onDone, 620);
  }

  return (
    <main className={`wl2-root ${pick ? "wl2-pick" : ""}`}>
      <div className="wl2-grid" />
      <div className="wl2-sky"><div className="wl2-rays" /></div>

      <div className="wl2-bar">
        <div className="wl2-glass" aria-hidden="true">
          <svg className="wl2-flower" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="1.8">
            {[0, 72, 144, 216, 288].map((r) => (
              <ellipse key={r} cx="16" cy="9" rx="3.6" ry="6" transform={`rotate(${r} 16 16)`} />
            ))}
            <circle cx="16" cy="16" r="2" fill="#fff" stroke="none" />
          </svg>
        </div>
        <img className="wl2-logo" src={appLogo} alt="Pryielle" draggable={false} />
        <div className="wl2-glass" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <path d="M8 12 H24" /><path d="M8 20 H18" />
          </svg>
        </div>
      </div>

      <div className="wl2-mid">
        <svg className="wl2-title" viewBox="20 10 540 215" role="img" aria-label="Pryielle">
          <defs>
            <linearGradient id="wl2-grad" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="545" y2="0">
              <stop offset="0" stopColor="#30303b" />
              <stop offset="1" stopColor="#b0b1ba" />
            </linearGradient>
          </defs>
          {STROKES.map((s, i) => (
            <path key={i} className="wl2-stroke" pathLength={1} d={s.d} style={{ "--d": `${TIMING[i]}s`, "--t": `${(s.t * SPEED).toFixed(2)}s` } as never} />
          ))}
          <circle className="wl2-dot" cx="298" cy="62" r="5.2" style={{ "--d": `${DOT_AT}s` } as never} />
        </svg>
        <p className="wl2-sub" style={{ "--d": `${WRITE_END + 0.05}s` } as never}>HOW YOU FEELING TODAY?</p>
        <button type="button" className="wl2-start" onClick={() => choose("yellow")} style={{ "--d": `${WRITE_END + 0.2}s` } as never}>
          Start
        </button>
      </div>

      <button type="button" aria-label="Happy" className={`wl2-blob blue ${pick === "blue" ? "chosen" : ""}`} onClick={() => choose("blue")}>
        <span className="body" />
        <span className="face">
          <svg viewBox="0 0 100 100">
            <g fill="#111">
              <ellipse className="wl2-eye" cx="58" cy="52" rx="6" ry="8" transform="rotate(-25 58 52)" />
              <ellipse className="wl2-eye b" cx="78" cy="58" rx="6.5" ry="8.5" transform="rotate(-25 78 58)" />
              <circle cx="40" cy="60" r="0.9" /><circle cx="43" cy="64" r="0.9" /><circle cx="37" cy="65" r="0.9" />
            </g>
            <path className="wl2-spark" fill="#fff" d="M62 46 L63.3 49.7 L67 51 L63.3 52.3 L62 56 L60.7 52.3 L57 51 L60.7 49.7Z" />
            <path className="wl2-spark b" fill="#fff" d="M80 52 L81.1 55 L84 56 L81.1 57 L80 60 L78.9 57 L76 56 L78.9 55Z" />
          </svg>
        </span>
      </button>

      <button type="button" aria-label="Cool" className={`wl2-blob pink ${pick === "pink" ? "chosen" : ""}`} onClick={() => choose("pink")}>
        <span className="body" />
        <span className="face">
          <svg viewBox="0 0 100 100">
            <g fill="#111">
              <path className="wl2-eye" d="M16 46 C22 38 34 40 36 48 C38 56 28 62 22 58 C16 55 14 50 16 46Z" transform="rotate(18 26 50)" />
              <path className="wl2-eye b" d="M10 66 C16 58 28 60 30 68 C32 76 22 82 16 78 C10 75 8 70 10 66Z" transform="rotate(18 20 70)" />
            </g>
          </svg>
        </span>
      </button>

      <button type="button" aria-label="Chill" className={`wl2-blob yellow ${pick === "yellow" ? "chosen" : ""}`} onClick={() => choose("yellow")}>
        <span className="body" />
        <span className="face">
          <svg viewBox="0 0 100 100">
            <g fill="#111">
              <path className="wl2-eye" d="M30 30 Q37 22 44 30 Q37 28 30 30Z" />
              <path className="wl2-eye b" d="M56 30 Q63 22 70 30 Q63 28 56 30Z" />
            </g>
            <path d="M28 38 Q50 50 72 38" stroke="#111" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </button>
    </main>
  );
}
