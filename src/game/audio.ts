/**
 * Farm mixer: real chicken recordings + looping countryside beds,
 * with a tiny synth fallback if a clip fails to load (offline / first tap).
 */

import { loadMixer, saveMixer, type MixerLevels } from "@/lib/persist";

const MAX_VOICES = 8;
const YARD_ROTATE_MIN_MS = 26000;
const YARD_ROTATE_SPAN_MS = 22000;

const BANKS = {
  sow: ["/sfx/cluck-a.mp3", "/sfx/cluck-b.mp3", "/sfx/cluck-c.mp3", "/sfx/cluck-d.mp3", "/sfx/cluck-e.mp3"],
  rooster: ["/sfx/rooster.mp3", "/sfx/rooster-b.mp3"],
  scared: ["/sfx/scared.mp3", "/sfx/scared-b.mp3"],
  extra: ["/sfx/chatter.mp3"],
  win: ["/sfx/crow-long.mp3", "/sfx/rooster.mp3"],
  lose: ["/sfx/scared-b.mp3"],
} as const;

const YARD_BEDS = ["/sfx/yard-breeze.mp3", "/sfx/yard-geese.mp3", "/sfx/yard-garden.mp3", "/sfx/yard-noon.mp3"];

type Cue = keyof typeof BANKS;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let yard: GainNode | null = null;
let unlocked = false;
let voices = 0;
let preloadStarted = false;
const buffers = new Map<string, AudioBuffer>();

let mix: MixerLevels = typeof window !== "undefined" ? loadMixer() : { master: 0.72, chickens: 1, yard: 0.42, muted: false };
let muted = mix.muted;

let yardWanted = 0;
let yardSrc: AudioBufferSourceNode | null = null;
let yardFade: GainNode | null = null;
let yardTimer: ReturnType<typeof setTimeout> | null = null;
let lastYardUrl = "";
const liveYard = new Set<AudioBufferSourceNode>();
const mixListeners = new Set<(next: MixerLevels) => void>();

function emitMix(): void {
  const snapshot = getMixer();
  for (const fn of mixListeners) fn(snapshot);
}

function applyGains(): void {
  if (!ctx || !master || !sfx || !yard) return;
  const t = ctx.currentTime;
  const masterVal = muted || mix.muted ? 0 : mix.master;
  master.gain.setTargetAtTime(masterVal, t, 0.04);
  sfx.gain.setTargetAtTime(mix.chickens, t, 0.04);
  yard.gain.setTargetAtTime(mix.yard, t, 0.08);
}

function dropClosedContext(): void {
  ctx = null;
  master = null;
  sfx = null;
  yard = null;
  preloadStarted = false;
  buffers.clear();
  yardSrc = null;
  yardFade = null;
  lastYardUrl = "";
  voices = 0;
  unlocked = false;
  liveYard.clear();
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx?.state === "closed") dropClosedContext();
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: "interactive" });
    } catch {
      try {
        ctx = new AC();
      } catch {
        return null;
      }
    }
    master = ctx.createGain();
    sfx = ctx.createGain();
    yard = ctx.createGain();
    sfx.connect(master);
    yard.connect(master);
    master.connect(ctx.destination);
    applyGains();
    ctx.onstatechange = () => {
      if (!ctx) return;
      if (ctx.state === "closed") dropClosedContext();
      else if (ctx.state === "running") {
        unlocked = true;
        if (yardWanted > 0) ensureYardBed();
      } else {
        stopYardBed();
      }
    };
  }
  return ctx;
}

function sfxUrls(): string[] {
  return [...new Set(Object.values(BANKS).flat())];
}

async function decodeUrl(audio: AudioContext, url: string): Promise<void> {
  if (buffers.has(url)) return;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return;
  const raw = await res.arrayBuffer();
  try {
    const buf = await audio.decodeAudioData(raw.slice(0));
    if (audio !== ctx || audio.state === "closed") return;
    buffers.set(url, buf);
  } catch {
    /* skip a bad clip */
  }
}

function preload(): void {
  const audio = ensure();
  if (!audio || preloadStarted) return;
  preloadStarted = true;
  void Promise.all(sfxUrls().map((url) => decodeUrl(audio, url).catch(() => undefined))).then(() => {
    if (yardWanted > 0) void warmYard(audio);
  });
}

async function warmYard(audio: AudioContext): Promise<void> {
  for (const url of YARD_BEDS) {
    await decodeUrl(audio, url).catch(() => undefined);
    if (buffers.has(url) && yardWanted > 0 && !yardSrc) ensureYardBed();
    break;
  }
  for (const url of YARD_BEDS) {
    if (!buffers.has(url)) void decodeUrl(audio, url).catch(() => undefined);
  }
}

export function unlockAudio(): void {
  const audio = ensure();
  if (!audio) return;
  if (audio.state === "closed") {
    dropClosedContext();
    return;
  }
  if (audio.state !== "running") {
    void audio.resume().then(() => {
      if (audio.state === "running") {
        unlocked = true;
        if (yardWanted > 0) ensureYardBed();
      }
    }).catch(() => undefined);
  } else {
    unlocked = true;
  }
  try {
    const tick = audio.createBuffer(1, 1, audio.sampleRate);
    const src = audio.createBufferSource();
    src.buffer = tick;
    src.connect(audio.destination);
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.start(0);
  } catch {
    /* gesture unlock fallback */
  }
  preload();
  if (yardWanted > 0) ensureYardBed();
}

export function isMuted(): boolean {
  return muted;
}

export function getMixer(): MixerLevels {
  return { ...mix, muted };
}

export function subscribeMixer(fn: (next: MixerLevels) => void): () => void {
  mixListeners.add(fn);
  return () => mixListeners.delete(fn);
}

export function setMixer(patch: Partial<MixerLevels>): void {
  mix = {
    master: patch.master ?? mix.master,
    chickens: patch.chickens ?? mix.chickens,
    yard: patch.yard ?? mix.yard,
    muted: patch.muted ?? mix.muted,
  };
  muted = mix.muted;
  saveMixer(mix);
  applyGains();
  if (muted || mix.yard <= 0.01) stopYardBed();
  else if (yardWanted > 0) ensureYardBed();
  emitMix();
}

export function setMuted(next: boolean): void {
  setMixer({ muted: next });
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function playBuffer(url: string, opts: { rate?: number; gain?: number; when?: number } = {}): boolean {
  const audio = ensure();
  if (!audio || !sfx || !unlocked || muted || audio.state !== "running") return false;
  const buf = buffers.get(url);
  if (!buf) return false;
  if (voices >= MAX_VOICES) return false;

  try {
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;

    const g = audio.createGain();
    const peak = Math.max(0.0001, opts.gain ?? 0.9);
    const t = opts.when ?? audio.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak, t + Math.max(0.04, buf.duration - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + buf.duration + 0.02);

    src.connect(g);
    g.connect(sfx);
    voices += 1;
    src.onended = () => {
      voices = Math.max(0, voices - 1);
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.start(t);
    return true;
  } catch {
    voices = Math.max(0, voices - 1);
    return false;
  }
}

function playCue(cue: Cue, jitter = 0.08, gain = 0.9): void {
  if (muted) return;
  const url = pick(BANKS[cue]);
  const rate = 1 + (Math.random() * 2 - 1) * jitter;
  if (playBuffer(url, { rate, gain })) return;
  if (voices >= MAX_VOICES) return;
  synthFallback(cue);
}

function envGain(audio: AudioContext, dest: AudioNode, start: number, peak: number, attack: number, release: number): GainNode {
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  g.connect(dest);
  return g;
}

function playTone(
  audio: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  slideTo?: number,
) {
  if (audio.state !== "running") return;
  try {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    const g = envGain(audio, dest, start, Math.max(0.0001, peak), Math.min(0.012, dur / 4), dur);
    osc.connect(g);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch {
    /* closed / interrupted context */
  }
}

function synthFallback(cue: Cue): void {
  const audio = ensure();
  if (!audio || !sfx || !unlocked) return;
  const t = audio.currentTime;
  if (cue === "sow") {
    const freq = 210 + Math.random() * 70;
    playTone(audio, sfx, "triangle", freq, t, 0.07, 0.18);
    return;
  }
  if (cue === "rooster" || cue === "win") {
    playTone(audio, sfx, "sawtooth", 420, t, 0.18, 0.22, 780);
    playTone(audio, sfx, "sawtooth", 760, t + 0.16, 0.22, 0.2, 520);
    return;
  }
  if (cue === "scared" || cue === "lose") {
    for (let i = 0; i < 5; i++) {
      const f = 1600 - i * 140 + Math.random() * 90;
      playTone(audio, sfx, "square", f, t + i * 0.055, 0.045, 0.12, f * 0.7);
    }
    return;
  }
  playTone(audio, sfx, "triangle", 520, t, 0.1, 0.16);
}

function stopYardBed(): void {
  if (yardTimer) {
    clearTimeout(yardTimer);
    yardTimer = null;
  }
  const audio = ctx;
  for (const src of liveYard) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  liveYard.clear();
  if (yardSrc && yardFade && audio) {
    try {
      yardFade.gain.cancelScheduledValues(audio.currentTime);
    } catch {
      /* ignore */
    }
  }
  yardSrc = null;
  yardFade = null;
}

function scheduleYardRotate(): void {
  if (yardTimer) clearTimeout(yardTimer);
  yardTimer = setTimeout(() => {
    yardTimer = null;
    if (yardWanted > 0 && !muted && mix.yard > 0.01) playYardBed();
  }, YARD_ROTATE_MIN_MS + Math.random() * YARD_ROTATE_SPAN_MS);
}

function playYardBed(): void {
  const audio = ensure();
  if (!audio || !yard || !unlocked || muted || mix.yard <= 0.01) return;
  if (audio.state !== "running") return;
  const ready = YARD_BEDS.filter((url) => buffers.has(url) && url !== lastYardUrl);
  const pool = ready.length ? ready : YARD_BEDS.filter((url) => buffers.has(url));
  if (!pool.length) {
    void warmYard(audio);
    return;
  }
  const url = pick(pool);
  const buf = buffers.get(url);
  if (!buf || buf.duration < 1.5) return;

  try {
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const loopStart = Math.min(0.9, buf.duration * 0.04);
    const loopEnd = Math.min(buf.duration - 0.05, Math.max(loopStart + 2, buf.duration - 1.2));
    if (loopEnd > loopStart + 1) {
      src.loopStart = loopStart;
      src.loopEnd = loopEnd;
    }

    const g = audio.createGain();
    g.gain.value = 0.0001;
    src.connect(g);
    g.connect(yard);
    src.start();
    liveYard.add(src);
    g.gain.exponentialRampToValueAtTime(1, audio.currentTime + 1.6);

    if (yardSrc && yardFade) {
      const oldSrc = yardSrc;
      const oldG = yardFade;
      try {
        oldG.gain.cancelScheduledValues(audio.currentTime);
        oldG.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 2);
        oldSrc.stop(audio.currentTime + 2.15);
      } catch {
        try {
          oldSrc.stop();
        } catch {
          /* ignore */
        }
      }
    }

    lastYardUrl = url;
    yardSrc = src;
    yardFade = g;
    src.onended = () => {
      liveYard.delete(src);
      if (yardSrc === src) yardSrc = null;
    };
    scheduleYardRotate();
  } catch {
    yardSrc = null;
    yardFade = null;
    /* Safari can reject bad loop points / already-stopped nodes */
  }
}

function ensureYardBed(): void {
  if (!unlocked || muted || mix.yard <= 0.01 || yardWanted <= 0) return;
  if (ctx?.state !== "running") return;
  if (yardSrc) return;
  playYardBed();
}

export function startYard(): void {
  if (yardWanted < 1) yardWanted = 1;
  if (unlocked) ensureYardBed();
}

export function stopYard(): void {
  yardWanted = Math.max(0, yardWanted - 1);
  if (yardWanted === 0) stopYardBed();
}

export function playSow(): void {
  playCue("sow", 0.12, 0.7);
}

export function playRooster(): void {
  playCue("rooster", 0.04, 1);
}

export function playScared(): void {
  playCue("scared", 0.06, 0.95);
}

export function playExtraTurn(): void {
  playCue("extra", 0.05, 0.85);
}

export function playWin(): void {
  playCue("win", 0.03, 1);
}

export function playLose(): void {
  playCue("lose", 0.05, 0.9);
}

export function playIllegal(): void {
  if (muted) return;
  const audio = ensure();
  if (!audio || !sfx || !unlocked) return;
  playTone(audio, sfx, "sine", 140, audio.currentTime, 0.1, 0.1);
}

export function rumble(ms = 18): void {
  if (typeof navigator === "undefined" || muted) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  const unlock = () => unlockAudio();
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock);
  const onHide = () => {
    stopYardBed();
    voices = 0;
    if (ctx && ctx.state === "running") void ctx.suspend().catch(() => undefined);
  };
  const onShow = () => {
    if (ctx?.state === "closed") dropClosedContext();
    voices = 0;
    unlockAudio();
    if (yardWanted > 0) ensureYardBed();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onShow();
    else onHide();
  });
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);
  window.addEventListener("freeze", onHide);
}
