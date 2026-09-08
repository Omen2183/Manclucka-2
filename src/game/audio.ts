/**
 * Farm mixer: real chicken recordings decoded into Web Audio buffers,
 * with a tiny synth fallback if a clip fails to load (offline / first tap).
 */

import { loadMuted, saveMuted } from "@/lib/persist";

const MASTER_GAIN = 0.72;
const MAX_VOICES = 8;

const BANKS = {
  sow: ["/sfx/cluck-a.mp3", "/sfx/cluck-b.mp3", "/sfx/cluck-c.mp3", "/sfx/cluck-d.mp3", "/sfx/cluck-e.mp3"],
  rooster: ["/sfx/rooster.mp3", "/sfx/rooster-b.mp3"],
  scared: ["/sfx/scared.mp3", "/sfx/scared-b.mp3"],
  extra: ["/sfx/chatter.mp3"],
  win: ["/sfx/crow-long.mp3", "/sfx/rooster.mp3"],
  lose: ["/sfx/scared-b.mp3"],
} as const;

type Cue = keyof typeof BANKS;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let unlocked = false;
let muted = typeof window !== "undefined" ? loadMuted() : false;
let voices = 0;
let preloadStarted = false;
const buffers = new Map<string, AudioBuffer>();

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfx.connect(master);
    master.connect(ctx.destination);
    master.gain.value = muted ? 0 : MASTER_GAIN;
    sfx.gain.value = 0.95;
  }
  return ctx;
}

function allUrls(): string[] {
  return [...new Set(Object.values(BANKS).flat())];
}

async function decodeUrl(audio: AudioContext, url: string): Promise<void> {
  if (buffers.has(url)) return;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return;
  const raw = await res.arrayBuffer();
  const buf = await audio.decodeAudioData(raw.slice(0));
  buffers.set(url, buf);
}

function preload(): void {
  const audio = ensure();
  if (!audio || preloadStarted) return;
  preloadStarted = true;
  void Promise.all(allUrls().map((url) => decodeUrl(audio, url).catch(() => undefined)));
}

export function unlockAudio(): void {
  const audio = ensure();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  unlocked = true;
  preload();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  saveMuted(next);
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : MASTER_GAIN, ctx.currentTime, 0.02);
  }
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function playBuffer(url: string, opts: { rate?: number; gain?: number; when?: number } = {}): boolean {
  const audio = ensure();
  if (!audio || !sfx || !unlocked || muted) return false;
  const buf = buffers.get(url);
  if (!buf) return false;
  if (voices >= MAX_VOICES) return true;

  const src = audio.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = opts.rate ?? 1;

  const g = audio.createGain();
  const peak = opts.gain ?? 0.9;
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
    src.disconnect();
    g.disconnect();
  };
  src.start(t);
  return true;
}

function playCue(cue: Cue, jitter = 0.08, gain = 0.9): void {
  const url = pick(BANKS[cue]);
  const rate = 1 + (Math.random() * 2 - 1) * jitter;
  if (playBuffer(url, { rate, gain })) return;
  synthFallback(cue);
}

function noiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
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
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  const g = envGain(audio, dest, start, peak, Math.min(0.012, dur / 4), dur);
  osc.connect(g);
  osc.start(start);
  osc.stop(start + dur + 0.02);
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
  const audio = ensure();
  if (!audio || !sfx || !unlocked) return;
  playTone(audio, sfx, "sine", 140, audio.currentTime, 0.1, 0.1);
}

export function rumble(ms = 18): void {
  if (typeof navigator === "undefined" || muted) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => unlockAudio(), { once: true });
  window.addEventListener("keydown", () => unlockAudio(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
