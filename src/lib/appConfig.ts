import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/** MSG ke `config/app` doc ke AI wale fields (MSG ke `update*` se alag). */
export type AiConfig = {
  aiUpdateVersion: string;
  aiUpdateTitle: string;
  aiUpdateNotes: string;
  aiUpdateUrl: string;
  aiUpdateParts: number;
  aiUpdateSize: number;
  aiUpdateForce: boolean;
};

export const EMPTY_AI_CONFIG: AiConfig = {
  aiUpdateVersion: "", aiUpdateTitle: "", aiUpdateNotes: "", aiUpdateUrl: "", aiUpdateParts: 0, aiUpdateSize: 0, aiUpdateForce: false,
};

export function watchAiConfig(cb: (c: AiConfig) => void) {
  return onSnapshot(
    doc(db, "config", "app"),
    (s) => {
      const d = (s.data() ?? {}) as Partial<AiConfig>;
      cb({
        aiUpdateVersion: d.aiUpdateVersion ?? "",
        aiUpdateTitle: d.aiUpdateTitle ?? "",
        aiUpdateNotes: d.aiUpdateNotes ?? "",
        aiUpdateUrl: d.aiUpdateUrl ?? "",
        aiUpdateParts: Number(d.aiUpdateParts ?? 0),
        aiUpdateSize: Number(d.aiUpdateSize ?? 0),
        aiUpdateForce: Boolean(d.aiUpdateForce),
      });
    },
    () => cb(EMPTY_AI_CONFIG),
  );
}

/** "1.10.0" > "1.9.2" sahi se compare kare */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
