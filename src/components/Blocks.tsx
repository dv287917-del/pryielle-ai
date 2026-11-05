// AI Builder ke blocks ka renderer. Sirf shared schema ke 7 type — koi HTML/script nahi, text hamesha React text.
import { useState } from "react";
import type { FeatureBlock, Slot as SlotName } from "../../shared/featureSchema";
import { interpolate, onColor, safeUrl } from "../../shared/featureRuntime";
import { useFeatures } from "../lib/features";

type Vars = Record<string, string>;
type B<T extends FeatureBlock["type"]> = Extract<FeatureBlock, { type: T }>;

const openUrl = (u: string) => {
  const url = safeUrl(u);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
};

function Banner({ b, v }: { b: B<"banner">; v: Vars }) {
  return (
    <div className={`fb-banner tone-${b.tone}`}>
      {b.emoji ? <span className="fb-emoji">{b.emoji}</span> : null}
      <span className="fb-btext">{interpolate(b.text, v)}</span>
      {b.actionLabel && b.actionUrl ? (
        <button type="button" className="fb-link" onClick={() => openUrl(b.actionUrl as string)}>{b.actionLabel}</button>
      ) : null}
    </div>
  );
}

function ActionButton({ b, v }: { b: B<"button">; v: Vars }) {
  const { sendPrompt } = useFeatures();
  const [done, setDone] = useState(false);
  const run = () => {
    if (b.action === "openUrl") openUrl(b.value);
    else if (b.action === "sendPrompt") sendPrompt(interpolate(b.value, v));
    else {
      void navigator.clipboard?.writeText(interpolate(b.value, v)).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => undefined);
    }
  };
  return (
    <button type="button" className="fb-btn" onClick={run}>
      {b.emoji ? <span className="fb-emoji">{b.emoji}</span> : null}
      {done ? "Copied ✓" : interpolate(b.label, v)}
    </button>
  );
}

function Toggle({ b, v }: { b: B<"toggle">; v: Vars }) {
  const { flags, setFlag } = useFeatures();
  const on = flags[b.flag] === true;
  return (
    <button type="button" className="fb-toggle" role="switch" aria-checked={on} onClick={() => setFlag(b.flag, !on)}>
      <span>{interpolate(b.label, v)}</span>
      <i className={on ? "on" : ""}><b /></i>
    </button>
  );
}

function Block({ b, v }: { b: FeatureBlock; v: Vars }) {
  const { sendPrompt } = useFeatures();
  switch (b.type) {
    case "banner": return <Banner b={b} v={v} />;
    case "badge":
      return <span className="fb-badge" style={b.color ? { background: b.color, color: onColor(b.color) } : undefined}>{interpolate(b.text, v)}</span>;
    case "button": return <ActionButton b={b} v={v} />;
    case "card":
      return (
        <div className="fb-card">
          {b.emoji ? <span className="fb-emoji big">{b.emoji}</span> : null}
          <div>
            <p className="fb-ct">{interpolate(b.title, v)}</p>
            <p className="fb-cb">{interpolate(b.body, v)}</p>
          </div>
        </div>
      );
    case "chips":
      return (
        <div className="fb-chips">
          {b.items.map((it, i) => (
            <button key={i} type="button" className="fb-chip" onClick={() => sendPrompt(interpolate(it.prompt, v))}>{interpolate(it.label, v)}</button>
          ))}
        </div>
      );
    case "toggle": return <Toggle b={b} v={v} />;
    default: return null; // hero Home me alag se (useHero); anjaan type kabhi render nahi
  }
}

/** Ek jagah (slot) ke saare blocks. Hero yahan nahi — wo greeting ki jagah jaata hai. */
export function Slot({ name, vars, className = "" }: { name: SlotName; vars?: Vars; className?: string }) {
  const { config } = useFeatures();
  const blocks = (config?.blocks ?? []).filter((b) => b.slot === name && b.type !== "hero");
  if (!blocks.length) return null;
  return (
    <div className={`fb-slot ${className}`}>
      {blocks.map((b) => <Block key={b.id} b={b} v={vars ?? {}} />)}
    </div>
  );
}

/** home-hero ka pehla hero block (greeting badalne ke liye) */
export function useHero(): B<"hero"> | null {
  const { config } = useFeatures();
  const h = (config?.blocks ?? []).find((b) => b.type === "hero" && b.slot === "home-hero");
  return (h as B<"hero"> | undefined) ?? null;
}

/** Builder ke liye: "draft dekh rahe ho" pill */
export function PreviewBar() {
  const { preview, setPreview } = useFeatures();
  if (!preview) return null;
  return (
    <div className="fb-preview">
      <span>🧪 Preview · sirf tum dekh rahe ho</span>
      <button type="button" onClick={() => setPreview(false)}>Band karo</button>
    </div>
  );
}

/** Naya live version aaya: "Update now". Rang fixed hain (theme se alag) taaki hamesha padha jaye. */
export function FeatureUpdateGate() {
  const { pending, applyPending, skipPending } = useFeatures();
  if (!pending) return null;
  return (
    <div className="fbu-scrim">
      <div className="fbu">
        <p className="fbu-tag">Naya update · v{pending.version}</p>
        <h2>{pending.title || "App ka naya look"}</h2>
        {pending.notes ? <p className="fbu-notes">{pending.notes}</p> : <p className="fbu-notes">App me naye badlav aaye hain.</p>}
        <button type="button" className="fbu-btn" onClick={applyPending}>Update now</button>
        <button type="button" className="fbu-later" onClick={skipPending}>Baad me</button>
      </div>
    </div>
  );
}
