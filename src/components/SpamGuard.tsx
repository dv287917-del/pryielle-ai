import { useEffect, useRef, useState } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { onSpam, type SpamLevel } from "../lib/spam";
import { Wave } from "./Wave";
import voiceUrl from "../assets/sfx/spam-voice.m4a";

/**
 * Spam popup (poore app par):
 *  - 1st spam: screen par "DON'T SPAM" warning (apne aap band)
 *  - 2nd spam: animated sound-track + Pryielle ki voice, voice khatam hote hi popup band
 *  - 3rd: phir warning, 4th: phir voice ... baar baar yahi
 */
export function SpamGuard() {
  const [show, setShow] = useState<{ level: SpamLevel; key: number } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<number[]>([]);

  const cleanup = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
  };
  const close = () => { cleanup(); setShow(null); };

  useEffect(() => onSpam((level) => {
    cleanup();
    setShow({ level, key: Date.now() });
    if (level === "warn") {
      void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
      timers.current.push(window.setTimeout(close, 2600));
      return;
    }
    const el = new Audio(voiceUrl);
    el.volume = 1;
    audio.current = el;
    el.onended = close;
    el.onerror = close;
    timers.current.push(window.setTimeout(close, 15_000)); // safety: voice na bajne par bhi popup atke nahi
    void el.play().catch(close);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cleanup, []);

  if (!show) return null;
  const voice = show.level === "voice";
  return (
    <div key={show.key} className={voice ? "spam-screen spam-voice" : "spam-screen spam-warn"} role="alertdialog" aria-live="assertive">
      <span className="spam-flash" />
      <div className="spam-body">
        {voice ? <Wave fast className="spam-wave" /> : <p className="spam-title">DON&apos;T SPAM</p>}
      </div>
    </div>
  );
}
