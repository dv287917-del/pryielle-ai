/**
 * Mic + Camera allow ke bina app Shell nahi khulegi.
 */
import { useEffect, useState } from "react";
import { Camera, Mic } from "lucide-react";
import { checkMediaAccess, requestMediaAccess, type MediaAccessState } from "../lib/mediaAccess";
import { galleryRequestAccess } from "../lib/device";

export function MediaGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "need">("loading");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // pehle soft check
      const c = await checkMediaAccess();
      if (!alive) return;
      if (c.ok) {
        setState("ok");
        return;
      }
      // auto request once
      const r = await requestMediaAccess();
      if (!alive) return;
      if (r.ok) {
        void galleryRequestAccess().catch(() => undefined);
        setState("ok");
      }
      else {
        setState("need");
        setDetail(r.detail || r.reason);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const retry = async () => {
    setBusy(true);
    setDetail("");
    const r = await requestMediaAccess();
    if (r.ok) void galleryRequestAccess().catch(() => undefined);
    setBusy(false);
    if (r.ok) setState("ok");
    else {
      setState("need");
      setDetail(r.detail || r.reason);
    }
  };

  if (state === "ok") return <>{children}</>;

  if (state === "loading") {
    return (
      <div className="grid h-dvh place-items-center bg-ink text-paper">
        <p className="text-sm text-paper/55">Mic & camera check…</p>
      </div>
    );
  }

  return (
    <div className="safe-top relative flex h-dvh flex-col items-center justify-center bg-ink px-6 text-paper">
      <div className="fade-up w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto flex gap-3">
          <span className="grid size-14 place-items-center rounded-2xl bg-paper/10">
            <Mic className="size-7 text-rose" />
          </span>
          <span className="grid size-14 place-items-center rounded-2xl bg-paper/10">
            <Camera className="size-7 text-rose" />
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold">Permission zaroori</h1>
        <p className="text-sm leading-relaxed text-paper/65">
          Mic aur Camera dono allow karo. Bina iske app open nahi hogi. Settings se bhi allow kar
          sakte ho agar pehle Deny kiya ho.
        </p>
        {detail ? <p className="text-xs text-rose/80">{detail}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void retry()}
          className="btn-hot tap h-12 w-full rounded-2xl font-display text-base font-bold"
        >
          {busy ? "…" : "Allow karo"}
        </button>
        <p className="text-[0.7rem] text-paper/40">
          Android: App info → Permissions → Microphone + Camera → Allow
        </p>
      </div>
    </div>
  );
}
