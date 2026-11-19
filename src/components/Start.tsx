import { useState } from "react";
import { useStatusBar } from "./Brand";
import type { UserDoc } from "../lib/types";
import { buzz } from "../lib/util";
import { Face, FACES } from "./WelcomeFaces";
import { PryielleScreen } from "./PryielleScreen";
import "./welcome.css";

// Ring ke tiles: angle, radius (stage ka fraction), size, entry delay, bob duration
const RING: { a: number; r: number; z: number }[] = [
  { a: -90, r: 0.41, z: 0.17 },
  { a: -54, r: 0.44, z: 0.2 },
  { a: -18, r: 0.4, z: 0.15 },
  { a: 18, r: 0.43, z: 0.2 },
  { a: 54, r: 0.4, z: 0.16 },
  { a: 90, r: 0.44, z: 0.18 },
  { a: 126, r: 0.41, z: 0.17 },
  { a: 162, r: 0.44, z: 0.2 },
  { a: 198, r: 0.4, z: 0.15 },
  { a: 234, r: 0.43, z: 0.19 },
];

export function Start({ me, onStart }: { me: UserDoc; onStart: () => void }) {
  const [going, setGoing] = useState(false);
  const [imgBad, setImgBad] = useState(false);
  const [phase, setPhase] = useState<"welcome" | "name">("welcome");
  useStatusBar("#ffffff");

  function start() {
    if (going) return;
    setGoing(true);
    buzz();
    window.requestAnimationFrame(() => window.setTimeout(() => setPhase("name"), 540));
  }

  if (phase === "name") return <PryielleScreen onDone={onStart} />;

  return (
    <main className={`wl-root ${going ? "wl-going" : ""}`}>
      <div className="wl-swoosh" aria-hidden="true">
        <svg viewBox="0 0 400 800" preserveAspectRatio="none">
          <path d="M-20 520 C 120 420, 200 640, 430 480" />
          <path d="M-20 600 C 140 500, 240 720, 430 570" />
          <path d="M-20 130 C 90 60, 260 220, 430 90" />
        </svg>
      </div>

      <div className="wl-top">
        <div className="wl-stage">
          <span className="wl-halo" />
          <span className="wl-ripple" />
          <span className="wl-ripple b" />

          <div className="wl-orbit-in">
            <div className="wl-orbit-spin">
              {RING.map((t, i) => (
                <div
                  key={i}
                  className="wl-tile"
                  style={{ "--a": `${t.a}deg`, "--r": t.r, "--z": `calc(var(--S) * ${t.z})` } as never}
                >
                  <div className="wl-pop" style={{ "--d": `${0.15 + i * 0.09}s` } as never}>
                    <div className="wl-ctr-spin">
                      <div className="wl-ctr-in">
                        <div className="wl-bob" style={{ "--t": `${4.2 + (i % 5) * 0.7}s`, "--bd": `${-i * 0.9}s` } as never}>
                          <div className={`wl-photo ${FACES[i % FACES.length].gray ? "gray" : ""}`}>
                            <Face spec={FACES[i % FACES.length]} id={String(i)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="wl-center">
            {me.avatar && !imgBad ? (
              <img src={me.avatar} alt="" onError={() => setImgBad(true)} />
            ) : (
              <Face spec={FACES[11]} id="me" />
            )}
          </div>
        </div>
      </div>

      <div className="wl-bottom">
        <h1 className="wl-title">Inspired people</h1>
        <p className="wl-sub">Apne Free Fire dosto ke saath chat karo, sab kuch ek hi jagah.</p>
        <button type="button" className="wl-btn" onClick={start}>
          Get Started
        </button>
      </div>
    </main>
  );
}
