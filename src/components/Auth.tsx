import { useState, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/util";
import { Drips, HauntedBg, Witch } from "./Horror";
import { GoogleG } from "./ui";

export async function googleSignIn() {
  if (Capacitor.isNativePlatform()) {
    const res = await FirebaseAuthentication.signInWithGoogle();
    const idToken = res.credential?.idToken;
    if (!idToken) throw new Error("Google login fail hua");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } else {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
}

export function Auth() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      await googleSignIn();
    } catch (e) {
      const msg = errorText(e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="safe-top relative flex h-dvh flex-col overflow-hidden bg-ink text-paper">
      <HauntedBg />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <Witch className="witch-float fade-up h-[34dvh] max-h-72 w-auto" />
        <h1 className="blood-text fade-up mt-4 font-display text-5xl leading-none font-bold tracking-wide" style={{ "--d": 120 } as CSSProperties}>
          IRONROSES
          <span className="grad-text block text-7xl">MSG</span>
        </h1>
        <div className="fade-up -mt-1" style={{ "--d": 200 } as CSSProperties}>
          <Drips />
        </div>
        <p className="fade-up mt-5 max-w-xs text-pretty text-paper/70" style={{ "--d": 280 } as CSSProperties}>
          Andhera ho gaya hai… apne squad ko bulao. 👻
        </p>
        {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void go()}
          className="fade-up tap mt-7 flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white px-4 font-semibold text-ink shadow-[0_0_34px_-4px_rgba(225,29,72,0.7)] disabled:opacity-60"
          style={{ "--d": 380 } as CSSProperties}
        >
          <GoogleG className="size-6" />
          {busy ? "Signing in…" : "Sign up with Google"}
        </button>
        <p className="fade-up mt-4 text-xs text-paper/40" style={{ "--d": 460 } as CSSProperties}>
          Google se login karte hi tumhari ID ban jayegi
        </p>
      </div>
    </main>
  );
}
