import { useState, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/util";
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

/** Sky-blue glass login panel (SHRUHH-style structure, Google auth kept). */
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
    <main
      className="safe-top relative flex h-dvh flex-col items-center justify-center overflow-hidden px-5 text-paper"
      style={{
        background: "radial-gradient(120% 80% at 20% 10%, #38bdf8 0%, transparent 50%), radial-gradient(100% 70% at 90% 90%, #6366f1 0%, transparent 45%), linear-gradient(160deg, #0c1a2e 0%, #0a1628 40%, #1e1b4b 100%)",
      }}
    >
      {/* soft blobs */}
      <div className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-sky-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-20 size-80 rounded-full bg-indigo-500/30 blur-3xl" />

      <div
        className="relative w-full max-w-[360px] overflow-hidden rounded-[28px] border border-white/20 p-7 shadow-[0_25px_80px_-20px_rgba(56,189,248,0.45)]"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/25">
          <span className="font-display text-2xl font-bold tracking-tight text-sky-200">IR</span>
        </div>

        <h1 className="text-center font-display text-[1.65rem] font-bold tracking-wide text-white">
          Welcome Back
        </h1>
        <p className="mt-1 text-center text-sm text-sky-100/70">IronRoses MSG · Google se continue karo</p>

        {error ? <p className="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-center text-sm text-rose-200">{error}</p> : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void go()}
          className="tap mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-2xl font-semibold text-slate-900 shadow-lg disabled:opacity-60"
          style={{
            background: "linear-gradient(90deg, #7dd3fc 0%, #a5b4fc 50%, #c4b5fd 100%)",
            boxShadow: "0 12px 40px -8px rgba(125,211,252,0.55)",
          }}
        >
          <GoogleG className="size-5" />
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <p className="mt-5 text-center text-[11px] text-white/40">
          Login karte hi ID ban jayegi · Owner approve karega
        </p>
      </div>
    </main>
  );
}
