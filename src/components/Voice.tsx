import { useEffect, useRef, useState } from "react";
import { askVoice, speak, startEars, stopSpeak, type AiTurn, type Ears } from "../lib/ai";
import { Burst } from "./art";

type Phase = "starting" | "listening" | "thinking" | "speaking";
const LABEL: Record<Phase, string> = { starting: "Mic on ho raha hai…", listening: "Sun raha hoon… bolo", thinking: "Soch raha hoon…", speaking: "Bol raha hoon (beech mein bol sakte ho)" };

/** Voice mode: mic -> AI -> bolke jawab. Har turn chat mein save hota hai. */
export function Voice({ history, onTurn, onClose }: { history: () => AiTurn[]; onTurn: (heard: string, reply: string) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [err, setErr] = useState("");
  const [heard, setHeard] = useState("");
  const orb = useRef<HTMLDivElement | null>(null);
  const ears = useRef<Ears | null>(null);
  const alive = useRef(true);
  const cb = useRef({ history, onTurn });
  cb.current = { history, onTurn };

  useEffect(() => {
    alive.current = true;
    let raf = 0;
    const tick = () => {
      const lv = ears.current?.level() ?? 0;
      if (orb.current) orb.current.style.transform = `scale(${1 + lv * 0.5})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    startEars({
      onSpeech: () => { stopSpeak(); if (alive.current) setPhase("listening"); },
      onError: (m) => { if (alive.current) setErr(m); },
      onClip: (wav) => {
        const e = ears.current;
        if (!e || !alive.current) return;
        e.setPaused(true);
        setPhase("thinking");
        setErr("");
        askVoice(cb.current.history(), wav, [], "auto")
          .then((r) => {
            if (!alive.current) return;
            if (!r.heard && !r.reply) { e.setPaused(false); setPhase("listening"); return; }
            setHeard(r.heard);
            cb.current.onTurn(r.heard, r.reply);
            setPhase("speaking");
            speak(r.reply, 1, () => undefined, () => { if (!alive.current) return; e.setPaused(false); setPhase("listening"); });
          })
          .catch((er: unknown) => {
            if (!alive.current) return;
            setErr(er instanceof Error ? er.message : "AI jawab nahi de paaya.");
            e.setPaused(false);
            setPhase("listening");
          });
      },
    })
      .then((e) => {
        if (!alive.current) { e.stop(); return; }
        ears.current = e;
        setPhase("listening");
      })
      .catch((er: unknown) => { if (alive.current) setErr(er instanceof Error ? er.message : "Mic start nahi hua."); });

    return () => {
      alive.current = false;
      cancelAnimationFrame(raf);
      ears.current?.stop();
      ears.current = null;
      stopSpeak();
    };
  }, []);

  return (
    <div className="voice" role="dialog" aria-label="Voice mode">
      <div className="orbwrap">
        <div ref={orb} className="orb"><Burst size={96} className={phase === "thinking" ? "burst-spin" : ""} /></div>
      </div>
      <p className="vstate">{LABEL[phase]}</p>
      {heard ? <p className="vheard">“{heard}”</p> : null}
      {err ? <p className="err">{err}</p> : null}
      <button type="button" className="vend" onClick={onClose}>End</button>
    </div>
  );
}
