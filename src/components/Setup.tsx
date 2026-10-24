import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import type { User } from "firebase/auth";
import { checkUsername, createProfile } from "../lib/data";
import { getDeviceId, getPublicIp } from "../lib/device";
import { isAdminEmail } from "../lib/extra";
import { signupBlock } from "../lib/security";
import { compressImage, errorText, withTimeout } from "../lib/util";
import { Avatar, Field, fieldClass } from "./ui";
import { BlueBg, IronRose } from "./Brand";
import type { UserDoc } from "../lib/types";

const JUNK_NAMES = new Set(["player", "grok user", "dev user", "user"]);

function startName(user: User): string {
  const name = user.displayName?.trim() ?? "";
  return name && !JUNK_NAMES.has(name.toLowerCase()) ? name.slice(0, 24) : "";
}

type Avail = { state: "idle" | "busy" | "ok" | "bad" | "warn"; text: string };

const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2;
  const dist = 120 + ((i * 37) % 90);
  const colors = ["#ff7a1a", "#ff2e7e", "#8b5cf6", "#22d3ee", "#ffd166"];
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist),
    r: (i * 53) % 360,
    d: (i % 6) * 40,
    c: colors[i % colors.length],
  };
});

export function Setup({ user, onBegin, onEnter }: { user: User; onBegin: () => void; onEnter: (profile: UserDoc) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(startName(user));
  const [avatar, setAvatar] = useState<string | null>(user.photoURL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<UserDoc | null>(null);
  const [check, setCheck] = useState<Avail>({ state: "idle", text: "" });

  useEffect(() => {
    const name = username.trim();
    if (!name) {
      setCheck({ state: "idle", text: "" });
      return;
    }
    if (!/^[a-z0-9_]{3,16}$/.test(name)) {
      setCheck({ state: "bad", text: "3–16 letters, numbers ya _" });
      return;
    }
    let stop = false;
    setCheck({ state: "busy", text: "" });
    const timer = window.setTimeout(() => {
      withTimeout(checkUsername(name, user.uid), 8000, "Username check nahi ho paya (internet / Firestore rules). Tum phir bhi try kar sakte ho.")
        .then((res) => {
          if (!stop) setCheck({ state: res.ok ? "ok" : "bad", text: res.text });
        })
        .catch((e) => {
          // a failed check must never lock the button: createProfile does the real check
          if (!stop) setCheck({ state: "warn", text: errorText(e) });
        });
    }, 350);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [username, user.uid]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setAvatar(await compressImage(file, 256, 0.75, 60_000));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    onBegin();
    try {
      const [deviceId, lastIp] = await Promise.all([getDeviceId(), getPublicIp()]);
      const isOwner = isAdminEmail(user.email);
      if (!isOwner) {
        const block = await signupBlock(deviceId, lastIp, user.uid);
        if (block) throw new Error(block);
      }
      setIssued(
        await withTimeout(
          createProfile(user.uid, { username, displayName, avatar, deviceId, lastIp, isOwner }),
          20_000,
          "Server se jawab nahi aaya. Internet aur Firestore rules (Publish) check karo.",
        ),
      );
    } catch (e) {
      onEnter(null as unknown as UserDoc);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return (
      <main className="safe-top relative flex h-dvh flex-col overflow-hidden text-white">
        <BlueBg fadeToWhite={false} />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="spark"
            style={{ "--x": `${s.x}px`, "--y": `${s.y}px`, "--r": `${s.r}deg`, "--d": s.d, background: s.c } as CSSProperties}
          />
        ))}
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="pop-in">
            <Avatar src={issued.avatar} name={issued.displayName} size="lg" live />
          </div>
          <p className="fade-up mt-6 font-display text-sm font-semibold tracking-[0.3em] text-paper/60" style={{ "--d": 200 } as CSSProperties}>
            YOUR ID
          </p>
          <p className="grad-text mt-2 font-display text-7xl font-bold tabular-nums md:text-8xl">
            {issued.publicId.split("").map((digit, i) => (
              <span key={i} className="id-digit" style={{ animationDelay: `${300 + i * 70}ms` }}>
                {digit}
              </span>
            ))}
          </p>
          <p className="fade-up mt-4 max-w-xs text-pretty text-paper/70" style={{ "--d": 900 } as CSSProperties}>
            <span className="font-semibold text-paper">@{issued.username}</span> ready hai.{" "}
            {issued.approval === "pending" ? "Ab tumhari request owner ke paas jayegi. Approve hone ke baad hi app khulega." : "Dost is ID se tumhe search karke message kar sakte hain."}
          </p>
          <button
            type="button"
            onClick={() => onEnter(issued)}
            className="btn-hot tap fade-up mt-8 h-14 rounded-2xl px-10 font-display text-xl font-bold tracking-wide"
            style={{ "--d": 1100 } as CSSProperties}
          >
            LET&apos;S GO
          </button>
        </div>
      </main>
    );
  }

  const canSubmit = !busy && displayName.trim().length > 0 && /^[a-z0-9_]{3,16}$/.test(username) && check.state !== "bad" && check.state !== "busy";

  return (
    <main className="safe-top relative flex h-dvh flex-col overflow-hidden text-white">
      <BlueBg fadeToWhite={false} />
      <form
        className="relative mx-auto my-auto flex max-h-full w-full max-w-md flex-col gap-5 overflow-y-auto rounded-[32px] border border-white/25 bg-black/25 px-6 py-8 shadow-[0_30px_80px_-20px_rgba(60,120,255,0.6)] backdrop-blur-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
      >
        <div className="fade-up">
          <IronRose className="size-14 drop-shadow-[0_10px_24px_rgba(140,180,255,0.8)]" />
          <h1 className="mt-5 font-display text-5xl leading-none font-bold">
            Profile <span className="grad-text">banao</span>
          </h1>
          <p className="mt-3 text-pretty text-sm text-paper/60">
            Naam aur photo sabko dikhegi. 8-digit ID hum denge, wo change nahi hoti.
          </p>
          <p className="mt-2 text-pretty text-xs text-paper/40">Request banate hi owner ke paas approval ke liye jayegi. Safety ke liye chats moderation mein review ho sakti hain.</p>
        </div>

        <div className="fade-up flex items-center gap-4" style={{ "--d": 100 } as CSSProperties}>
          <button type="button" onClick={() => fileRef.current?.click()} className="tap relative rounded-full" aria-label="Upload profile photo">
            <Avatar src={avatar} name={displayName || username || "P"} size="lg" />
            <span className="grad absolute right-0 bottom-0 grid size-8 place-items-center rounded-full text-white ring-4 ring-blue-900">
              <Camera className="size-4" />
            </span>
          </button>
          <div className="min-w-0">
            <p className="font-semibold">Profile photo</p>
            <p className="text-sm text-paper/55">Circle par tap karke photo lagao.</p>
            {user.photoURL && avatar !== user.photoURL ? (
              <button type="button" className="mt-1 text-sm font-semibold text-rose" onClick={() => setAvatar(user.photoURL)}>
                Google photo use karo
              </button>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>

        <div className="fade-up" style={{ "--d": 180 } as CSSProperties}>
          <Field label="DISPLAY NAME">
            <input className={fieldClass} value={displayName} maxLength={24} required placeholder="Tumhara naam" onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
        </div>

        <div className="fade-up" style={{ "--d": 260 } as CSSProperties}>
          <Field
            label="USERNAME"
            hint={
              check.state === "busy" ? (
                <Loader2 className="size-4 animate-spin text-paper/50" />
              ) : check.state === "ok" ? (
                <span className="flex items-center gap-1 text-aqua">
                  <Check className="size-4" /> {check.text}
                </span>
              ) : check.state === "bad" ? (
                <span className="flex items-center gap-1 text-rose">
                  <X className="size-4" /> {check.text}
                </span>
              ) : null
            }
          >
            <input
              className={fieldClass}
              value={username}
              maxLength={16}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="apna username chuno"
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
          </Field>
        </div>

        {check.state === "warn" ? <p className="-mt-2 text-xs text-hot">{check.text}</p> : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        <button
          type="submit"
          disabled={!canSubmit}
          className="premium-btn tap fade-up h-14 rounded-2xl font-display text-xl font-bold tracking-wide"
          style={{ "--d": 340 } as CSSProperties}
        >
          {busy ? "SENDING…" : "CREATE ID & SEND REQUEST"}
        </button>
      </form>
    </main>
  );
}
