import { useState } from "react";
import { Avatar } from "./ui";
import { RoseEmblem, Sparkle, useStatusBar } from "./Brand";
import type { UserDoc } from "../lib/types";
import { buzz } from "../lib/util";

export function Start({ me, onStart }: { me: UserDoc; onStart: () => void }) {
  const [going, setGoing] = useState(false);
  useStatusBar("#051a96");

  function start() {
    if (going) return;
    setGoing(true);
    buzz();
    // animation pehle shuru ho, phir bhaari screen (Shell) mount ho: isse "atakna" kam lagta hai
    window.requestAnimationFrame(() => window.setTimeout(onStart, 540));
  }

  return (
    <main className={`ir-sky safe-top relative flex h-dvh flex-col overflow-hidden text-white ${going ? "ir-enter" : ""}`}>
      <span className="ir-glow" style={{ width: 320, height: 320, left: "50%", top: "27%", marginLeft: -160, marginTop: -160 }} />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="ir-bloom ir-float relative">
          <RoseEmblem className="h-[26dvh] max-h-60 w-auto" spin />
          <Sparkle className="top-0 -right-4 size-5" d={300} />
          <Sparkle className="bottom-4 -left-5 size-4" d={1300} />
        </div>
        <div className="ir-rise mt-7 flex items-center gap-3" style={{ "--d": 150 } as never}>
          <Avatar src={me.avatar} name={me.displayName} size="sm" live />
          <div className="text-left">
            <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-white/80">WELCOME BACK</p>
            <p className="font-display text-3xl leading-none font-bold">{me.displayName}</p>
          </div>
        </div>
        <p className="ir-rise mt-4 max-w-xs text-pretty text-sm text-white/85" style={{ "--d": 230 } as never}>
          Tumhara ID <span className="font-display text-lg font-bold tabular-nums text-white">{me.publicId}</span> ready hai. Dost intezaar kar rahe hain.
        </p>
        <button type="button" onClick={start} className="ir-btn-white ir-rise tap mt-9 h-16 w-64 rounded-full font-display text-2xl font-bold tracking-[0.35em]" style={{ "--d": 330 } as never}>
          START
        </button>
      </div>
    </main>
  );
}
