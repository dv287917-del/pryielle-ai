import { useEffect, useId, useState, type ReactNode } from "react";
import clsx from "clsx";
import type { Role } from "../lib/types";
import { FluidBg } from "./FluidBg";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pry-mark" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--c1)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--c2)" }} />
          <stop offset="1" style={{ stopColor: "var(--c3)" }} />
        </linearGradient>
      </defs>
      <path d="M24 3 43 14v20L24 45 5 34V14L24 3Z" fill="url(#pry-mark)" />
      <path
        d="M16.5 33V15.5h8.2c3.9 0 6.3 2.2 6.3 5.5s-2.4 5.6-6.3 5.6h-3.6V33h-4.6Zm4.6-10h3.2c1.5 0 2.3-.8 2.3-2s-.8-2-2.3-2h-3.2V23Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Aurora() {
  return (
    <>
      <div className="aurora">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
        <div className="theme-art" />
        <FluidBg />
      </div>
      <div className="grid-fade" />
    </>
  );
}

const sizeClass = {
  xs: "size-8 text-xs",
  sm: "size-10 text-sm",
  md: "size-12 text-base",
  lg: "size-24 text-4xl",
  row: "size-14 text-xl",
  note: "size-16 text-2xl",
  xl: "size-20 text-3xl",
} as const;

export function Avatar({
  src,
  name,
  size = "md",
  live = false,
}: {
  src: string | null;
  name: string;
  size?: keyof typeof sizeClass;
  live?: boolean;
}) {
  const initial = (Array.from(name.trim())[0] || "?").toUpperCase();
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  const usable = Boolean(src) && !bad && /^(data:image\/|https?:\/\/)/i.test(src as string);
  return (
    <span className={clsx("relative inline-block shrink-0 rounded-full", live && "ring-live")}>
      {usable ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBad(true)}
          className={clsx(sizeClass[size], "rounded-full object-cover ring-2 ring-paper/10")}
        />
      ) : (
        <span
          className={clsx(
            sizeClass[size],
            "grad grid place-items-center rounded-full font-display font-bold text-white",
          )}
        >
          {initial}
        </span>
      )}
    </span>
  );
}

/** Screenshot wala 16-spike seal (sharp points) + blocky white check. */
const SEAL = (() => {
  const pts: string[] = [];
  const n = 16;
  for (let i = 0; i < n * 2; i += 1) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 11.7 : 9.5;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();
const CHECK = "6.1,12.6 7.8,10.9 10.2,13.3 16.2,7.3 17.9,9 10.2,16.8";

/** Blue tick: pop + spin-in, check wipe, ring burst, heartbeat aur shine loop. */
export function VerifiedBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={clsx("vt-wrap", className)} role="img" aria-label="Verified" title="Verified">
      <i className="vt-ring" />
      <svg viewBox="0 0 24 24" className="vt-badge" aria-hidden="true">
        <defs>
          <clipPath id={`vt-c-${id}`}><polygon points={SEAL} /></clipPath>
          <clipPath id={`vt-k-${id}`}><rect className="vt-wipe" x="5" y="6" width="14" height="12" /></clipPath>
        </defs>
        <g className="vt-seal">
          <polygon points={SEAL} fill="#2b8cff" />
          <g clipPath={`url(#vt-c-${id})`}><g className="vt-shine"><rect x="-8" y="-3" width="5" height="30" fill="#fff" opacity="0.6" transform="skewX(-20)" /></g></g>
          <g clipPath={`url(#vt-k-${id})`}><polygon points={CHECK} fill="#fff" /></g>
        </g>
      </svg>
    </span>
  );
}

const SPARKLE = "M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z";

/** Screenshot wala PRO crown: orange→yellow, PRO text, kone ke sparkles, shine, glow. */
export function ProBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const crown = "M3 8C10 22 20 20 25 19C29 18 30 11 32 3C34 11 35 18 39 19C44 20 54 22 61 8L55 39Q54.5 43 51 43L13 43Q9.500 43 9 39Z";
  return (
    <span className={clsx("pro-badge", className)} role="img" aria-label="Pro" title="Pro">
      <svg viewBox="0 0 64 48" aria-hidden="true" overflow="visible">
        <defs>
          <linearGradient id={`pb-g-${id}`} x1="8" y1="8" x2="58" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff7a00" /><stop offset="0.55" stopColor="#ff9a00" /><stop offset="1" stopColor="#ffe100" />
          </linearGradient>
          <clipPath id={`pb-c-${id}`}><path d={crown} /></clipPath>
        </defs>
        <g className="pb-crown">
          <path d={crown} fill={`url(#pb-g-${id})`} />
          <path d="M32 9 34 12.500 32 16 30 12.500Z" fill="#b34a00" opacity="0.75" />
          <g clipPath={`url(#pb-c-${id})`}><g className="pb-shine"><rect x="-14" y="-4" width="9" height="56" fill="#fff" opacity="0.55" transform="skewX(-22)" /></g></g>
          <text x="32" y="36" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff" fontFamily="Arial Black, Arial, Helvetica, sans-serif" stroke="#c75a00" strokeWidth="0.6" paintOrder="stroke">PRO</text>
        </g>
        <path className="pb-star pb-st1" d={SPARKLE} fill="#fff" transform="translate(6 24) scale(1.1)" />
        <path className="pb-star pb-st2" d={SPARKLE} fill="#fff" transform="translate(58 26) scale(1.3)" />
        <path className="pb-star pb-st3" d={SPARKLE} fill="#fff7b0" transform="translate(50 6) scale(0.8)" />
      </svg>
    </span>
  );
}

/** OWNER (aag), ADMIN (bijli), OFFICER (hara) ke tagde animated labels. */
export function RoleBadge({ role, className }: { role: Role | undefined; className?: string }) {
  if (!role || role === "member") return null;
  if (role === "owner") {
    return (
      <span className={clsx("role role-owner", className)} aria-label="Owner" title="Owner">
        <svg viewBox="0 0 16 20" className="ro-flame" aria-hidden="true"><path d="M8 0c1 4.200 6 5.800 6 11.600C14 16 11.300 19 8 19s-6-3-6-7.400c0-3.200 2-4.200 2.700-7.200C6.200 5.300 7.400 4.700 8 0Z" fill="#ff5a00" /><path d="M8 8c.8 2.800 3.800 3.800 3.800 7.200 0 2-1.700 3.500-3.800 3.500s-3.800-1.500-3.800-3.500c0-1.800 1.200-2.500 1.700-4.200 1 .6 1.700.2 2.100-3Z" fill="#ffd23f" /></svg>
        <b className="ro-text">OWNER</b>
        <i className="ro-ember ro-e1" /><i className="ro-ember ro-e2" /><i className="ro-ember ro-e3" />
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className={clsx("role role-admin", className)} aria-label="Admin" title="Admin">
        <svg viewBox="0 0 16 16" className="ro-icon" aria-hidden="true"><path d="M8 1 14 3.500V8c0 3.200-2.400 5.600-6 7-3.600-1.400-6-3.800-6-7V3.500L8 1Z" fill="#fff" /><path d="M8.800 4 6 8.600h1.900L7.300 12 10.300 7.200H8.400L8.800 4Z" fill="#6d28d9" /></svg>
        <b className="ro-text">ADMIN</b>
      </span>
    );
  }
  return (
    <span className={clsx("role role-officer", className)} aria-label="Officer" title="Officer">
      <svg viewBox="0 0 16 16" className="ro-icon" aria-hidden="true"><path d="m8 1 2 4.300 4.700.6-3.400 3.300.9 4.700L8 11.600 3.800 13.900l.9-4.700L1.300 5.900 6 5.300 8 1Z" fill="#fff" /></svg>
      <b className="ro-text">OFFICER</b>
    </span>
  );
}

/** Naam ke saath role + blue tick + PRO badge. */
export function Badges({ u }: { u: { pro?: boolean; verified?: boolean; role?: Role } | null | undefined }) {
  if (!u) return null;
  const role = u.role && u.role !== "member" ? u.role : undefined;
  if (!role && !u.verified && !u.pro) return null;
  return (
    <span className="badges">
      {u.verified ? <VerifiedBadge /> : null}
      {u.pro ? <ProBadge /> : null}
      <RoleBadge role={role} />
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between font-display text-xs font-semibold tracking-[0.2em] text-paper/55">
        <span>{label}</span>
        {hint}
      </span>
      {children}
    </label>
  );
}

export const fieldClass =
  "h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 text-base text-paper outline-none transition-colors placeholder:text-paper/30 focus:border-rose/70 focus:bg-paper/8";

export function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.4-4.8 7.1l7.6 5.9c4.4-4.1 7-10.1 7-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300", on ? "grad" : "bg-paper/15")}>
      <span className={clsx("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform duration-300", on && "translate-x-5")} />
    </span>
  );
}
