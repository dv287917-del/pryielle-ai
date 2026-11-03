import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Captions, Ellipsis, Menu, Mic, MicOff, SquareArrowUp, SwitchCamera, Video, VideoOff, X } from "lucide-react";
import appLogo from "../assets/brand/logo.png";
import { askVoice, fileToAttachment, speak, startEars, stopSpeak, ttsSupported, type AiTurn, type Ears } from "../lib/ai";
import { pushBack } from "../lib/util";
import { useStatusBar } from "./Brand";

/** Live voice screen — Gemini Live jaisa: logo + "Ask away, <naam>!", neeche camera / share / wave / mic / X. */
type Phase = "boot" | "listening" | "hearing" | "thinking" | "speaking" | "muted";
type Lang = "auto" | "hi" | "en";
type Panel = null | "set" | "more";

const LANG_LABEL: Record<Lang, string> = { auto: "Auto", hi: "हिंदी", en: "English" };
const SPEEDS: [string, number][] = [["Slow", 0.88], ["Normal", 1], ["Fast", 1.15]];

export function AiLive({ name, getHistory, onTurn, onClose }: {
  name: string;
  getHistory: () => AiTurn[];
  onTurn: (heard: string, reply: string) => void;
  onClose: () => void;
}) {
  useStatusBar("#000000");
  const first = name.trim().split(/\s+/)[0] || "dost";
  const [phase, setPhase] = useState<Phase>("boot");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const [caps, setCaps] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [lang, setLang] = useState<Lang>("auto");
  const [speedIdx, setSpeedIdx] = useState(1);
  const [camOn, setCamOn] = useState(false);
  const [front, setFront] = useState(false);
  const [shot, setShot] = useState<string | null>(null);

  const root = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const shotIn = useRef<HTMLInputElement | null>(null);
  const ears = useRef<Ears | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const phaseRef = useRef<Phase>("boot");
  const gen = useRef(0);
  const dead = useRef(false);
  const langRef = useRef(lang);
  const rateRef = useRef(SPEEDS[speedIdx][1]);
  const shotRef = useRef<string | null>(null);
  const camRef = useRef(false);
  const cbs = useRef({ getHistory, onTurn, onClose });
  cbs.current = { getHistory, onTurn, onClose };
  langRef.current = lang;
  rateRef.current = SPEEDS[speedIdx][1];
  shotRef.current = shot;
  camRef.current = camOn;

  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);
  const tick = () => { void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); };
  const flashErr = useCallback((m: string) => { setErr(m); window.setTimeout(() => setErr((x) => (x === m ? "" : x)), 4500); }, []);

  const listenAgain = useCallback(() => {
    if (dead.current) return;
    if (phaseRef.current === "muted") return;
    go("listening");
    ears.current?.setPaused(false);
  }, [go]);

  const frame = (): string | null => {
    const v = video.current;
    if (!camRef.current || !v || v.videoWidth < 2) return null;
    const s = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * s);
    c.height = Math.round(v.videoHeight * s);
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1] ?? null;
  };

  const handleClip = useCallback(async (wav: string) => {
    if (dead.current) return;
    const my = ++gen.current;
    ears.current?.setPaused(true);
    go("thinking");
    const imgs: string[] = [];
    const f = frame();
    if (f) imgs.push(f);
    if (shotRef.current) { imgs.push(shotRef.current); setShot(null); }
    try {
      const r = await askVoice(cbs.current.getHistory(), wav, imgs, langRef.current);
      if (dead.current || my !== gen.current) return;
      if (!r.reply) { setHeard(""); listenAgain(); return; }
      setHeard(r.heard);
      setReply(r.reply);
      cbs.current.onTurn(r.heard || "(voice)", r.reply);
      go("speaking");
      if (!ttsSupported()) {
        window.setTimeout(() => { if (!dead.current && my === gen.current) listenAgain(); }, Math.min(9000, 1800 + r.reply.length * 60));
        return;
      }
      let over = false;
      const finish = () => { if (over) return; over = true; if (!dead.current && my === gen.current) listenAgain(); };
      window.setTimeout(finish, Math.max(5000, r.reply.length * 140 + 3500)); // TTS atak jaye to bhi aage badho
      speak(r.reply, rateRef.current, () => undefined, finish);
    } catch (e) {
      if (dead.current || my !== gen.current) return;
      flashErr(e instanceof Error ? e.message : "AI abhi jawab nahi de pa raha.");
      listenAgain();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, listenAgain, flashErr]);

  const interrupt = () => {
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      gen.current += 1;
      stopSpeak();
      tick();
      listenAgain();
    }
  };

  const close = useCallback(() => {
    dead.current = true;
    gen.current += 1;
    stopSpeak();
    ears.current?.stop();
    camStream.current?.getTracks().forEach((t) => t.stop());
    cbs.current.onClose();
  }, []);

  // mic chalu
  useEffect(() => {
    dead.current = false;
    try { window.speechSynthesis?.getVoices(); } catch { /* ignore */ }
    let alive = true;
    void startEars({
      onSpeech: () => { if (phaseRef.current === "listening") go("hearing"); },
      onClip: (w) => { void handleClip(w); },
      onError: flashErr,
    }).then((e) => {
      if (!alive) { e.stop(); return; }
      ears.current = e;
      go("listening");
    }).catch((e: unknown) => {
      flashErr(e instanceof Error ? e.message : "Mic nahi chal paaya.");
      go("muted");
    });
    return () => {
      alive = false;
      dead.current = true;
      stopSpeak();
      ears.current?.stop();
      camStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [go, handleClip, flashErr]);

  useEffect(() => pushBack(() => close()), [close]);

  // wave ki unchai (--lvl) seedha DOM par, re-render nahi
  useEffect(() => {
    let raf = 0;
    let v = 0;
    const loop = (t: number) => {
      const p = phaseRef.current;
      let target = 0;
      if (p === "listening" || p === "hearing") target = ears.current?.level() ?? 0;
      else if (p === "speaking") target = 0.4 + 0.3 * Math.sin(t / 130) * Math.sin(t / 310);
      else if (p === "thinking") target = 0.16 + 0.1 * Math.sin(t / 380);
      v += (Math.max(0, target) - v) * 0.22;
      root.current?.style.setProperty("--lvl", v.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- camera ---------- */
  const openCam = useCallback(async (useFront: boolean) => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFront ? "user" : "environment" }, audio: false });
      camStream.current = s;
      setCamOn(true);
      window.setTimeout(() => { if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => undefined); } }, 30);
    } catch {
      setCamOn(false);
      flashErr("Camera ki permission do (Settings -> App -> Permissions -> Camera).");
    }
  }, [flashErr]);
  const toggleCam = () => {
    tick();
    if (camOn) { camStream.current?.getTracks().forEach((t) => t.stop()); camStream.current = null; setCamOn(false); return; }
    void openCam(front);
  };
  const flipCam = () => { const f = !front; setFront(f); void openCam(f); };

  /* ---------- screen share ---------- */
  const shareScreen = async () => {
    tick();
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c?: object) => Promise<MediaStream> };
    if (typeof md?.getDisplayMedia === "function") {
      try {
        const s = await md.getDisplayMedia({ video: true, audio: false });
        const v = document.createElement("video");
        v.srcObject = s; v.muted = true;
        await v.play();
        await new Promise((r) => window.setTimeout(r, 400));
        const c = document.createElement("canvas");
        const k = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        s.getTracks().forEach((t) => t.stop());
        setShot(c.toDataURL("image/jpeg", 0.75).split(",")[1] ?? null);
        return;
      } catch { /* user ne cancel kiya ya support nahi — neeche picker */ }
    }
    shotIn.current?.click(); // WebView mein live screen-share nahi: screenshot/photo chuno
  };
  const pickShot = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    try {
      const a = await fileToAttachment(f);
      if (a.kind !== "image") { flashErr("Sirf photo / screenshot chuno."); return; }
      setShot(a.data);
    } catch (e) { flashErr(e instanceof Error ? e.message : "Photo add nahi ho paayi."); }
  };

  const toggleMute = () => {
    tick();
    if (phaseRef.current === "muted") { go("listening"); ears.current?.setPaused(false); return; }
    gen.current += 1;
    stopSpeak();
    ears.current?.setPaused(true);
    go("muted");
  };

  const title =
    phase === "muted" ? "Mic band hai" :
    phase === "hearing" ? "Listening…" :
    phase === "thinking" ? "Thinking…" :
    phase === "speaking" ? "Speaking…" :
    phase === "boot" ? "Connecting…" : `Ask away, ${first}!`;
  const showText = caps || (phase === "speaking" && !ttsSupported());
  const busy = phase === "thinking" || phase === "speaking";

  return (
    <div ref={root} className={clsx("live-root fixed inset-0 z-[90] flex flex-col text-white", `live-${phase}`)} style={{ "--lvl": 0 } as CSSProperties}>
      {camOn ? <video ref={video} playsInline muted autoPlay className={clsx("live-video", front && "scale-x-[-1]")} /> : null}
      {camOn ? <div className="live-video-shade" /> : null}

      <header className="safe-top relative z-10 flex items-center justify-between px-5 pt-4">
        <button type="button" aria-label="Menu" onClick={() => setPanel(panel === "set" ? null : "set")} className="tap grid size-11 place-items-center rounded-full"><Menu className="size-7" strokeWidth={1.8} /></button>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Captions" aria-pressed={caps} onClick={() => setCaps((c) => !c)} className={clsx("tap grid size-11 place-items-center rounded-full", caps && "bg-white/15")}><Captions className="size-7" strokeWidth={1.8} /></button>
          <button type="button" aria-label="More" onClick={() => setPanel(panel === "more" ? null : "more")} className="tap grid size-11 place-items-center rounded-full"><Ellipsis className="size-7" strokeWidth={1.8} /></button>
        </div>
      </header>

      {panel ? (
        <div className="live-panel pop-in absolute top-[4.6rem] right-4 left-4 z-20 rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
          {panel === "set" ? (
            <>
              <p className="mb-2 text-xs font-semibold tracking-wide text-white/50">BOLNE KI BHASHA</p>
              <div className="mb-4 flex gap-2">
                {(Object.keys(LANG_LABEL) as Lang[]).map((k) => <button key={k} type="button" onClick={() => setLang(k)} className={clsx("live-chip tap", lang === k && "live-chip-on")}>{LANG_LABEL[k]}</button>)}
              </div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-white/50">AWAAZ KI SPEED</p>
              <div className="flex gap-2">
                {SPEEDS.map(([l], i) => <button key={l} type="button" onClick={() => setSpeedIdx(i)} className={clsx("live-chip tap", speedIdx === i && "live-chip-on")}>{l}</button>)}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => { setPanel(null); close(); }} className="tap rounded-2xl px-3 py-3 text-left text-[0.95rem]">💬 Text chat par wapas jao</button>
              <button type="button" onClick={() => { setHeard(""); setReply(""); setPanel(null); }} className="tap rounded-2xl px-3 py-3 text-left text-[0.95rem]">🧹 Screen ke captions saaf karo</button>
            </div>
          )}
        </div>
      ) : null}

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center" onClick={() => { if (panel) setPanel(null); }}>
        {camOn ? <button type="button" aria-label="Camera palto" onClick={flipCam} className="tap live-btn absolute top-2 right-5 grid size-11 place-items-center rounded-full"><SwitchCamera className="size-5" /></button> : null}
        <button type="button" aria-label="Rukao ya sunao" onClick={interrupt} className={clsx("live-logo-wrap tap", camOn && "live-logo-small")}>
          <span className="live-ring live-ring-a" /><span className="live-ring live-ring-b" />
          <img src={appLogo} alt="Pryielle AI" className="live-logo" draggable={false} />
        </button>
        <h1 className={clsx("live-title mt-9 font-light", phase === "hearing" || busy ? "live-title-dim" : "")}>{title}</h1>
        {showText && (heard || reply) ? (
          <div className="live-caps mt-5 w-full max-w-sm overflow-y-auto text-left">
            {heard ? <p className="mb-2 text-[0.95rem] text-white/55">{heard}</p> : null}
            {reply ? <p className="text-lg leading-snug text-white/95">{reply}</p> : null}
          </div>
        ) : null}
        {err ? <p className="mt-4 max-w-xs rounded-2xl bg-rose-500/15 px-4 py-2 text-sm text-rose-200">{err}</p> : null}
      </main>

      {shot ? (
        <div className="relative z-10 mx-auto mb-3 flex items-center gap-2 rounded-2xl bg-white/10 p-1.5 pr-3">
          <img src={`data:image/jpeg;base64,${shot}`} alt="" className="size-12 rounded-xl object-cover" />
          <span className="text-xs text-white/75">Agle sawal ke saath jayegi</span>
          <button type="button" aria-label="Hatao" onClick={() => setShot(null)} className="tap grid size-6 place-items-center rounded-full bg-white/20"><X className="size-3.5" /></button>
        </div>
      ) : null}

      <footer className="relative z-10 flex items-center justify-between gap-2 px-2.5" style={{ paddingBottom: "max(calc(env(safe-area-inset-bottom) + 14px), 26px)" }}>
        <button type="button" aria-label={camOn ? "Camera band" : "Camera"} aria-pressed={camOn} onClick={toggleCam} className={clsx("live-btn tap", camOn && "live-btn-on")}>{camOn ? <VideoOff className="size-6" /> : <Video className="size-6" />}</button>
        <button type="button" aria-label="Screen / photo share" onClick={() => void shareScreen()} className={clsx("live-btn tap", shot && "live-btn-on")}><SquareArrowUp className="size-6" /></button>
        <button type="button" aria-label="Awaaz" onClick={interrupt} className="live-pill tap" disabled={phase === "muted"}>
          <span className="live-wave live-wave-a" /><span className="live-wave live-wave-b" />
        </button>
        <button type="button" aria-label={phase === "muted" ? "Mic chalu" : "Mic band"} aria-pressed={phase === "muted"} onClick={toggleMute} className={clsx("live-btn tap", phase === "muted" && "live-btn-off")}>{phase === "muted" ? <MicOff className="size-6" /> : <Mic className="size-6" />}</button>
        <button type="button" aria-label="Band karo" onClick={close} className="live-btn tap"><X className="size-7" /></button>
        <input ref={shotIn} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickShot(e.target.files); e.target.value = ""; }} />
      </footer>
    </div>
  );
}
