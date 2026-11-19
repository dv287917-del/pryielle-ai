import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/** true jab app ka theme "pryielle" (naya light look) ho. Settings me theme badlo to turant badal jaata hai. */
export function usePryTheme(): boolean {
  const [on, setOn] = useState(() => document.documentElement.dataset.theme === "pryielle");
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setOn(el.dataset.theme === "pryielle");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return on;
}

/** Light screen par status bar safed + kaale icons (native only); band hone par purana dark wapas. */
export function usePryStatusBar(on: boolean) {
  useEffect(() => {
    if (!on || !Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(() => undefined);
    return () => {
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: "#07060d" }).catch(() => undefined);
    };
  }, [on]);
}

/**
 * Loading screen jaisa background: halka grid, aasmani sky + ghoomti kirnein,
 * tairte pastel gole aur twinkle karte sparkles. Sirf transform/opacity animate hote hain.
 */
export function PryBg() {
  return (
    <div className="pry-bg" aria-hidden="true">
      <div className="pry-grid" />
      <div className="pry-sky"><div className="pry-rays" /></div>
      <span className="pry-orb o1" />
      <span className="pry-orb o2" />
      <span className="pry-orb o3" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`pry-spark s${i}`} viewBox="-5 -5 10 10">
          <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

export type BlobKind = "blue" | "pink" | "yellow";

/** Loading screen wale pyare gole (aankhein jhapakti hain). Empty states aur Home hero me use hota hai. */
export function PryBlob({ kind = "blue", className = "", style }: { kind?: BlobKind; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`pry-blob ${kind} ${className}`} style={style} aria-hidden="true">
      <span className="body" />
      <svg viewBox="0 0 100 100" className="face">
        {kind === "blue" && (
          <>
            <g fill="#111">
              <ellipse className="pry-eye" cx="40" cy="50" rx="5.5" ry="7.5" />
              <ellipse className="pry-eye b" cx="62" cy="50" rx="5.5" ry="7.5" />
            </g>
            <path className="pry-twinkle" fill="#fff" d="M42 45 L43 48 L46 49 L43 50 L42 53 L41 50 L38 49 L41 48Z" />
            <path d="M43 63 Q51 70 59 63" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}
        {kind === "pink" && (
          <>
            <g fill="#111">
              <ellipse className="pry-eye" cx="38" cy="50" rx="6" ry="8" transform="rotate(18 38 50)" />
              <ellipse className="pry-eye b" cx="62" cy="50" rx="6" ry="8" transform="rotate(-18 62 50)" />
            </g>
            <ellipse cx="29" cy="62" rx="6" ry="3.4" fill="#ff8fc2" opacity=".7" />
            <ellipse cx="71" cy="62" rx="6" ry="3.4" fill="#ff8fc2" opacity=".7" />
            <path d="M44 64 Q50 69 56 64" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}
        {kind === "yellow" && (
          <>
            <g fill="#111">
              <path className="pry-eye" d="M30 46 Q37 38 44 46 Q37 44 30 46Z" />
              <path className="pry-eye b" d="M56 46 Q63 38 70 46 Q63 44 56 46Z" />
            </g>
            <path d="M32 56 Q50 70 68 56" stroke="#111" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}
