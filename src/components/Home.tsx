import { useEffect, useRef, useState } from "react";
import { signOut, type User } from "firebase/auth";
import type { MsgUser } from "../lib/account";
import { auth } from "../firebase";
import { APP_VERSION } from "../lib/version";
import { askAi, askVoice, fileToAttachment, listen, loadChats, newChatId, saveChats, speechSupported, startEars, type AiAttachment, type AiTurn, type Chat, type Ears } from "../lib/ai";
import { ArrowUpIcon, Burst, CopyIcon, GhostIcon, MenuIcon, MicIcon, PlusIcon, StopIcon, WaveIcon } from "./art";
import { Md } from "./Md";
import { Voice } from "./Voice";

type Pick = { id: number; att: AiAttachment };
const MAX_FILES = 4;
const ACCEPT = "image/*,application/pdf,text/*,.json,.csv,.md,.js,.jsx,.ts,.tsx,.py,.java,.kt,.html,.css,.sql,.yml,.yaml,.xml,.txt,.log";
const blank = (): Chat => ({ id: newChatId(), title: "New chat", at: Date.now(), turns: [] });

export function Home({ user, me }: { user: User; me: MsgUser }) {
  const uid = user.uid;
  const name = me.displayName?.trim() || user.displayName?.trim() || user.email?.split("@")[0] || "Friend";
  const photo = me.avatar || user.photoURL || "";

  const [chats, setChats] = useState<Chat[]>(() => loadChats(uid));
  const [cur, setCur] = useState<Chat>(blank);
  const [incog, setIncog] = useState(false);
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [plus, setPlus] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voice, setVoice] = useState(false);
  const [copied, setCopied] = useState(-1);

  const curRef = useRef(cur);
  curRef.current = cur;
  const incogRef = useRef(incog);
  incogRef.current = incog;
  const stopMic = useRef<(() => void) | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileIn = useRef<HTMLInputElement | null>(null);
  const camIn = useRef<HTMLInputElement | null>(null);
  const pickId = useRef(0);

  useEffect(() => () => { stopMic.current?.(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [cur.turns.length, busy]);

  /** Chat update. Reply late aaye aur user dusri chat khol chuka ho to sirf save hota hai, screen nahi badalti. */
  const commit = (next: Chat) => {
    if (curRef.current.id === next.id) { curRef.current = next; setCur(next); }
    if (incogRef.current || !next.turns.length) return;
    setChats((prev) => {
      const list = [next, ...prev.filter((c) => c.id !== next.id)];
      saveChats(uid, list);
      return list;
    });
  };

  const startNew = (inc = false) => {
    stopMic.current?.();
    setIncog(inc);
    incogRef.current = inc;
    const b = blank();
    curRef.current = b;
    setCur(b);
    setText(""); setPicks([]); setErr(""); setMenu(false); setPlus(false);
  };

  const openChat = (c: Chat) => {
    stopMic.current?.();
    setIncog(false);
    incogRef.current = false;
    curRef.current = c;
    setCur(c);
    setText(""); setPicks([]); setErr(""); setMenu(false);
  };

  const removeChat = (id: string) => {
    setChats((prev) => {
      const list = prev.filter((c) => c.id !== id);
      saveChats(uid, list);
      return list;
    });
    if (curRef.current.id === id) startNew(false);
  };

  const send = async () => {
    const q = text.trim();
    if ((!q && !picks.length) || busy) return;
    stopMic.current?.();
    const atts = picks.map((p) => p.att);
    const shown = q || `📎 ${picks.map((p) => p.att.name).join(", ")}`;
    const base = curRef.current;
    const withUser: Chat = { ...base, title: base.turns.length ? base.title : shown.slice(0, 40), at: Date.now(), turns: [...base.turns, { role: "user", text: shown }] };
    commit(withUser);
    setText(""); setPicks([]); setErr(""); setBusy(true);
    try {
      const reply = await askAi(withUser.turns, atts);
      commit({ ...withUser, at: Date.now(), turns: [...withUser.turns, { role: "assistant", text: reply }] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI abhi jawab nahi de pa raha.");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (list: FileList | null) => {
    setPlus(false);
    if (!list) return;
    setErr("");
    for (const f of Array.from(list)) {
      if (picks.length >= MAX_FILES) { setErr(`Ek baar mein max ${MAX_FILES} files.`); break; }
      try {
        const att = await fileToAttachment(f);
        pickId.current += 1;
        const id = pickId.current;
        setPicks((p) => (p.length >= MAX_FILES ? p : [...p, { id, att }]));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "File nahi khuli.");
      }
    }
  };

  /** Mic: bolke likhna. Phone mein SpeechRecognition na ho to awaaz server se text banwate hain. */
  const dictate = async () => {
    if (listening) { stopMic.current?.(); return; }
    setErr("");
    const base = text;
    const join = (t: string) => (base.trim() ? `${base.trim()} ${t}` : t);
    if (speechSupported()) {
      setListening(true);
      stopMic.current = listen("hi-IN", (t) => setText(join(t)), (er) => {
        setListening(false);
        stopMic.current = null;
        if (er && er !== "no-speech" && er !== "aborted") setErr(er === "not-allowed" ? "Mic ki permission do." : "Bolke likhna abhi nahi chala.");
      });
      return;
    }
    let ears: Ears | null = null;
    let done = false;
    const finish = () => {
      done = true;
      ears?.stop();
      stopMic.current = null;
      setListening(false);
    };
    setListening(true);
    try {
      ears = await startEars({
        onSpeech: () => undefined,
        onError: (m) => { setErr(m); finish(); },
        onClip: (wav) => {
          ears?.setPaused(true);
          setTranscribing(true);
          askVoice([], wav, [], "auto")
            .then((r) => { if (r.heard) setText(join(r.heard)); })
            .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Awaaz samajh nahi aayi."))
            .finally(() => { setTranscribing(false); finish(); });
        },
      });
      if (done) ears.stop(); else stopMic.current = finish;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Mic start nahi hua.");
      finish();
    }
  };

  const copy = (i: number, t: string) => {
    void navigator.clipboard?.writeText(t).then(() => { setCopied(i); setTimeout(() => setCopied(-1), 1200); }).catch(() => undefined);
  };

  const onVoiceTurn = (heard: string, reply: string) => {
    const base = curRef.current;
    const turns: AiTurn[] = [...base.turns];
    if (heard) turns.push({ role: "user", text: heard });
    if (reply) turns.push({ role: "assistant", text: reply });
    if (turns.length === base.turns.length) return;
    commit({ ...base, title: base.turns.length ? base.title : (heard || "Voice chat").slice(0, 40), at: Date.now(), turns });
  };

  const empty = cur.turns.length === 0 && !busy;
  const hasInput = text.trim().length > 0 || picks.length > 0;

  return (
    <main className="home">
      <header className="top">
        <button type="button" className="icon" aria-label="Menu" onClick={() => setMenu(true)}>
          <MenuIcon />
        </button>
        <button type="button" className={`icon ${incog ? "on" : ""}`} aria-label="Incognito chat" onClick={() => startNew(!incog)}>
          <GhostIcon />
        </button>
      </header>

      {empty ? (
        <section className="center">
          <Burst size={55} />
          <h1 className="hello">{incog ? "Incognito chat" : `${name} returns!`}</h1>
          {incog ? (
            <p className="hint">Ye chat save nahi hogi.</p>
          ) : (
            <button type="button" className="plan">
              Free plan · <b>Upgrade</b>
            </button>
          )}
        </section>
      ) : (
        <section className="msgs">
          {cur.turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="msg me"><div className="bubble">{t.text}</div></div>
            ) : (
              <div key={i} className="msg ai">
                <div className="md"><Md text={t.text} /></div>
                <button type="button" className="copy" aria-label="Copy" onClick={() => copy(i, t.text)}>
                  <CopyIcon /> {copied === i ? "Copied" : ""}
                </button>
              </div>
            ),
          )}
          {busy ? <div className="msg ai"><Burst size={26} className="burst-spin" /></div> : null}
          <div ref={bottom} />
        </section>
      )}

      {err ? <p className="err bar" onClick={() => setErr("")}>{err}</p> : null}

      {picks.length ? (
        <div className="chips">
          {picks.map((p) => (
            <span key={p.id} className="chip">
              {p.att.kind === "image" ? "🖼️" : p.att.kind === "pdf" ? "📄" : "📝"} {p.att.name.slice(0, 18)}
              <button type="button" aria-label="Remove" onClick={() => setPicks((a) => a.filter((x) => x.id !== p.id))}>×</button>
            </span>
          ))}
        </div>
      ) : null}

      <footer className="composer">
        <button type="button" className="circle dark" aria-label="Add" onClick={() => setPlus((v) => !v)}>
          <PlusIcon />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder={transcribing ? "Sun raha hoon…" : listening ? "Bolo…" : "Type or hold to talk"}
          aria-label="Message"
        />
        <button type="button" className={`circle dark ${listening ? "rec" : ""}`} aria-label="Dictate" onClick={() => void dictate()}>
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
        {hasInput ? (
          <button type="button" className="circle light" aria-label="Send" disabled={busy} onClick={() => void send()}>
            <ArrowUpIcon />
          </button>
        ) : (
          <button type="button" className="circle light" aria-label="Voice mode" onClick={() => { stopMic.current?.(); setVoice(true); }}>
            <WaveIcon />
          </button>
        )}
      </footer>

      <input ref={fileIn} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />

      {plus ? (
        <div className="scrim" onClick={() => setPlus(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="row" onClick={() => fileIn.current?.click()}>📎 Photo ya file</button>
            <button type="button" className="row" onClick={() => camIn.current?.click()}>📷 Camera</button>
          </div>
        </div>
      ) : null}

      {voice ? <Voice history={() => curRef.current.turns} onTurn={onVoiceTurn} onClose={() => setVoice(false)} /> : null}

      {menu ? (
        <div className="scrim side" onClick={() => setMenu(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="who">
              {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span className="ph">{name[0]?.toUpperCase()}</span>}
              <div>
                <p className="sheet-name">{name}</p>
                <p className="sheet-sub">{me.pro ? "Pro" : "Free plan"} · {user.email}</p>
              </div>
            </div>
            <button type="button" className="row" onClick={() => startNew(false)}>＋ New chat</button>
            <p className="dh">Chats</p>
            <div className="chatlist">
              {chats.length === 0 ? <p className="sheet-sub">Abhi koi chat nahi.</p> : null}
              {chats.map((c) => (
                <div key={c.id} className={`crow ${c.id === cur.id && !incog ? "act" : ""}`}>
                  <button type="button" className="ctitle" onClick={() => openChat(c)}>{c.title}</button>
                  <button type="button" className="cdel" aria-label="Delete chat" onClick={() => removeChat(c.id)}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="row dim" disabled>Settings (Batch 5)</button>
            <button type="button" className="sheet-btn" onClick={() => void signOut(auth)}>Sign out</button>
            <p className="ver">Pryielle AI v{APP_VERSION}</p>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
