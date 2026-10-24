import { useState, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/util";
import { BlueBg, IronRose, Sparkle } from "./Brand";

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

/** Welcome / sign-in: blue→white glow, rose hero, black + grey pill buttons (Google auth kept). */
export function Auth() {
  const [busy, setBusy] = useState<"" | "new" | "old">("");
  const [error, setError] = useState("");

  async function go(kind: "new" | "old") {
    setBusy(kind);
    setError("");
    try {
      await googleSignIn();
    } catch (e) {
      const msg = errorText(e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="safe-top relative flex h-dvh flex-col items-center overflow-hidden px-6 text-white">
      <BlueBg />
      <div className="fade-up relative mt-7 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-white/15 ring-1 ring-white/50 backdrop-blur"><IronRose className="size-6" /></span>
        <span className="font-display text-2xl font-bold tracking-wide">IronRoses</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative">
          <span className="boot-halo absolute -inset-8 rounded-full" />
          <IronRose className="rose-float relative size-52 drop-shadow-[0_28px_50px_rgba(10,40,160,0.55)]" />
          <Sparkle className="sparkle-a absolute -right-2 -top-2 size-10" />
          <Sparkle className="sparkle-b absolute -left-4 bottom-8 size-5" />
        </div>
      </div>

      <div className="fade-up relative w-full max-w-sm pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center" style={{ "--d": 140 } as CSSProperties}>
        <h1 className="font-display text-[2rem] leading-[1.1] font-bold text-slate-900">Chat, done right.<br />Anytime, anywhere</h1>
        {error ? <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        <button type="button" disabled={Boolean(busy)} onClick={() => void go("new")} className="premium-btn tap mt-6 h-14 w-full rounded-2xl font-display text-lg font-bold tracking-wide disabled:opacity-60">
          {busy === "new" ? "Signing in…" : "Get Started"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void go("old")} className="tap mt-3 h-14 w-full rounded-2xl bg-slate-200/80 font-display text-lg font-semibold text-slate-800 backdrop-blur disabled:opacity-60">
          {busy === "old" ? "Signing in…" : "I already have an account"}
        </button>
        <p className="mt-4 text-[11px] leading-snug text-slate-500">Continue with Google · Owner approves every new ID.<br />By continuing you agree to our Terms of Service and Privacy Policy</p>
      </div>
    </main>
  );
}
