import { useState, type CSSProperties } from "react";
import { Avatar } from "./ui";
import { Drips, HauntedBg, Witch } from "./Horror";
import type { UserDoc } from "../lib/types";
import { buzz } from "../lib/util";
import { sfx } from "../lib/sfx";
import smileUrl from "../assets/sfx/smile.mp3";

export function Start({ me, onStart }: { me: UserDoc; onStart: () => void }) {
  const [going, setGoing] = useState(false);

  function start() {
    if (going) return;
    setGoing(true);
    buzz();
    sfx.playFile(smileUrl);
    // animation pehle shuru ho, phir bhaari screen (Shell) mount ho: isse "atakna" kam lagta hai
    window.requestAnimationFrame(() => window.setTimeout(onStart, 540));
  }

  return (
    <main className={`safe-top relative flex h-dvh flex-col overflow-hidden bg-ink text-paper ${going ? "enter-haunt" : ""}`}>
      <HauntedBg />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <Witch className="witch-float fade-up h-[30dvh] max-h-64 w-auto" />
        <div className="fade-up mt-4 flex items-center gap-3" style={{ "--d": 120 } as CSSProperties}>
          <Avatar src={me.avatar} name={me.displayName} size="sm" live />
          <div className="text-left">
            <p className="text-xs tracking-[0.25em] text-paper/50">WELCOME BACK</p>
            <p className="blood-text font-display text-3xl leading-none font-bold">{me.displayName}</p>
          </div>
        </div>
        <div className="fade-up mt-2" style={{ "--d": 180 } as CSSProperties}>
          <Drips />
        </div>
        <p className="fade-up mt-4 max-w-xs text-pretty text-paper/65" style={{ "--d": 240 } as CSSProperties}>
          Tumhara ID <span className="grad-text font-display text-lg font-bold tabular-nums">{me.publicId}</span> ready hai. Dost intezaar kar rahe hain.
        </p>
        <button
          type="button"
          onClick={start}
          className="start-btn fade-up mt-9 h-16 w-64 rounded-full font-display text-3xl font-bold tracking-[0.3em]"
          style={{ "--d": 360 } as CSSProperties}
        >
          START
        </button>
      </div>
    </main>
  );
}
