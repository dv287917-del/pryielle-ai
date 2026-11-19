import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/util";
import { useStatusBar } from "./Brand";
import appLogo from "../assets/brand/logo.png";
import "./pryielle.css";
import "./auth.css";

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

/** Sign In: Loading/Home jaisa sky + glass theme. Sirf Google login (email option nahi). */
export function Auth() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useStatusBar("#cfe8fb");

  async function go() {
    if (busy) return;
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
    <main className="au-root">
      <div className="wl2-grid" />
      <div className="wl2-sky"><div className="wl2-rays" /></div>
      <span className="au-blob blue" />
      <span className="au-blob pink" />
      <span className="au-blob yellow" />

      <section className="au-hero">
        <div className="au-logo-wrap">
          <img className="au-logo" src={appLogo} alt="Pryielle" draggable={false} />
        </div>
        <h1 className="au-name">Pryielle</h1>
        <p className="au-tag">Chats, made premium</p>
      </section>

      <section className="au-card">
        <h2 className="au-h">Welcome</h2>
        <p className="au-p">Sign in karo aur apni chats, stories aur dosto ke saath shuru ho jao.</p>
        {error ? <p className="au-err" role="alert">{error}</p> : null}
        <button type="button" className="au-btn" disabled={busy} onClick={() => void go()}>
          {busy ? (
            <><span className="au-spin" /> Signing in…</>
          ) : (
            <>
              <span className="au-g" aria-hidden="true">
                <svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.2 7-10.3 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
              </span>
              Continue with Google
            </>
          )}
        </button>
        <p className="au-note">Google se secure sign-in · Nayi ID par owner approval lagta hai.<br />Continue karke aap Pryielle ke rules maante ho.</p>
      </section>
    </main>
  );
}
