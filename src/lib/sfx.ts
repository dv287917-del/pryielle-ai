// Horror sound engine: every sound is synthesized with the Web Audio API (no audio files, no copyright, tiny APK).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem("pm_mute") === "1";
} catch {
  /* storage unavailable */
}

function ac(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    // dry bus + a dark echo send, so everything sounds like it is in an empty haunted hall
    bus = ctx.createGain();
    bus.connect(master);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    bus.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

function noise(c: AudioContext, secs: number) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function env(c: AudioContext, t: number, peak: number, attack: number, dur: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function ready() {
  const c = ac();
  return c && bus && !muted ? { c, out: bus } : null;
}

/** witch cackle: "hee-hee-hee-hee-heeeeee" */
function cackle() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t0 = c.currentTime + 0.02;
  const base = 430 + Math.random() * 60;
  const hits = 6;
  for (let k = 0; k < hits; k += 1) {
    const last = k === hits - 1;
    const t = t0 + k * 0.14;
    const dur = last ? 0.95 : 0.11;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    const f = base + k * 28;
    osc.frequency.setValueAtTime(f * 1.3, t);
    osc.frequency.exponentialRampToValueAtTime(last ? f * 0.55 : f * 0.9, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = last ? 9 : 34;
    const lfoGain = c.createGain();
    lfoGain.gain.value = last ? 38 : 22;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const f1 = c.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 760;
    f1.Q.value = 5;
    const f2 = c.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 2250;
    f2.Q.value = 7;
    const g = env(c, t, last ? 0.5 : 0.42, 0.012, dur);
    osc.connect(f1);
    osc.connect(f2);
    f1.connect(g);
    f2.connect(g);
    g.connect(out);
    // breathy "h" at the start of each syllable
    const n = noise(c, 0.06);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const ng = env(c, t, 0.12, 0.005, 0.05);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    osc.start(t);
    lfo.start(t);
    n.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    n.stop(t + 0.06);
  }
}

/** jump-scare sting: screeching tritone + noise + sub boom */
function sting() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t = c.currentTime + 0.01;
  [440, 622].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.55);
    const g = env(c, t, 0.34 - i * 0.05, 0.01, 1.1);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 1.2);
  });
  const n = noise(c, 0.5);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const ng = env(c, t, 0.4, 0.005, 0.45);
  n.connect(hp);
  hp.connect(ng);
  ng.connect(out);
  n.start(t);
  const boom = c.createOscillator();
  boom.frequency.setValueAtTime(90, t);
  boom.frequency.exponentialRampToValueAtTime(34, t + 0.6);
  const bg = env(c, t, 0.9, 0.005, 0.8);
  boom.connect(bg);
  bg.connect(out);
  boom.start(t);
  boom.stop(t + 0.9);
}

function thunder() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t = c.currentTime + 0.01;
  const n = noise(c, 3.4);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(70, t + 3);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.06);
  g.gain.setValueAtTime(0.9, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
  n.connect(lp);
  lp.connect(g);
  g.connect(out);
  n.start(t);
}

function heartbeat() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t = c.currentTime + 0.01;
  [[0, 62, 0.9], [0.2, 52, 0.6]].forEach(([dt, f, peak]) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f, t + dt);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dt + 0.14);
    const g = env(c, t + dt, peak, 0.008, 0.2);
    o.connect(g);
    g.connect(out);
    o.start(t + dt);
    o.stop(t + dt + 0.25);
  });
}

function whisper() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t = c.currentTime + 0.01;
  const dur = 1.8;
  const n = noise(c, dur);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3600;
  bp.Q.value = 1.1;
  const g = c.createGain();
  const curve = new Float32Array(28).map((_, i) => (i < 3 || i > 24 ? 0 : Math.random() * 0.22));
  g.gain.setValueCurveAtTime(curve, t, dur);
  n.connect(bp);
  bp.connect(g);
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 2 - 1;
    g.connect(p);
    p.connect(out);
  } else g.connect(out);
  n.start(t);
}

function creak() {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t = c.currentTime + 0.01;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(58, t);
  for (let i = 1; i <= 8; i += 1) o.frequency.linearRampToValueAtTime(48 + Math.random() * 50, t + i * 0.16);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 10;
  bp.frequency.setValueAtTime(320, t);
  bp.frequency.linearRampToValueAtTime(980, t + 1.3);
  const g = env(c, t, 0.3, 0.1, 1.4);
  o.connect(bp);
  bp.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 1.5);
}

/** low drone + wind; returns a stop function */
function startDrone(): () => void {
  const r = ready();
  if (!r) return () => undefined;
  const { c, out } = r;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 2.5);
  g.connect(out);
  const a = c.createOscillator();
  a.frequency.value = 55;
  const b = c.createOscillator();
  b.frequency.value = 58.4;
  const og = c.createGain();
  og.gain.value = 0.5;
  a.connect(og);
  b.connect(og);
  og.connect(g);
  const wind = noise(c, 4);
  wind.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.18;
  const lg = c.createGain();
  lg.gain.value = 180;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  const wg = c.createGain();
  wg.gain.value = 0.55;
  wind.connect(lp);
  lp.connect(wg);
  wg.connect(g);
  [a, b, lfo, wind].forEach((s) => s.start(t));
  return () => {
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1);
    window.setTimeout(() => [a, b, lfo, wind].forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }), 1100);
  };
}

function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("pm_mute", m ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = m ? 0 : 0.9;
}

// Android WebView may keep audio suspended until the first touch.
const unlock = () => {
  ac();
  window.removeEventListener("pointerdown", unlock);
};
window.addEventListener("pointerdown", unlock);

const playing = new Set<HTMLAudioElement>();
function playFile(url: string, volume = 1): HTMLAudioElement | null {
  if (muted) return null;
  const a = new Audio(url);
  a.volume = volume;
  playing.add(a);
  a.onended = () => playing.delete(a);
  void a.play().catch(() => playing.delete(a));
  return a;
}
function stopFiles() {
  playing.forEach((a) => a.pause());
  playing.clear();
}

export const sfx = { playFile, stopFiles, cackle, sting, thunder, heartbeat, whisper, creak, startDrone, setMuted, isMuted: () => muted };
