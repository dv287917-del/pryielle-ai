// Builder server actions (api/_builder.js) ke liye client wrappers.
import { auth } from "../firebase";
import { AI_API_URL } from "./aiUrl";
import type { AiAttachment } from "./ai";

export type BuilderBase = "draft" | "live" | "new";
export type GenerateResult = { ok: boolean; warnings: string[]; updatedAt: number; basedOnVersion: number };
export type PublishResult = { ok: boolean; version: number; title: string; notes: string; active: boolean; rolledBackFrom?: number };

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Dobara login karo.");
  try {
    const token = await user.getIdToken();
    const r = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...body }),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.status === 413) throw new Error("Files bahut badi hain. Chhoti photo/PDF bhejo.");
    if (r.status === 404 && !data.error) throw new Error("AI server nahi mila. Vercel deploy aur app ka AI URL check karo.");
    if (r.status === 400 && /Unknown action/.test(String(data.error || ""))) throw new Error("AI server purana hai. Vercel par naya api/ai.js aur api/_builder.js deploy karo.");
    if (!r.ok) throw new Error(String(data.error || `Builder request failed (${r.status})`));
    return data as T;
  } catch (e) {
    if (e instanceof TypeError) throw new Error("Server tak nahi pahunch paaye. Internet check karo ya thodi der baad try karo.");
    if (e instanceof Error) throw e;
    throw new Error("Builder abhi jawab nahi de pa raha.");
  }
}

export const builderGenerate = (prompt: string, base: BuilderBase, attachments: AiAttachment[]) => call<GenerateResult>("builderGenerate", { prompt, base, attachments });
export const builderDiscard = () => call<{ ok: boolean }>("builderDiscard");
export const builderPublish = (expectUpdatedAt: number) => call<PublishResult>("builderPublish", { expectUpdatedAt });
export const builderUnpublish = () => call<PublishResult>("builderUnpublish");
export const builderRollback = (version: number) => call<PublishResult>("builderRollback", { version });
