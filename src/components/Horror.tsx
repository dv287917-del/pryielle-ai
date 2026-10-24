/** Old haunted background removed: now a calm premium blue glow (kept under the same name for existing screens). */
export function HauntedBg(_props: { lightning?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#050b2e 0%,#07226f 60%,#0a3bc9 130%)" }} />
      <div className="glow-orb absolute -left-24 top-[10%] size-72 rounded-full bg-sky-400/30 blur-3xl" />
      <div className="glow-orb late absolute -right-24 bottom-[10%] size-80 rounded-full bg-indigo-500/35 blur-3xl" />
    </div>
  );
}
