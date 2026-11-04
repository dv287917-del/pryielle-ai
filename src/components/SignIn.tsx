import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Burst, GoogleG, Hero } from "./art";

async function googleSignIn(hint?: string) {
  if (Capacitor.isNativePlatform()) {
    const res = await FirebaseAuthentication.signInWithGoogle();
    const idToken = res.credential?.idToken;
    if (!idToken) throw new Error("Google login fail hua");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } else {
    const p = new GoogleAuthProvider();
    if (hint) p.setCustomParameters({ login_hint: hint });
    await signInWithPopup(auth, p);
  }
  // Email se login: typed email aur Google account same hona chahiye
  if (hint && auth.currentUser?.email?.toLowerCase() !== hint.toLowerCase()) {
    const got = auth.currentUser?.email ?? "";
    await signOut(auth);
    throw new Error(`Ye ${got} hai, tumne ${hint} likha tha. Sahi account chuno.`);
  }
}

export function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  async function google(hint?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await googleSignIn(hint);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(m)) setError(m);
    } finally {
      setBusy(false);
    }
  }

  // Email login = wahi MSG wala Google account, bas email pehle likhte ho (same uid, same users doc)
  function emailGo() {
    const v = email.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("Sahi email likho.");
    void google(v);
  }

  return (
    <main className="signin">
      <header className="brand">
        <Burst size={37} />
        <span>Pryielle AI</span>
      </header>

      <Hero />

      <h1 className="tagline">The AI for problem solvers</h1>

      <section className="actions">
        {error ? <p className="err">{error}</p> : null}
        <button type="button" className="gbtn" onClick={() => void google()} disabled={busy}>
          <GoogleG />
          <span>{busy ? "Signing in…" : "Continue with Google"}</span>
        </button>

        <div className="or"><i /><span>OR</span><i /></div>

        <input
          className="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && emailGo()}
        />

        <p className="legal">
          By continuing, you agree to Pryielle’s <u>Consumer Terms</u> and <u>Usage Policy</u>, and acknowledge their <u>Privacy Policy</u>.
        </p>
      </section>
    </main>
  );
}
