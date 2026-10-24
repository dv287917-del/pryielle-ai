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
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:opts.system||system(c,extra)}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:opts.temperature??c.temperature,...(opts.json?{responseMimeType:"application/json"}:{})}}),signal:AbortSignal.timeout(100000)});
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

const BUILDER_SYSTEM = `Tum "IronRoses MSG" app ke admin (owner) ke personal AI Builder ho. Owner Hinglish mein baat karta hai; "reply" hamesha chhota, saaf Hinglish mein likho.
Tum SIRF ek JSON object return karte ho (koi markdown/backtick nahi) is shape mein:
{"reply":"string","pack":null|{"title":"max 40 chars","icon":"1 emoji","summary":"1 line","html":"poora HTML document"},"files":[{"name":"x.txt","mime":"text/plain","content":"..."}],"imagePrompt":""}

RULES
1) FEATURE banana ho (naya screen/tool/game/calculator/form/UI jo app mein add ho) -> "pack" bharo. Sirf sawal/baatcheet ho -> pack null.
2) pack.html = ek single self-contained document. Sab CSS/JS inline. KOI external URL, CDN, Google Font, fetch/XHR/WebSocket/import nahi (sandbox CSP sab block karta hai). Images ke liye inline SVG/CSS/emoji use karo; bade base64 mat daalo.
3) Mobile-first (360-420px width), safe-area padding, bade tap targets (min 44px), smooth animation (transform/opacity), dark-blue glass look (bg #0b1630, cards rgba(255,255,255,.08), blur, rounded 18px, accent #5b9bff / #ff2e63). Text Hinglish/English jaisa owner maange.
4) Code bina error ke chalna chahiye: har cheez try/catch mein, null checks, koi undefined variable nahi, koi placeholder/TODO nahi. Poora kaam karne wala logic likho. alert/confirm/prompt use mat karo — apna UI banao.
5) App se judne ke liye window.PRY hai: PRY.user {uid,name,username,avatar,publicId}, PRY.get(key,default), PRY.set(key,value) (sirf is user ke phone par save, JSON-safe), PRY.toast(text), PRY.close(). PRY.user/get tabhi bharose se padho jab window "pry-ready" event aa jaye (ya turant check karo: if PRY.user.uid). Ek "close/back" button zaroor do jo PRY.close() chalaye.
6) Feature sirf is device par chalta hai. Wo doosre users ka data, chats, Firebase ya server nahi chhu sakta. Agar owner aisa kuch maange jo iske bina possible nahi (jaise sabke beech live leaderboard, real chat feature, native Android cheez), to saaf bolo reply mein, aur jitna local ho sake wo version banao ya pack null rakho aur batao ki iske liye app ka code update karna padega.
7) Agar "current pack" diya gaya hai aur owner badlav maange -> POORA updated html wapas do (patch nahi), purana kaam karta hua hissa mat todo.
8) Owner image maange (photo/logo/poster/art banao) -> "imagePrompt" mein detailed English prompt do, pack null. File maange (txt/json/csv/md/code/html) -> "files" mein poora content do.
9) Attached photo/video-frames/PDF/text ko dhyan se dekho. Video ke frames time-order mein hote hain (awaaz nahi). "Aisa hi UI/feature" bole to us UI ko sahi se copy karo.
10) Hacking, malware, doxxing, doosron ko nuksaan, phishing/fake login wala koi bhi cheez nahi banani.`;

function parseBuild(raw){
 let t=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
 let j=null;
 try{j=JSON.parse(t);}catch{const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{j=JSON.parse(t.slice(a,b+1));}catch{}}}
 if(!j||typeof j!=="object"){
  const m=t.match(/<!doctype html[\s\S]*<\/html>/i)||t.match(/<html[\s\S]*<\/html>/i);
  if(m)return{reply:"Feature ban gaya ✅",pack:{title:"New feature",icon:"✨",summary:"",html:m[0]},files:[],imagePrompt:""};
  return{reply:t.slice(0,1500)||"Samajh nahi aaya, ek baar phir batao?",pack:null,files:[],imagePrompt:""};
 }
 let pack=null;
 if(j.pack&&typeof j.pack==="object"&&typeof j.pack.html==="string"&&j.pack.html.trim().length>20){
  const html=j.pack.html.slice(0,300000);
  pack={title:String(j.pack.title||"New feature").slice(0,60),icon:String(j.pack.icon||"✨").slice(0,4),summary:String(j.pack.summary||"").slice(0,300),html};
 }
 const files=(Array.isArray(j.files)?j.files:[]).filter(f=>f&&typeof f.content==="string"&&typeof f.name==="string").slice(0,5).map(f=>({name:f.name.replace(/[^\w.\- ]/g,"_").slice(0,80)||"file.txt",mime:String(f.mime||"text/plain").slice(0,60),content:f.content.slice(0,400000)}));
 return{reply:String(j.reply||"Ho gaya ✅").slice(0,2000),pack,files,imagePrompt:typeof j.imagePrompt==="string"?j.imagePrompt.slice(0,1500):""};
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
    const raw=Array.isArray(body.messages)?body.messages:[];
    const turns=raw.filter(t=>t&&(t.role==="user"||t.role==="assistant")&&typeof t.text==="string"&&t.text.trim()).slice(-14).map(t=>({role:t.role,text:t.text.slice(0,4000)}));
    while(turns.length&&turns[0].role!=="user")turns.shift();
    if(!turns.length||turns.at(-1).role!=="user")return res.status(400).json({error:"Kuch likho to sahi."});
    const merged=[];for(const t of turns){const l=merged.at(-1);if(l&&l.role===t.role)l.text+=`\n${t.text}`;else merged.push({...t});}
    const cur=body.current&&typeof body.current.html==="string"?body.current:null;
    const contents=merged.map((t,i)=>{
     if(i!==merged.length-1)return{role:t.role==="assistant"?"model":"user",parts:[{text:t.text}]};
     const ps=partsFor(t.text,body.attachments||[],10);
     if(cur)ps.unshift({text:`CURRENT PACK (owner isi ko badalna chahta hai) title="${String(cur.title||"").slice(0,60)}":\n${cur.html.slice(0,120000)}`});
     return{role:"user",parts:ps};
    });
    try{
     const out=await gemini(c,contents,24000,"",{system:BUILDER_SYSTEM,json:true,temperature:0.6});
     return res.status(200).json(parseBuild(out));
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
