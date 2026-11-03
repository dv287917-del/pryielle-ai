import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { watchAiConfig, compareVersions, EMPTY_AI_CONFIG, type AiConfig } from "../lib/appConfig";
import { downloadUpdate, getDoneVersion, installDownloaded, reconcileUpdate } from "../lib/update";
import { APP_VERSION } from "../lib/version";
import { Burst } from "./art";

const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "Kuch gadbad hui");

function UpdateModal({ config, onLater }: { config: AiConfig; onLater: () => void }) {
  const [phase, setPhase] = useState<"idle" | "downloading" | "ready" | "error">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const [needPerm, setNeedPerm] = useState(false);

  const install = () => {
    setError("");
    setNeedPerm(false);
    installDownloaded(config.aiUpdateVersion).catch((e) => {
      const m = errText(e);
      if (m === "permission" || /permission/i.test(m)) setNeedPerm(true);
      else setError(m);
    });
  };
  const start = () => {
    setPhase("downloading");
    setPct(0);
    setError("");
    downloadUpdate(config, setPct)
      .then(() => {
        setPhase("ready");
        install();
      })
      .catch((e) => {
        setPhase("error");
        setError(errText(e));
      });
  };
  useEffect(() => setPhase("idle"), [config.aiUpdateVersion]);

  return (
    <div className="scrim upd-scrim">
      <div className="upd">
        <Burst size={54} />
        <h2>{config.aiUpdateTitle || "Pryielle AI update"}</h2>
        <p className="upd-ver">Naya version v{config.aiUpdateVersion} (tumhara v{APP_VERSION})</p>
        <p className="upd-notes">{config.aiUpdateNotes || "Naye features aur fixes ke liye app update karo."}</p>
        {phase === "downloading" ? (
          <>
            <div className="upd-bar"><i style={{ width: `${pct}%` }} /></div>
            <p className="upd-ver">Download ho raha hai… {pct}%</p>
          </>
        ) : phase === "ready" ? (
          <button type="button" className="upd-btn" onClick={install}>Install karo</button>
        ) : (
          <button type="button" className="upd-btn" onClick={start}>{phase === "error" ? "Dobara try karo" : "Update now"}</button>
        )}
        {needPerm ? <p className="upd-warn">Settings me “Is source se install allow” ON karo, phir wapas aake Install karo dabao.</p> : null}
        {error ? <p className="upd-err">{error}</p> : null}
        {config.aiUpdateForce ? <p className="upd-warn">Ye update zaroori hai.</p> : phase === "downloading" ? null : <button type="button" className="ghost" onClick={onLater}>Baad me</button>}
      </div>
    </div>
  );
}

/** Login ke baad mounted: naya aiUpdateVersion mile to popup. */
export function UpdateGate() {
  const [cfg, setCfg] = useState<AiConfig>(EMPTY_AI_CONFIG);
  const [skipped, setSkipped] = useState("");
  const [done, setDone] = useState(getDoneVersion());

  useEffect(() => watchAiConfig(setCfg), []);
  useEffect(() => {
    const onDone = () => setDone(getDoneVersion());
    window.addEventListener("pryai-upd-done", onDone);
    void reconcileUpdate();
    const sub = Capacitor.isNativePlatform() ? CapApp.addListener("resume", () => void reconcileUpdate()) : null;
    return () => {
      window.removeEventListener("pryai-upd-done", onDone);
      void sub?.then((h) => h.remove());
    };
  }, []);

  const v = cfg.aiUpdateVersion;
  const live = Boolean(v && (cfg.aiUpdateUrl || cfg.aiUpdateParts > 0));
  if (!live || compareVersions(v, APP_VERSION) <= 0 || done === v) return null;
  if (skipped === v && !cfg.aiUpdateForce) return null;
  return <UpdateModal config={cfg} onLater={() => setSkipped(v)} />;
}
