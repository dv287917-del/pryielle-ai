import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AI_API_URL } from "./aiUrl";

/**
 * Feature Pack = AI ka banaya hua chhota self-contained feature (HTML/CSS/JS).
 * featureDrafts/{id}  -> sirf admin (Preview). AI ke edits yahin jaate hain.
 * featurePacks/{id}   -> LIVE copy; sabhi approved users ke Home par turant (snapshot), APK update nahi chahiye.
 * Publish = draft ko live mein copy. Unpublish = live copy delete (draft bacha rehta hai).
 */
export type Pack = {
  id: string;
  title: string;
  icon: string;
  summary: string;
  html: string;
  rev: number;
  updatedAt: number;
  publishedAt?: number;
};
export type AdminPack = Pack & { live: boolean; dirty: boolean };

export const PACK_MAX_HTML = 300_000;
const live = () => collection(db, "featurePacks");
const drafts = () => collection(db, "featureDrafts");

const toPack = (id: string, d: Record<string, unknown>): Pack => ({
  id,
  title: typeof d.title === "string" && d.title.trim() ? d.title.slice(0, 60) : "New feature",
  icon: typeof d.icon === "string" && d.icon.trim() ? d.icon.slice(0, 4) : "✨",
  summary: typeof d.summary === "string" ? d.summary.slice(0, 300) : "",
  html: typeof d.html === "string" ? d.html : "",
  rev: Number(d.rev) || 1,
  updatedAt: Number(d.updatedAt) || 0,
  publishedAt: d.publishedAt ? Number(d.publishedAt) : undefined,
});

/** Sabhi users: live packs, real-time. */
export function watchLivePacks(cb: (l: Pack[]) => void): () => void {
  return onSnapshot(live(), (s) => cb(s.docs.map((d) => toPack(d.id, d.data())).sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0))), () => cb([]));
}

/** Admin: drafts + live dono jod kar. */
export function watchAdminPacks(cb: (l: AdminPack[]) => void, onErr?: (e: unknown) => void): () => void {
  let d: Pack[] = [];
  let l: Pack[] = [];
  const emit = () => {
    const liveMap = new Map(l.map((p) => [p.id, p]));
    cb(d.map((p) => { const lp = liveMap.get(p.id); return { ...p, publishedAt: lp?.publishedAt, live: !!lp, dirty: !!lp && lp.rev !== p.rev }; }));
  };
  const u1 = onSnapshot(query(drafts(), orderBy("updatedAt", "desc")), (s) => { d = s.docs.map((x) => toPack(x.id, x.data())); emit(); }, (e) => onErr?.(e));
  const u2 = onSnapshot(live(), (s) => { l = s.docs.map((x) => toPack(x.id, x.data())); emit(); }, (e) => onErr?.(e));
  return () => { u1(); u2(); };
}

/** AI ka naya/edited feature sirf DRAFT mein jaata hai — live users ko kuch nahi badalta. */
export async function savePackDraft(id: string | null, p: { title: string; icon: string; summary: string; html: string }, prevRev = 0): Promise<{ id: string; rev: number }> {
  if (p.html.length > PACK_MAX_HTML) throw new Error("Feature bahut bada hai (300 KB se zyada). Chhota banwao.");
  const now = Date.now();
  const rev = prevRev + 1;
  if (id) {
    await setDoc(doc(db, "featureDrafts", id), { ...p, rev, updatedAt: now }, { merge: true });
    return { id, rev };
  }
  const r = await addDoc(drafts(), { ...p, rev, createdAt: now, updatedAt: now });
  return { id: r.id, rev };
}

export const publishPack = (p: Pack) => setDoc(doc(db, "featurePacks", p.id), { title: p.title, icon: p.icon, summary: p.summary, html: p.html, rev: p.rev, updatedAt: Date.now(), publishedAt: p.publishedAt ?? Date.now() });
export const unpublishPack = (id: string) => deleteDoc(doc(db, "featurePacks", id));
export const deletePack = async (id: string) => { await deleteDoc(doc(db, "featurePacks", id)).catch(() => undefined); await deleteDoc(doc(db, "featureDrafts", id)); };

/* ================= AI Builder API (Vercel, admin-only) ================= */
export type BuilderAttachment = { kind: "image" | "pdf" | "text"; mime?: string; name?: string; data?: string; text?: string };
export type BuilderFile = { name: string; mime: string; content: string };
export type BuilderTurn = { role: "user" | "assistant"; text: string };
export type BuilderReply = {
  reply: string;
  pack: { title: string; icon: string; summary: string; html: string } | null;
  files: BuilderFile[];
  imagePrompt: string;
};

async function post<T>(body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Dobara login karo.");
  const token = await user.getIdToken();
  const r = await fetch(AI_API_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(data.error || `Server error (${r.status})`));
  return data as T;
}

export const askBuilder = (messages: BuilderTurn[], attachments: BuilderAttachment[], current: { title: string; html: string } | null) =>
  post<BuilderReply>({ action: "build", messages, attachments, current });
export const makeImage = (prompt: string, ref?: BuilderAttachment) => post<{ image: string; mime: string; text: string }>({ action: "image", prompt, ref });

/* ================= Sandbox wrapper ================= */
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'";
const BRIDGE = `<script>(function(){var S={},U={};
window.PRY={user:U,get:function(k,d){return k in S?S[k]:d},set:function(k,v){S[k]=v;parent.postMessage({pry:1,type:"set",key:String(k),value:v},"*")},close:function(){parent.postMessage({pry:1,type:"close"},"*")},toast:function(t){parent.postMessage({pry:1,type:"toast",text:String(t)},"*")}};
window.addEventListener("message",function(e){var d=e.data;if(d&&d.pry&&d.type==="init"){S=d.store||{};U=d.user||{};window.PRY.user=U;window.dispatchEvent(new Event("pry-ready"))}});
parent.postMessage({pry:1,type:"ready"},"*")})();<\/script>`;

export function packSrcDoc(html: string): string {
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>html,body{margin:0;min-height:100%;background:#0b1630;color:#fff;font-family:system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}*{box-sizing:border-box}</style>${BRIDGE}`;
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], `${m[0]}${head}`);
  if (/<html/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => `${h}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}
