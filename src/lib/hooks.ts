import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { firebaseConfig } from "../firebase-config.generated";
import { getUser, watchUser } from "./data";
import { errorText } from "./util";
import type { UserDoc } from "./types";


// Direct REST probe: tells the real reason when the Firestore SDK stays silent.
async function diagnose(uid: string): Promise<string> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 3_000);
  try {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${uid}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctl.signal },
    );
    if (r.ok) return "Server reachable hai par app ka connection atak raha hai. App ko force-stop karke dobara kholo.";
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    const msg = j.error?.message ?? "";
    if (r.status === 404 && /database.*(not exist|not found)|does not exist/i.test(msg)) return "Firestore Database bana hi nahi hai. Firebase Console → Build → Firestore Database → Create database (Production mode).";
    if (r.status === 404) return "Server reachable hai aur database bana hai, par app ka connection atak raha hai. App force-stop karke dobara kholo.";
    if (r.status === 403 && /has not been used|disabled|SERVICE_DISABLED/i.test(msg)) return "Cloud Firestore API disabled hai. Google Cloud Console mein 'Cloud Firestore API' Enable karo.";
    if (r.status === 403 && /api key|referer|blocked|restrict/i.test(msg)) return "API key restricted hai. Google Cloud Console → Credentials → Android/Browser key ki restriction hata do (ya Firestore API allow karo).";
    if (r.status === 403 || r.status === 401) return "Permission denied. Firebase Console → Firestore → Rules mein firestore.rules ka text paste karke Publish karo.";
    return `Server error ${r.status}: ${msg.slice(0, 120)}`;
  } catch {
    return "Phone se firestore.googleapis.com tak pahunch nahi pa raha. VPN / Private DNS / ad-blocker / data saver band karke dekho.";
  } finally {
    window.clearTimeout(t);
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );
  return { user, ready };
}

export function useMe(uid: string | undefined) {
  const [state, setState] = useState<{ uid: string | null; me: UserDoc | null; error: string }>({ uid: null, me: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!uid) {
      setState({ uid: null, me: null, error: "" });
      return;
    }
    let got = false;
    const stop = watchUser(
      uid,
      (u) => {
        got = true;
        setState({ uid, me: u, error: "" });
      },
      (e) => {
        got = true;
        setState({ uid, me: null, error: errorText(e) });
      },
    );
    // watchdog: Firestore sometimes never answers (no error, no data). After 2s find out why and say it plainly.
    const wd = window.setTimeout(() => {
      if (got) return;
      void diagnose(uid).then((text) => {
        if (!got) setState({ uid, me: null, error: text });
      });
    }, 2_000);
    return () => {
      window.clearTimeout(wd);
      stop();
    };
  }, [uid, attempt]);
  // loading is derived, so there is never a frame where a signed-in user looks "profile-less" (that caused the double splash / Setup flash)
  const current = state.uid === uid;
  return {
    me: current ? state.me : null,
    loading: Boolean(uid) && !current,
    error: current ? state.error : "",
    retry: () => setAttempt((n) => n + 1),
  };
}

const cache = new Map<string, UserDoc>();
export function useUser(uid: string | null | undefined, live = false) {
  const [u, setU] = useState<UserDoc | null>(uid ? cache.get(uid) ?? null : null);
  useEffect(() => {
    if (!uid) {
      setU(null);
      return;
    }
    const cached = cache.get(uid);
    if (cached) setU(cached);
    if (live) {
      return watchUser(uid, (d) => {
        if (d) cache.set(uid, d);
        setU(d);
      });
    }
    if (!cached) {
      let stop = false;
      void getUser(uid).then((d) => {
        if (d && !stop) {
          cache.set(uid, d);
          setU(d);
        }
      });
      return () => {
        stop = true;
      };
    }
  }, [uid, live]);
  return u;
}
