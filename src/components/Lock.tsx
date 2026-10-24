import { useState } from "react";
import { Delete } from "lucide-react";
import { checkPin } from "../lib/util";
import { Aurora, Mark } from "./ui";

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  async function press(d: string) {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (await checkPin(next)) onUnlock();
      else {
        setShake(true);
        window.setTimeout(() => {
          setShake(false);
          setPin("");
        }, 450);
      }
    }
  }

  return (
    <main className="safe-top fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink text-paper">
      <Aurora />
      <div className="relative flex flex-col items-center">
        <Mark className="size-14" />
        <p className="mt-4 font-display text-2xl font-bold tracking-widest">ENTER PIN</p>
        <div className={`mt-5 flex gap-4 ${shake ? "animate-pulse" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`size-4 rounded-full border-2 ${i < pin.length ? "grad border-transparent" : "border-paper/40"}`} />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) =>
            k === "" ? (
              <span key="e" />
            ) : (
              <button
                key={k}
                type="button"
                className="glass tap grid size-18 place-items-center rounded-full font-display text-3xl font-bold"
                onClick={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : void press(k))}
              >
                {k === "⌫" ? <Delete className="size-6" /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
