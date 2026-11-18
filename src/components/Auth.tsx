import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/util";
import { RoseEmblem, Sparkle, useStatusBar } from "./Brand";

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

/** Welcome screen: sapphire sky + glowing rose, Get Started / I already have an account (dono Google se). */
export function Auth() {
  const [busy, setBusy] = useState<"" | "new" | "old">("");
  const [error, setError] = useState("");
  useStatusBar("#051a96");

  async function go(which: "new" | "old") {
    if (busy) return;
    setBusy(which);
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
    <main className="ir-sky safe-top relative flex h-dvh flex-col overflow-hidden text-white">
      <header className="ir-rise relative flex shrink-0 items-center justify-center gap-2 pt-5">
        <RoseEmblem className="size-8" />
        <span className="font-display text-[1.55rem] font-bold tracking-[0.03em]">IronRoses</span>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center">
        <span className="ir-glow" style={{ width: 300, height: 300 }} />
        <div className="ir-bloom ir-float relative">
          <RoseEmblem className="h-[min(56vw,250px)] w-[min(56vw,250px)]" spin />
          <Sparkle className="top-1 -right-3 size-6" d={200} />
          <Sparkle className="bottom-6 -left-5 size-4" d={1200} />
          <Sparkle className="-top-4 left-6 size-3" d={2000} />
        </div>
      </section>

      <section className="relative shrink-0 px-6 pb-[max(1.4rem,env(safe-area-inset-bottom))] text-center text-[#0b0f1d]">
        <h1 className="ir-rise text-[1.5rem] leading-[1.2] font-semibold tracking-tight" style={{ "--d": 150 } as never}>
          Chats, made premium.<br />Anytime, anywhere.
        </h1>
        {error ? <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <button type="button" disabled={Boolean(busy)} onClick={() => void go("new")} className="ir-btn-dark ir-rise tap mt-6 h-[3.3rem] w-full rounded-2xl text-[1rem] font-semibold disabled:opacity-70" style={{ "--d": 260 } as never}>
          {busy === "new" ? "Signing in…" : "Get Started"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void go("old")} className="ir-btn-soft ir-rise tap mt-3 h-[3.3rem] w-full rounded-2xl text-[1rem] font-semibold disabled:opacity-70" style={{ "--d": 340 } as never}>
          {busy === "old" ? "Signing in…" : "I already have an account"}
        </button>
        <p className="mt-4 text-[0.7rem] leading-snug text-[#5b6478]">
          Google se secure sign-in · Nayi ID par owner approval lagta hai.<br />Continue karke aap IronRoses ke rules maante ho.
        </p>
      </section>
    </main>
  );
}
