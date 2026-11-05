// AI Builder ka app-side runtime: live config sunna, theme/flags lagana, draft Preview, "Update now" ka faisla.
// Sab kuch validate hota hai (shared/featureSchema) — Firestore ka data seedha kabhi render nahi hota.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import { validateFeatureConfig, type FeatureConfig } from "../../shared/featureSchema";
import { BUILTIN_FLAGS, THEME_VAR_NAMES, decideUpdate, effectiveFlags, parseLive, themeToVars } from "../../shared/featureRuntime";

const CACHE_KEY = "pryai.features.v1";
const FLAGS_KEY = "pryai.flags.v1";

type Applied = { version: number; config: FeatureConfig | null };
export type PendingUpdate = { version: number; title: string; notes: string };

/* ---------- storage (try/catch: private mode / quota me crash nahi) ---------- */
function readJson(key: string): unknown {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}
function loadApplied(): Applied | null {
  const raw = readJson(CACHE_KEY) as { version?: unknown; config?: unknown } | null;
  if (!raw || typeof raw !== "object") return null;
  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) return null;
  if (raw.config === null) return { version, config: null };
  const v = validateFeatureConfig(raw.config);
  return v.ok ? { version, config: v.config } : null;
}
function loadFlags(): Record<string, boolean> {
  const raw = readJson(FLAGS_KEY);
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) if (typeof v === "boolean" && /^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(k)) out[k] = v;
  return out;
}

/* ---------- theme ---------- */
export function applyTheme(config: FeatureConfig | null) {
  const root = document.documentElement;
  for (const n of THEME_VAR_NAMES) root.style.removeProperty(n);
  if (!config) return;
  const { vars, notes } = themeToVars(config.theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  if (notes.length) console.warn("[builder theme]", notes.join("; "));
}
/** main.tsx se, render se pehle: pichla applied theme turant (login screen par bhi, flash nahi) */
export function applyCachedTheme() {
  applyTheme(loadApplied()?.config ?? null);
}

/* ---------- context ---------- */
type Ctx = {
  /** abhi jo screen par lagi hai (preview ho to draft, warna applied live) */
  config: FeatureConfig | null;
  flags: Record<string, boolean>;
  setFlag: (name: string, value: boolean) => void;
  sendPrompt: (q: string) => void;
  setPromptHandler: (fn: ((q: string) => void) | null) => void;
  builder: boolean;
  hasDraft: boolean;
  preview: boolean;
  setPreview: (on: boolean) => void;
  pending: PendingUpdate | null;
  applyPending: () => void;
  skipPending: () => void;
};

const NOOP: Ctx = {
  config: null, flags: {}, setFlag: () => undefined, sendPrompt: () => undefined, setPromptHandler: () => undefined,
  builder: false, hasDraft: false, preview: false, setPreview: () => undefined, pending: null, applyPending: () => undefined, skipPending: () => undefined,
};
const FeaturesCtx = createContext<Ctx>(NOOP);
export const useFeatures = () => useContext(FeaturesCtx);

export function FeaturesProvider({ user, owner, children }: { user: User; owner: boolean; children: ReactNode }) {
  const [applied, setApplied] = useState<Applied | null>(loadApplied);
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  const [latest, setLatest] = useState<{ version: number; config: FeatureConfig } | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [approved, setApproved] = useState(false);
  const [draft, setDraft] = useState<FeatureConfig | null>(null);
  const [preview, setPreviewState] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(loadFlags);
  const promptRef = useRef<((q: string) => void) | null>(null);

  const commitApplied = useCallback((a: Applied) => {
    appliedRef.current = a;
    setApplied(a);
    writeJson(CACHE_KEY, a);
  }, []);

  /* live config: naya version -> chupchap lagao / popup / kuch nahi (shared/decideUpdate) */
  useEffect(
    () =>
      onSnapshot(
        doc(db, "appFeatures", "live"),
        (s) => {
          const live = parseLive(s.exists() ? s.data() : null);
          const act = decideUpdate(appliedRef.current?.version ?? null, live);
          if (!live) return;
          if (act === "apply") {
            commitApplied({ version: live.version, config: live.active ? live.config : null });
            setLatest(null);
          } else if (act === "prompt" && live.config) {
            setLatest({ version: live.version, config: live.config });
          } else if (act === "none" && live.version === appliedRef.current?.version) {
            setLatest(null);
          }
        },
        () => undefined, // network/rules error: jo laga hai wahi rahe
      ),
    [commitApplied],
  );

  /* builder access: owner ya builderAdmins/{uid}.approved */
  useEffect(
    () =>
      onSnapshot(
        doc(db, "builderAdmins", user.uid),
        (s) => setApproved(s.exists() && s.data()?.approved === true),
        () => setApproved(false),
      ),
    [user.uid],
  );
  const builder = owner || approved;

  /* draft (sirf builder): Preview ke liye */
  useEffect(() => {
    if (!builder) {
      setDraft(null);
      setPreviewState(false);
      return undefined;
    }
    return onSnapshot(
      doc(db, "appFeatures", "draft"),
      (s) => {
        if (!s.exists()) return setDraft(null);
        const v = validateFeatureConfig(s.data());
        setDraft(v.ok ? v.config : null);
      },
      () => setDraft(null),
    );
  }, [builder]);
  useEffect(() => { if (preview && !draft) setPreviewState(false); }, [preview, draft]);

  const shown = preview && draft ? draft : applied?.config ?? null;
  useEffect(() => applyTheme(shown), [shown]);

  const flags = useMemo(() => effectiveFlags(shown, overrides), [shown, overrides]);
  useEffect(() => {
    const cl = document.documentElement.classList;
    for (const n of BUILTIN_FLAGS) cl.toggle(`fx-${n}`, flags[n] === true);
  }, [flags]);

  const setFlag = useCallback((name: string, value: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev, [name]: value };
      writeJson(FLAGS_KEY, next);
      return next;
    });
  }, []);

  const pending: PendingUpdate | null = latest && latest.version !== skipped ? { version: latest.version, title: latest.config.title, notes: latest.config.notes } : null;
  const applyPending = useCallback(() => {
    if (!latest) return;
    commitApplied({ version: latest.version, config: latest.config });
    setLatest(null);
  }, [latest, commitApplied]);
  const skipPending = useCallback(() => { if (latest) setSkipped(latest.version); }, [latest]);

  const value = useMemo<Ctx>(
    () => ({
      config: shown,
      flags,
      setFlag,
      sendPrompt: (q) => promptRef.current?.(q),
      setPromptHandler: (fn) => { promptRef.current = fn; },
      builder,
      hasDraft: draft !== null,
      preview,
      setPreview: (on) => setPreviewState(on && draft !== null),
      pending,
      applyPending,
      skipPending,
    }),
    [shown, flags, setFlag, builder, draft, preview, pending, applyPending, skipPending],
  );
  return <FeaturesCtx.Provider value={value}>{children}</FeaturesCtx.Provider>;
}
