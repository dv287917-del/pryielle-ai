import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const AI_UID = "ai_pryielle";
const AI_NAME = "Pryielle AI";
const FALLBACK_MODEL = "gemini-flash-latest";
const MODES = {
 funny:"Style: mazaakiya, chatpata, dost jaisa. Tone funny aur desi, thode emoji. Halka mazaak theek hai, kisi ko hurt karne wala roast nahi.",
 friendly:"Style: bahut pyaara, caring aur supportive dost. Garam lehja, motivating baatein, thode emoji.",
 serious:"Style: professional aur seedha. Mazaak ya emoji bilkul nahi, sirf kaam ki, saaf aur sahi baat.",
 teacher:"Style: patient teacher. Cheezein aasaan bhasha mein, chhote steps aur example ke saath samjhao.",
 coder:"Style: senior developer. Code maange to chhota, sahi, chalne wala code do aur 1-2 line mein samjhao.",
 gamer:"Style: gaming squad ka hype dost. Gaming slang, tips aur hausla badhane wali baatein, thode emoji."
};
const LANGS = {auto:"User jis bhasha mein likhe usi mein jawab do.",hinglish:"Hamesha Hinglish mein jawab do.",hindi:"Hamesha Hindi (Devanagari) mein jawab do.",english:"Hamesha simple English mein jawab do."};
const LENGTHS = {short:"Default jawab 2-3 chhoti lines ka ho.",normal:"Default jawab 4-6 lines ka ho.",long:"Detail mein jawab do."};
const SAFETY = "Gaali ya bullying ka jawab insult se mat do. Hacking, doxxing ya nuksaan pahunchane mein madad mat karo. Self-harm ki baat par serious aur supportive raho. Sach na pata ho to jhooth mat banao.";
const LONG_RE = /(explain|detail|samjh|step|poora|puri|pura|summar|code|bana\s*k|likh\s*k|essay|translate|article|story|kahani|list|compare|difference|tutorial|batao\s+kaise)/i;
function adminDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("Vercel Environment Variable FIREBASE_SERVICE_ACCOUNT_JSON missing");
    const svc = JSON.parse(raw);
    initializeApp({ credential: cert(svc), projectId: svc.project_id });
  }
  return getFirestore();
}
async function authUser(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) throw Object.assign(new Error("Dobara login karo."), { status: 401 });
  return getAuth().verifyIdToken(h.slice(7));
}
async function cfg(db) {
  const s = await db.doc("aiAdmin/main").get().catch(()=>null);
  const d = s?.exists ? s.data() : {};
  return { model: typeof d.model==="string"&&d.model.trim()?d.model.trim():"gemini-flash-latest",
    on:d.on!==false, dailyLimit:Number.isFinite(d.dailyLimit)?Math.max(1,Math.min(5000,d.dailyLimit)):150,
    mode:MODES[d.mode]?d.mode:"funny",lang:LANGS[d.lang]?d.lang:"auto",length:LENGTHS[d.length]?d.length:"short",
    temperature:Number.isFinite(Number(d.temperature))?Math.max(0,Math.min(1.5,Number(d.temperature))):0.9,
    instructions:typeof d.instructions==="string"?d.instructions.slice(0,2500):"" };
}
const OWNER_EMAIL="workwithpryielle@gmail.com";
function isOwner(user,u){return (user.email_verified===true&&String(user.email||"").toLowerCase()===OWNER_EMAIL)||u?.role==="owner";}
const OWNER_NOTE="Ye user is app ka OWNER/DEVELOPER hai. Inse hamesha izzat aur pyaar se baat karo, kabhi gaali, insult ya mazaak mat udao, aur inki sahi baat ko dhyan se maano. Lekin safety rules hamesha lagu rahenge: hacking, hathiyar, doxxing ya nuksaan wali madad kisi ke liye bhi nahi.";
const PUBLIC_NOTE="Is user se kabhi gaali, insult ya gandi bhasha mein baat mat karo, chahe wo kitna bhi faltu bole. Agar wo bahut faltu kare to shant aur seedhe lehje mein ek line mein rok do.";
function system(c, extra) { return ["Tum Pryielle MSG ke Pryielle AI ho.",MODES[c.mode],LANGS[c.lang],LENGTHS[c.length],"Lamba jawab tab do jab user detail, step-by-step, code ya explanation maange.",c.instructions?`Owner instructions:\n${c.instructions}`:"",SAFETY,extra||""].filter(Boolean).join("\n"); }
async function quota(db, uid, c) {
 const ref=db.doc(`aiUsage/${uid}`), now=Date.now(), day=new Date(now+19800000).toISOString().slice(0,10);
 await db.runTransaction(async tx=>{const s=await tx.get(ref), d=s.exists?s.data():{}, count=d.day===day?Number(d.count)||0:0;
 if(now-(Number(d.lastAt)||0)<2500) throw Object.assign(new Error("Thoda ruko, AI abhi pichla jawab de raha hai."),{status:429});
 if(count>=c.dailyLimit) throw Object.assign(new Error("Aaj ka AI quota khatam ho gaya. Kal phir try karo."),{status:429});
 tx.set(ref,{day,count:count+1,lastAt:now});});
}
async function gemini(c, contents, maxTokens, extra, opts = {}) {
 const key=process.env.GEMINI_API_KEY;
 if(!key) throw new Error("Vercel Environment Variable GEMINI_API_KEY missing");
 let model=c.model;
 for(let n=0;n<3;n++){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:opts.system||system(c,extra)}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:opts.temperature??c.temperature,...(opts.json?{responseMimeType:"application/json"}:{})}}),signal:AbortSignal.timeout(opts.timeout||100000)});
  if(r.ok){const j=await r.json();const cand=j.candidates?.[0]||{};const t=(cand.content?.parts||[]).filter(p=>typeof p.text==="string"&&!p.thought).map(p=>p.text).join("").trim();return t||"Hmm, kuch samajh nahi aaya. Ek baar phir bolo? 😅";}
  const body=await r.text().catch(()=> "");
  if(r.status===404&&model!==FALLBACK_MODEL){model=FALLBACK_MODEL;continue;}
  if((r.status===500||r.status===503)&&n<2)continue;
  if(r.status===401||r.status===403)throw new Error("Gemini API key galat hai ya permission nahi hai.");
  if(r.status===429)throw new Error("Gemini quota/limit abhi khatam hai.");
  throw new Error(`Gemini error (${r.status}): ${body.slice(0,160)}`);
 }
 throw new Error("AI abhi jawab nahi de pa raha.");
}
function partsFor(text, attachments=[], max=4) {
 const parts=[];let bytes=0;
 for(const a of (Array.isArray(attachments)?attachments:[]).slice(0,max)){
  if(!a||typeof a!=="object")continue;
  if(a.kind==="image"&&["image/jpeg","image/png","image/webp","image/gif"].includes(a.mime)&&typeof a.data==="string"){bytes+=a.data.length;parts.push({inlineData:{mimeType:a.mime,data:a.data}});}
  else if(a.kind==="pdf"&&typeof a.data==="string"){bytes+=a.data.length;parts.push({inlineData:{mimeType:"application/pdf",data:a.data}});}
  else if(a.kind==="text"&&typeof a.text==="string"){bytes+=a.text.length;parts.push({text:`[File: ${String(a.name||"file").slice(0,80)}]\n${a.text.slice(0,60000)}`});}
 }
 if(bytes>9000000)throw Object.assign(new Error("Files 9MB se chhoti rakho."),{status:400});
 parts.push({text:text||"(is file/photo ko dekho aur batao)"});return parts;
}

const DESIGN_BRIEF = `APP DESIGN SYSTEM ("IronRoses MSG") — har feature isi app jaisa dikhna chahiye, generic nahi:
- Premium dark-glass UI. Page bg var(--bg) with soft blurred glow orbs (class .blob) of var(--c1)/var(--c2)/var(--c3). Text var(--paper); muted = .muted.
- Fonts (pack ke andar already loaded): headings/HUD labels = var(--fd) "Rajdhani" bold, letter-spacing .08-.3em, often UPPERCASE; body = var(--fs) "Sora".
- CSS variables ready: --c1 --c2 --c3 (user ki theme ke accent colours; hard-code mat karo, sirf horror/special scenes mein allowed), --bg --bg2 --bg3, --paper, --fd, --fs.
- Ready classes: .glass .card .grad .grad-text .btn (primary pill) .btn-ghost .chip .tap (press scale) .rise (entrance; style="--d:120") .pop-in .blob .h1 .h2 .muted .safe (safe-area padding). Inhe use karo aur apni CSS bhi likho.
- Shapes: radius 16-24px cards, 999px pills, 1px border paper@10%, shadow 0 10px 30px -12px var(--c2). Tap targets >=44px.
- Motion: transform/opacity, 300-600ms, cubic-bezier(.2,.8,.2,1), staggered .rise entrances, press scale .94, subtle idle animations (float/glow). Smooth, never janky.
- Secret screen (slot=secret): pure black, blood red #ff2a4d/#d4122f, dread, heartbeat, chains imagery.
- Polish matters: spacing rhythm, hierarchy, empty/loading/error/success states, micro-interactions, haptics via PRY.vibrate([ms,gap,ms]).`;

const PRY_API = `window.PRY (pack ke andar available): PRY.user {uid,name,username,avatar,publicId} ("pry-ready" event ke baad bharosemand), PRY.get(key,default), PRY.set(key,value) (sirf is user ke phone par persist), PRY.toast(text), PRY.vibrate(pattern ms array, jaise [60,40,120]), PRY.close().
Pack ek sandbox mein chalta hai: internet nahi, external URL/CDN/font/fetch nahi, dusre users ka data/Firebase/chats nahi. Audio sirf WebAudio se synthesize karo (oscillator/noise) — AudioContext banao aur .resume() karo (iframe autoplay allowed hai). Image sirf inline SVG/canvas/CSS. localStorage mat use karo (PRY.set/get use karo).`;

const SPEC_SYSTEM = `Tum "IronRoses MSG" app ke owner/admin ke senior product-designer + engineer ho. Owner Hinglish mein bolta hai. Tumhara kaam: owner ki maang ko BILKUL EXACT samajhna.
Sirf ek JSON object return karo (koi markdown nahi):
{"kind":"feature|chat|image|file","reply":"Hinglish, chhota","imagePrompt":"","files":[{"name":"","mime":"","content":""}],"spec":null|{"title":"max 40","icon":"1 emoji","slot":"home|secret","summary":"1 line","requirements":["har ek cheez jo owner ne maangi, alag-alag, verifiable"],"screens":"screens/states ka detail","behavior":"interactions, timing, logic, edge cases","visual":"exact look: layout, colours, typography, animations — upar ke design system ke hisaab se","audio":"sound/haptics plan ya none"}}

DECISION RULES
- Jo cheez app ke andar DEKHI/KHELI/SUNI jaaye (video, animation, jump scare, game, tool, screen, effect, quiz, widget) => kind="feature". Use text mein describe karke KABHI nahi taalna; asli kaam karne wala feature banana hai. "video bana de" ka matlab: real-time animated scene (canvas/CSS + synthesized sound) jo app mein play ho; .mp4 file generate nahi hoti — reply mein 1 line mein ye bata do.
- "secret mein daal / secret mein lagao" => slot="secret" (Secret screen ka PIN + START + 5 sec countdown ke BAAD ye pack full-screen auto-play hota hai). Baaki sab => slot="home".
- Sirf sawal/baatcheet => kind="chat". Image maange => kind="image" + detailed English imagePrompt. File (txt/json/csv/md/code) maange => kind="file" + files.
- requirements mein owner ka har shabd cover ho. Apni taraf se extra zaroori cheezein add karo (polish, states) par owner ki maang kabhi mat badlo/ghatao. Agar current pack diya hai to requirements mein "purana kaam bana rahe" bhi likho.
- Ambiguity ho to sabse samajhdaar assumption lo aur reply mein 1 line mein batao; sawal tabhi pucho jab bilkul aage badhna mumkin na ho.
- Attached photos/video-frames (time-order, awaaz nahi)/PDF/text ko dhyan se dekho; "aisa hi" bole to us UI/idea ko faithfully follow karo.
- Hacking, malware, phishing, doxxing, doosron ko nuksaan wali cheezein nahi.
${DESIGN_BRIEF}
${PRY_API}`;

const CODE_SYSTEM = `Tum world-class front-end engineer + motion designer ho. Tumhe ek SPEC milta hai; usse ek single self-contained HTML document likhna hai jo app ke andar sandbox mein chalega.
OUTPUT: sirf poora HTML document (<!doctype html> se </html> tak). Koi explanation, markdown ya backtick nahi.
QUALITY BAR (isse kam nahi):
- SPEC.requirements ki HAR line poori tarah implement ho — koi placeholder, TODO, "coming soon", ya sirf-text-description nahi. Jo maanga gaya wahi banta hai, asli kaam karta hua.
- Design system ka sahi use (neeche), mobile-first 360-420px, app jaisa premium look: hierarchy, spacing, glow, glass, smooth animations, saare states (loading/empty/success/error).
- Code bug-free: har JS try/catch ya null-safe, koi undefined variable nahi, event handlers sahi jude, timers/AudioContext/animationFrame proper clean up. Runtime error = fail. Pehle dimaag mein poora code chala kar dekho.
- Logic detailed aur lamba ho sakta hai — mehnat lagao, shortcut nahi. Size ~15-120 KB theek hai; max 250 KB.
- Close/back control zaroor (PRY.close()), secret slot mein end par "Band karo" button.
- Current pack diya ho aur owner badlav maange to POORA updated document do, purana kaam karta hua hissa mat todo.
- SLOT=secret ho to: poora screen pure black se shuru, koi start button nahi (auto-play, kyunki user START + countdown pehle hi kar chuka hai). Dread build-up (1.5-3 sec lagbhag khamoshi + heartbeat/low drone, halka flicker) -> phir ek achanak, ZORDAAR jump scare: aankhen chamakta daravna chehra/figure (canvas ya SVG se khud draw karo, procedural, gore nahi, real insaan nahi), tez zoom, screen shake, 2-3 sharp flashes (strobe 3/sec se zyada nahi), glitch/RGB-split, aur synthesized scream (noise burst + descending sawtooth/FM screech + sub-boom, gain automation), PRY.vibrate([...]). Phir aftermath (dheere fade, whisper-drone, red text) aur end mein "Band karo" button. Total 12-25 sec. Sound/visual dono properly timed.
${DESIGN_BRIEF}
${PRY_API}`;

const REVIEW_SYSTEM = `Tum strict QA + code reviewer ho. Tumhe SPEC, ek HTML pack, aur (kabhi) runtime ERRORS milte hain. Kaam: HTML ko line-by-line "chala kar" check karo:
1) SPEC.requirements ki har line implement hai? Jo adhoora/missing/sirf-text hai wo poora karo.
2) Syntax/runtime bugs, undefined variables, galat selectors, broken handlers, AudioContext/timers ki galtiyan, mobile layout overflow, tap targets.
3) Design system match: .glass/.card/.btn classes aur var(--c1..) ka use, fonts, spacing, animations — generic/ugly dikhe to behtar banao.
4) Reported ERRORS ko zaroor theek karo.
Output FORMAT (sirf ye):
- Agar sab theek hai: pehli line exactly "OK".
- Warna: pehli line "ISSUES: <ek line mein kya theek kiya>" aur uske baad poora FIXED HTML document (<!doctype html> se </html>). Koi markdown/backtick nahi. Pura document do, patch nahi.
${DESIGN_BRIEF}
${PRY_API}`;

function jparse(raw){
 let t=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
 try{return JSON.parse(t);}catch{}
 const a=t.indexOf("{"),b=t.lastIndexOf("}");
 if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1));}catch{}}
 return null;
}
function cleanHtml(raw){
 let t=String(raw||"").trim().replace(/^```(?:html)?\s*/i,"").replace(/```\s*$/,"").trim();
 const i=t.search(/<!doctype html|<html/i);
 if(i<0)return "";
 t=t.slice(i);
 const e=t.toLowerCase().lastIndexOf("</html>");
 if(e>=0)t=t.slice(0,e+7);
 return t.slice(0,300000);
}
function parseSpec(raw){
 const j=jparse(raw);
 if(!j||typeof j!=="object")return{kind:"chat",reply:String(raw||"").slice(0,1500)||"Samajh nahi aaya, ek baar phir batao?",imagePrompt:"",files:[],spec:null};
 const kind=["feature","chat","image","file"].includes(j.kind)?j.kind:"chat";
 const files=(Array.isArray(j.files)?j.files:[]).filter(f=>f&&typeof f.content==="string"&&typeof f.name==="string").slice(0,5).map(f=>({name:f.name.replace(/[^\w.\- ]/g,"_").slice(0,80)||"file.txt",mime:String(f.mime||"text/plain").slice(0,60),content:f.content.slice(0,400000)}));
 let spec=null;
 if(kind==="feature"&&j.spec&&typeof j.spec==="object"){
  const sp=j.spec,str=(v,n)=>String(v||"").slice(0,n);
  spec={title:str(sp.title||"New feature",40),icon:str(sp.icon||"✨",4),slot:sp.slot==="secret"?"secret":"home",summary:str(sp.summary,300),
   requirements:(Array.isArray(sp.requirements)?sp.requirements:[]).map(x=>str(x,400)).filter(Boolean).slice(0,40),
   screens:str(sp.screens,4000),behavior:str(sp.behavior,4000),visual:str(sp.visual,3000),audio:str(sp.audio,1500)};
 }
 return{kind:spec||kind!=="feature"?kind:"chat",reply:String(j.reply||"").slice(0,2000),imagePrompt:typeof j.imagePrompt==="string"?j.imagePrompt.slice(0,1500):"",files,spec};
}
async function geminiImage(prompt, ref, model) {
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw new Error("Vercel Environment Variable GEMINI_API_KEY missing");
 const parts=[];
 if(ref&&ref.kind==="image"&&typeof ref.data==="string"&&["image/jpeg","image/png","image/webp"].includes(ref.mime))parts.push({inlineData:{mimeType:ref.mime,data:ref.data}});
 parts.push({text:String(prompt).slice(0,1500)});
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{responseModalities:["TEXT","IMAGE"]}}),signal:AbortSignal.timeout(55000)});
 if(!r.ok){const b=await r.text().catch(()=>"");
  if(r.status===404)throw new Error(`Image model "${model}" nahi mila. Admin → AI mein ya aiAdmin/main doc mein imageModel badlo.`);
  if(r.status===429)throw new Error("Image quota abhi khatam hai (Gemini free tier mein image limit chhoti hoti hai).");
  throw new Error(`Image error (${r.status}): ${b.slice(0,140)}`);}
 const j=await r.json();const ps=j.candidates?.[0]?.content?.parts||[];
 const img=ps.find(p=>p.inlineData?.data);const text=ps.filter(p=>typeof p.text==="string").map(p=>p.text).join("").trim();
 if(!img)throw new Error(text?`Image nahi bani: ${text.slice(0,160)}`:"Image model ne image nahi di. Prompt thoda badal ke try karo.");
 return{image:img.inlineData.data,mime:img.inlineData.mimeType||"image/png",text};
}
function cors(res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","content-type, authorization");
 res.setHeader("Access-Control-Max-Age","86400");
}
export default async function handler(req,res) {
 cors(res);
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Method not allowed"});}
 try {
  const db=adminDb(), user=await authUser(req);
  const uSnap=await db.doc(`users/${user.uid}`).get(), u=uSnap.data();
  if(!u||u.banned||(u.approval??"approved")!=="approved")return res.status(403).json({error:"Tumhara account approved nahi hai."});
  const c=await cfg(db); if(!c.on)return res.status(503).json({error:"AI abhi band hai (admin ne off kiya hai)."});
  const body=req.body||{}, action=body.action||"ask";
  if(action==="test"){
   if(!process.env.GEMINI_API_KEY)return res.status(500).json({error:"Vercel Environment Variable GEMINI_API_KEY missing."});
   try{await gemini(c,[{role:"user",parts:[{text:"Say OK"}]}],50,"Test request.");return res.status(200).json({ok:true});}
   catch(e){return res.status(500).json({error:e.message||"Gemini test failed."});}
  }
  if(action==="build"||action==="image"){
   if(!isOwner(user,u))return res.status(403).json({error:"Ye feature sirf admin ke liye hai."});
   if(action==="build"){
    const ds=await db.doc("aiAdmin/main").get().catch(()=>null);
    const dd=ds?.exists?ds.data():{};
    const bc={...c,model:typeof dd.builderModel==="string"&&dd.builderModel.trim()?dd.builderModel.trim():"gemini-pro-latest"};
    const stage=String(body.stage||"spec");
    const raw=Array.isArray(body.messages)?body.messages:[];
    const turns=raw.filter(t=>t&&(t.role==="user"||t.role==="assistant")&&typeof t.text==="string"&&t.text.trim()).slice(-14).map(t=>({role:t.role,text:t.text.slice(0,4000)}));
    while(turns.length&&turns[0].role!=="user")turns.shift();
    const merged=[];for(const t of turns){const l=merged.at(-1);if(l&&l.role===t.role)l.text+=`\n${t.text}`;else merged.push({...t});}
    const cur=body.current&&typeof body.current.html==="string"?body.current:null;
    const convo=(extra)=>merged.map((t,i)=>{
     if(i!==merged.length-1)return{role:t.role==="assistant"?"model":"user",parts:[{text:t.text}]};
     const ps=partsFor(t.text,body.attachments||[],10);
     if(cur)ps.unshift({text:`CURRENT PACK (owner isi ko badalna chahta hai) title="${String(cur.title||"").slice(0,60)}":\n${cur.html.slice(0,120000)}`});
     if(extra)ps.push({text:extra});
     return{role:"user",parts:ps};
    });
    try{
     if(stage==="spec"){
      if(!merged.length||merged.at(-1).role!=="user")return res.status(400).json({error:"Kuch likho to sahi."});
      const out=await gemini(bc,convo(""),12000,"",{system:SPEC_SYSTEM,json:true,temperature:0.4,timeout:120000});
      return res.status(200).json(parseSpec(out));
     }
     if(stage==="code"){
      if(!merged.length||merged.at(-1).role!=="user")return res.status(400).json({error:"Kuch likho to sahi."});
      const spec=body.spec&&typeof body.spec==="object"?body.spec:null;
      if(!spec)return res.status(400).json({error:"Spec missing."});
      const out=await gemini(bc,convo(`SPEC (isi ko poora implement karo):\n${JSON.stringify(spec).slice(0,16000)}\nSLOT=${spec.slot==="secret"?"secret":"home"}`),48000,"",{system:CODE_SYSTEM,temperature:0.75,timeout:270000});
      const html=cleanHtml(out);
      if(!html)return res.status(502).json({error:"AI ne poora feature nahi diya. Ek baar phir try karo."});
      return res.status(200).json({html});
     }
     if(stage==="review"){
      const spec=body.spec&&typeof body.spec==="object"?body.spec:null;
      const html=typeof body.html==="string"?body.html.slice(0,300000):"";
      if(!spec||!html)return res.status(400).json({error:"Review ke liye spec/html chahiye."});
      const errors=(Array.isArray(body.errors)?body.errors:[]).map(e=>String(e).slice(0,240)).slice(0,6);
      const ps=partsFor(`SPEC:\n${JSON.stringify(spec).slice(0,16000)}\n\nRUNTIME ERRORS: ${errors.length?errors.join(" | "):"none reported"}\n\nHTML:\n${html}`,body.attachments||[],6);
      const out=await gemini(bc,[{role:"user",parts:ps}],48000,"",{system:REVIEW_SYSTEM,temperature:0.2,timeout:270000});
      const t=String(out||"").trim();
      if(/^OK\b/i.test(t)&&!errors.length)return res.status(200).json({html,issues:"",changed:false});
      const fixed=cleanHtml(t);
      if(!fixed)return res.status(200).json({html,issues:"",changed:false});
      const m=t.match(/^ISSUES:\s*(.+)$/im);
      return res.status(200).json({html:fixed,issues:m?m[1].slice(0,300):"",changed:true});
     }
     return res.status(400).json({error:"Unknown stage."});
    }catch(e){return res.status(e.status||500).json({error:e.message||"Builder abhi jawab nahi de pa raha."});}
   }
   const prompt=String(body.prompt||"").trim();
   if(!prompt)return res.status(400).json({error:"Image ka prompt khaali hai."});
   const ds=await db.doc("aiAdmin/main").get().catch(()=>null);
   const imgModel=ds?.exists&&typeof ds.data().imageModel==="string"&&ds.data().imageModel.trim()?ds.data().imageModel.trim():"gemini-2.5-flash-image";
   try{return res.status(200).json(await geminiImage(prompt,body.ref,imgModel));}
   catch(e){return res.status(500).json({error:e.message||"Image nahi ban payi."});}
  }
  if(action==="ask"){
   const raw=Array.isArray(body.messages)?body.messages:[];
   const turns=raw.filter(t=>t&&(t.role==="user"||t.role==="assistant")&&typeof t.text==="string"&&t.text.trim()).slice(-20).map(t=>({role:t.role,text:t.text.slice(0,6000)}));
   while(turns.length&&turns[0].role!=="user")turns.shift();
   if(!turns.length||turns.at(-1).role!=="user")return res.status(400).json({error:"Kuch likho to sahi."});
   await quota(db,user.uid,c);
   const merged=[];for(const t of turns){const last=merged.at(-1);if(last&&last.role===t.role)last.text+=`\n${t.text}`;else merged.push({...t});}
   const last=merged.at(-1), atts=body.attachments||[];
   const contents=merged.map((t,i)=>({role:t.role==="assistant"?"model":"user",parts:i===merged.length-1?partsFor(t.text,atts):[{text:t.text}]}));
   const text=await gemini(c,contents,atts.length?6000:LONG_RE.test(last.text)?4000:1800,`Private chat with ${String(u.displayName||"dost").slice(0,30)}. ${isOwner(user,u)?OWNER_NOTE:PUBLIC_NOTE}`);
   return res.status(200).json({text});
  }
  if(action==="group"){
   const chatId=String(body.chatId||""), msgId=String(body.msgId||"");
   if(!/^[\w-]{1,160}$/.test(chatId)||!/^[\w-]{1,160}$/.test(msgId))return res.status(400).json({error:"Invalid chat/message."});
   const chatRef=db.doc(`chats/${chatId}`), chatSnap=await chatRef.get(), chat=chatSnap.data();
   if(!chat||!Array.isArray(chat.members)||!chat.members.includes(user.uid))return res.status(403).json({error:"Chat access nahi hai."});
   const msgRef=chatRef.collection("messages").doc(msgId), ms=await msgRef.get(), m=ms.data();
   if(!m||m.senderId!==user.uid||m.system||m.ai||m.deleted)return res.status(400).json({error:"Message invalid hai."});
   if(m.aiReplied)return res.status(200).json({ok:true,skipped:"already-answered"});
   await msgRef.update({aiReplied:true});
   const match=String(m.text||"").match(/^\s*\/ai(?:\s+([\s\S]*))?$/i);if(!match)return res.status(400).json({error:"Message /ai se start hona chahiye."});
   const prompt=(match[1]||"").trim();
   const reply=async text=>{const now=Date.now(), ref=chatRef.collection("messages").doc(), batch=db.batch();
    batch.set(ref,{senderId:AI_UID,senderName:AI_NAME,text:String(text).slice(0,1900),image:null,audio:null,audioMs:0,gif:null,replyTo:{id:msgId,text:(prompt||"/ai").slice(0,80),name:String(m.senderName||"Player").slice(0,40)},reactions:{},deleted:false,system:false,createdAt:now,mediaId:null,mediaKind:null,thumb:null,edited:false,ai:true});
    const patch={lastMessage:{text:`🤖 ${String(text).replace(/\s+/g," ").slice(0,110)}`,senderId:AI_UID,senderName:AI_NAME,at:now,type:"text"},lastAt:now,[`typing.${AI_UID}`]:0};
    for(const uid of chat.members)patch[`unread.${uid}`]=FieldValue.increment(1);batch.update(chatRef,patch);await batch.commit();};
   if(!prompt)return reply("Bol na bhai! Aise likho: /ai kuch bhi pooch 😎").then(()=>res.status(200).json({ok:true}));
   await quota(db,user.uid,c);
   const hist=await chatRef.collection("messages").orderBy("createdAt","desc").limit(14).get();
   const lines=hist.docs.map(d=>d.data()).reverse().filter(x=>x&&!x.system&&!x.deleted&&String(x.text||"").trim()&&!(x.senderId===user.uid&&x.text===m.text)).map(x=>`${x.ai?AI_NAME:String(x.senderName||"Player").slice(0,30)}: ${String(x.text).slice(0,300)}`);
   const who=String(m.senderName||u.displayName||"Player").slice(0,30), promptText=`Squad chat ki pichli baatein:\n${lines.join("\n")||"(koi nahi)"}\n\nAb ${who} ne kaha:\n${prompt.slice(0,2000)}`;
   try{const text=await gemini(c,[{role:"user",parts:[{text:promptText}]}],LONG_RE.test(prompt)?3000:1500,`Group chat hai, jawab ${who} ko do. Jawab chhota rakho jab tak wo lamba na maange. ${isOwner(user,u)?OWNER_NOTE:PUBLIC_NOTE}`);await reply(text);}
   catch(e){await reply(e.message||"AI abhi jawab nahi de pa raha.");}
   return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:"Unknown action."});
 } catch(e){return res.status(e.status||500).json({error:e.message||"AI abhi jawab nahi de pa raha."});}
}
