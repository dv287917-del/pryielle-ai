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
function system(c, extra) { return ["Tum Pryielle MSG ke Pryielle AI ho.",MODES[c.mode],LANGS[c.lang],LENGTHS[c.length],"Lamba jawab tab do jab user detail, step-by-step, code ya explanation maange.",c.instructions?`Owner instructions:\n${c.instructions}`:"",SAFETY,extra||""].filter(Boolean).join("\n"); }
async function quota(db, uid, c) {
 const ref=db.doc(`aiUsage/${uid}`), now=Date.now(), day=new Date(now+19800000).toISOString().slice(0,10);
 await db.runTransaction(async tx=>{const s=await tx.get(ref), d=s.exists?s.data():{}, count=d.day===day?Number(d.count)||0:0;
 if(now-(Number(d.lastAt)||0)<2500) throw Object.assign(new Error("Thoda ruko, AI abhi pichla jawab de raha hai."),{status:429});
 if(count>=c.dailyLimit) throw Object.assign(new Error("Aaj ka AI quota khatam ho gaya. Kal phir try karo."),{status:429});
 tx.set(ref,{day,count:count+1,lastAt:now});});
}
async function gemini(c, contents, maxTokens, extra) {
 const key=process.env.GEMINI_API_KEY;
 if(!key) throw new Error("Vercel Environment Variable GEMINI_API_KEY missing");
 let model=c.model;
 for(let n=0;n<3;n++){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:system(c,extra)}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:c.temperature}}),signal:AbortSignal.timeout(100000)});
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
function partsFor(text, attachments=[]) {
 const parts=[];let bytes=0;
 for(const a of (Array.isArray(attachments)?attachments:[]).slice(0,4)){
  if(!a||typeof a!=="object")continue;
  if(a.kind==="image"&&["image/jpeg","image/png","image/webp","image/gif"].includes(a.mime)&&typeof a.data==="string"){bytes+=a.data.length;parts.push({inlineData:{mimeType:a.mime,data:a.data}});}
  else if(a.kind==="pdf"&&typeof a.data==="string"){bytes+=a.data.length;parts.push({inlineData:{mimeType:"application/pdf",data:a.data}});}
  else if(a.kind==="text"&&typeof a.text==="string"){bytes+=a.text.length;parts.push({text:`[File: ${String(a.name||"file").slice(0,80)}]\n${a.text.slice(0,60000)}`});}
 }
 if(bytes>9000000)throw Object.assign(new Error("Files 9MB se chhoti rakho."),{status:400});
 parts.push({text:text||"(is file/photo ko dekho aur batao)"});return parts;
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
  if(action==="ask"){
   const raw=Array.isArray(body.messages)?body.messages:[];
   const turns=raw.filter(t=>t&&(t.role==="user"||t.role==="assistant")&&typeof t.text==="string"&&t.text.trim()).slice(-20).map(t=>({role:t.role,text:t.text.slice(0,6000)}));
   while(turns.length&&turns[0].role!=="user")turns.shift();
   if(!turns.length||turns.at(-1).role!=="user")return res.status(400).json({error:"Kuch likho to sahi."});
   await quota(db,user.uid,c);
   const merged=[];for(const t of turns){const last=merged.at(-1);if(last&&last.role===t.role)last.text+=`\n${t.text}`;else merged.push({...t});}
   const last=merged.at(-1), atts=body.attachments||[];
   const contents=merged.map((t,i)=>({role:t.role==="assistant"?"model":"user",parts:i===merged.length-1?partsFor(t.text,atts):[{text:t.text}]}));
   const text=await gemini(c,contents,atts.length?6000:LONG_RE.test(last.text)?4000:1800,`Private chat with ${String(u.displayName||"dost").slice(0,30)}.`);
   return res.status(200).json({text});
  }
  if(action==="group"){
   const chatId=String(body.chatId||""), msgId=String(body.msgId||"");
   if(!/^[\w-]{1,160}$/.test(chatId)||!/^[\w-]{1,160}$/.test(msgId))return res.status(400).json({error:"Invalid chat/message."});
   const chatRef=db.doc(`chats/${chatId}`), chatSnap=await chatRef.get(), chat=chatSnap.data();
   if(!chat||!Array.isArray(chat.members)||!chat.members.includes(user.uid))return res.status(403).json({error:"Chat access nahi hai."});
   const msgRef=chatRef.collection("messages").doc(msgId), ms=await msgRef.get(), m=ms.data();
   if(!m||m.senderId!==user.uid||m.system||m.ai||m.deleted)return res.status(400).json({error:"Message invalid hai."});
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
   try{const text=await gemini(c,[{role:"user",parts:[{text:promptText}]}],LONG_RE.test(prompt)?3000:1500,`Group chat hai, jawab ${who} ko do. Jawab chhota rakho jab tak wo lamba na maange.`);await reply(text);}
   catch(e){await reply(e.message||"AI abhi jawab nahi de pa raha.");}
   return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:"Unknown action."});
 } catch(e){return res.status(e.status||500).json({error:e.message||"AI abhi jawab nahi de pa raha."});}
}
