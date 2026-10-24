import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AI_API_URL } from "./aiUrl";

/**
 * Feature Pack = AI ka banaya hua chhota self-contained feature (HTML/CSS/JS).
 * featureDrafts/{id}  -> sirf admin (Preview). AI ke edits yahin jaate hain.
 * featurePacks/{id}   -> LIVE copy; sabhi approved users ke Home par turant (snapshot), APK update nahi chahiye.
 * Publish = draft ko live mein copy. Unpublish = live copy delete (draft bacha rehta hai).
 */
export type PackSlot = "home" | "secret";
export type Pack = {
  id: string;
  slot: PackSlot;
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
  slot: d.slot === "secret" ? "secret" : "home",
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
export async function savePackDraft(id: string | null, p: { title: string; icon: string; summary: string; html: string; slot: PackSlot }, prevRev = 0): Promise<{ id: string; rev: number }> {
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

export const publishPack = (p: Pack) => setDoc(doc(db, "featurePacks", p.id), { slot: p.slot, title: p.title, icon: p.icon, summary: p.summary, html: p.html, rev: p.rev, updatedAt: Date.now(), publishedAt: p.publishedAt ?? Date.now() });
export const unpublishPack = (id: string) => deleteDoc(doc(db, "featurePacks", id));
export const deletePack = async (id: string) => { await deleteDoc(doc(db, "featurePacks", id)).catch(() => undefined); await deleteDoc(doc(db, "featureDrafts", id)); };

/* ================= AI Builder API (Vercel, admin-only, 3 stage: spec -> code -> review) ================= */
export type BuilderAttachment = { kind: "image" | "pdf" | "text"; mime?: string; name?: string; data?: string; text?: string };
export type BuilderFile = { name: string; mime: string; content: string };
export type BuilderTurn = { role: "user" | "assistant"; text: string };
export type FeatureSpec = {
  title: string; icon: string; slot: PackSlot; summary: string;
  requirements: string[]; screens: string; behavior: string; visual: string; audio: string;
};
export type SpecReply = {
  kind: "feature" | "chat" | "image" | "file";
  reply: string; imagePrompt: string; files: BuilderFile[]; spec: FeatureSpec | null;
};
type Cur = { title: string; html: string } | null;

async function post<T>(body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Dobara login karo.");
  const token = await user.getIdToken();
  const r = await fetch(AI_API_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(data.error || `Server error (${r.status})`));
  return data as T;
}

export const stageSpec = (messages: BuilderTurn[], attachments: BuilderAttachment[], current: Cur) =>
  post<SpecReply>({ action: "build", stage: "spec", messages, attachments, current });
export const stageCode = (messages: BuilderTurn[], attachments: BuilderAttachment[], current: Cur, spec: FeatureSpec) =>
  post<{ html: string }>({ action: "build", stage: "code", messages, attachments, current, spec });
export const stageReview = (spec: FeatureSpec, html: string, errors: string[], attachments: BuilderAttachment[]) =>
  post<{ html: string; issues: string; changed: boolean }>({ action: "build", stage: "review", spec, html, errors, attachments });
export const makeImage = (prompt: string, ref?: BuilderAttachment) => post<{ image: string; mime: string; text: string }>({ action: "image", prompt, ref });

/* ================= Sandbox wrapper ================= */
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'";

/** App ka design kit: pack ke andar bhi bilkul app jaisa look (variables app ke live theme se aate hain). */
const KIT = `:root{--c1:#ff7a1a;--c2:#ff2e7e;--c3:#8b5cf6;--bg:#07060d;--bg2:#0e0b1a;--bg3:#171228;--paper:#f5f2ff;--fd:"Rajdhani","Sora",system-ui,sans-serif;--fs:"Sora",system-ui,-apple-system,Roboto,sans-serif}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--paper);font-family:var(--fs);-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;overscroll-behavior:none;user-select:none;-webkit-user-select:none}
*{box-sizing:border-box}button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
.glass{background:color-mix(in srgb,var(--bg3) 82%,transparent);border:1px solid color-mix(in srgb,var(--paper) 10%,transparent)}
.card{background:color-mix(in srgb,var(--bg3) 88%,transparent);border:1px solid color-mix(in srgb,var(--paper) 8%,transparent);border-radius:20px;box-shadow:0 10px 30px -14px rgba(0,0,0,.7)}
.grad{background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 55%,var(--c3) 100%)}
.grad-text{background:linear-gradient(100deg,var(--c1),var(--c2) 50%,var(--c3));-webkit-background-clip:text;background-clip:text;color:transparent}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;padding:0 1.4rem;border-radius:999px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--c1),var(--c2) 55%,var(--c3));box-shadow:0 10px 26px -10px var(--c2);transition:scale .14s ease-out}
.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:0 1.2rem;border-radius:999px;font-weight:600;background:color-mix(in srgb,var(--bg3) 82%,transparent);border:1px solid color-mix(in srgb,var(--paper) 12%,transparent)}
.chip{display:inline-flex;align-items:center;height:34px;padding:0 .9rem;border-radius:999px;font-size:.8rem;font-weight:600;background:color-mix(in srgb,var(--paper) 8%,transparent)}
.tap{transition:scale .14s ease-out,opacity .16s}.tap:active{scale:.94}
.h1{font-family:var(--fd);font-weight:700;font-size:2.1rem;line-height:1.05;letter-spacing:.04em}
.h2{font-family:var(--fd);font-weight:700;font-size:1.25rem;letter-spacing:.12em;text-transform:uppercase}
.muted{color:color-mix(in srgb,var(--paper) 55%,transparent)}
.rise{animation:pk-rise .52s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--d,0) * 1ms)}
.pop-in{animation:pk-pop .38s cubic-bezier(.2,1.2,.3,1) both}
.blob{position:absolute;border-radius:999px;filter:blur(48px);opacity:.35;pointer-events:none}
.safe{padding:max(1rem,env(safe-area-inset-top)) 1rem max(1rem,env(safe-area-inset-bottom))}
@keyframes pk-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pk-pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}`;

const BRIDGE = `<script>(function(){var S={},U={},E=0;
function send(m){m.pry=1;try{parent.postMessage(m,"*")}catch(e){}}
window.PRY={user:U,get:function(k,d){return k in S?S[k]:d},set:function(k,v){S[k]=v;send({type:"set",key:String(k),value:v})},close:function(){send({type:"close"})},toast:function(t){send({type:"toast",text:String(t)})},vibrate:function(p){send({type:"vibrate",pattern:p})}};
function err(m){if(E++<5)send({type:"error",text:String(m).slice(0,240)})}
window.addEventListener("error",function(e){err((e.message||"error")+(e.lineno?" (line "+e.lineno+")":""))});
window.addEventListener("unhandledrejection",function(e){err("Promise: "+(e.reason&&e.reason.message||e.reason))});
window.addEventListener("message",function(e){var d=e.data;if(d&&d.pry&&d.type==="init"){S=d.store||{};U=d.user||{};window.PRY.user=U;
var r=document.documentElement;if(d.theme)for(var k in d.theme)r.style.setProperty(k,d.theme[k]);
if(d.fonts){var st=document.createElement("style");st.textContent=d.fonts;document.head.appendChild(st)}
window.dispatchEvent(new Event("pry-ready"))}});
send({type:"ready"})})();<\/script>`;

export function packSrcDoc(html: string): string {
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style id="pk-kit">${KIT}</style>${BRIDGE}`;
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], `${m[0]}${head}`);
  if (/<html/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => `${h}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

/** App ke live theme ke colours (user ne jo theme lagayi hai wahi pack mein dikhe). */
export function themeVars(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const k of ["--c1", "--c2", "--c3", "--bg", "--bg2", "--bg3"]) { const v = cs.getPropertyValue(k).trim(); if (v) out[k] = v; }
  return out;
}

let fontCache: Promise<string> | null = null;
/** App ke Sora + Rajdhani fonts (latin) ko data-URI bana kar pack ko dete hain, kyunki sandbox app ke fonts nahi dekh sakta. */
export function getFontCss(): Promise<string> {
  if (!fontCache) {
    fontCache = (async () => {
      try {
        const out: string[] = [];
        let total = 0;
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList;
          try { rules = sheet.cssRules; } catch { continue; }
          for (const r of Array.from(rules)) {
            if (!(r instanceof CSSFontFaceRule)) continue;
            const fam = r.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
            if (fam !== "Sora" && fam !== "Rajdhani") continue;
            const range = r.style.getPropertyValue("unicode-range");
            if (range && !/U\+0000-00FF/i.test(range)) continue;
            const m = r.style.getPropertyValue("src").match(/url\(["']?([^"')]+?\.woff2[^"')]*)["']?\)/i);
            if (!m) continue;
            const buf = new Uint8Array(await (await fetch(m[1])).arrayBuffer());
            total += buf.length;
            if (total > 420_000) break;
            let bin = "";
            for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
            out.push(`@font-face{font-family:"${fam}";font-weight:${r.style.getPropertyValue("font-weight") || "400"};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2")}`);
          }
        }
        return out.join("");
      } catch { return ""; }
    })();
  }
  return fontCache;
}

/** Pack ko chhupe sandbox mein ~3.5 sec chala kar JS errors pakadta hai (AI ka code save karne se pehle jaanch). */
export function testPack(html: string): Promise<string[]> {
  return new Promise((resolve) => {
    const errs: string[] = [];
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.setAttribute("allow", "autoplay");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:390px;height:780px;opacity:0;pointer-events:none";
    const done = () => { window.removeEventListener("message", on); f.remove(); resolve(errs); };
    const on = (e: MessageEvent) => {
      if (e.source !== f.contentWindow) return;
      const d = e.data as { pry?: number; type?: string; text?: string } | null;
      if (!d || d.pry !== 1) return;
      if (d.type === "error" && d.text) errs.push(d.text);
      else if (d.type === "ready") {
        f.contentWindow?.postMessage({ pry: 1, type: "init", store: {}, user: { uid: "test", name: "Test", username: "test", avatar: "", publicId: 0 }, theme: themeVars() }, "*");
      }
    };
    window.addEventListener("message", on);
    f.srcdoc = packSrcDoc(html);
    document.body.appendChild(f);
    window.setTimeout(done, 3500);
  });
}
