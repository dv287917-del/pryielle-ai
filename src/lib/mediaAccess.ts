/**
 * App open pe mic + camera permission force.
 * Deny = app aage nahi badhegi.
 */

const KEY = "pry-media-ok";

export type MediaAccessState =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error"; detail?: string };

/** Already granted? (session + live check) */
export async function checkMediaAccess(): Promise<MediaAccessState> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported", detail: "Is device pe mic/camera API nahi" };
  }
  // Permissions API (jab support ho)
  try {
    const perms = navigator.permissions;
    if (perms?.query) {
      const mic = await perms.query({ name: "microphone" as PermissionName });
      const cam = await perms.query({ name: "camera" as PermissionName });
      if (mic.state === "granted" && cam.state === "granted") {
        sessionStorage.setItem(KEY, "1");
        return { ok: true };
      }
      if (mic.state === "denied" || cam.state === "denied") {
        return { ok: false, reason: "denied" };
      }
    }
  } catch {
    /* ignore — fallback getUserMedia */
  }
  if (sessionStorage.getItem(KEY) === "1") return { ok: true };
  return { ok: false, reason: "denied" }; // treat unknown as need request
}

/** Prompt once; tracks immediately stop — sirf permission ke liye. */
export async function requestMediaAccess(): Promise<MediaAccessState> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported", detail: "Is device pe mic/camera API nahi" };
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
    });
    sessionStorage.setItem(KEY, "1");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const denied = /denied|permission|NotAllowed|NotFound/i.test(msg);
    return {
      ok: false,
      reason: denied ? "denied" : "error",
      detail: msg.slice(0, 120),
    };
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export function clearMediaAccessFlag() {
  sessionStorage.removeItem(KEY);
}
