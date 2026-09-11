import { settleState, sideSum } from "../game/engine.ts";
import type { BestOf, Difficulty, GameState, MatchSettings, PlayMode, Player, RuleSet, Winner } from "../game/types.ts";
import { PIT_COUNT } from "../game/types.ts";

const SETTINGS_KEY = "manclucka:settings";
const MUTE_KEY = "manclucka:muted";
const STATS_KEY = "manclucka:stats";
const TIP_KEY = "manclucka:tipped";
const MIXER_KEY = "manclucka:mixer";
const MATCH_KEY = "manclucka:match";

const MATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PEER_RE = /^p-[a-z0-9]{4,16}$/;

function readStore(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function saveMatchSnapshot(snap: MatchSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    writeStore(MATCH_KEY, JSON.stringify({ ...snap, v: 1, savedAt: Date.now() }));
  } catch {
    /* quota / circular */
  }
}

function removeStore(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface YardStats {
  played: number;
  won: number;
}

export type MatchPhase = "lobby" | "play";
export type SeriesGate = "play" | "between" | "over";

export interface MatchSnapshot {
  v: 1;
  savedAt: number;
  phase: MatchPhase;
  settings: MatchSettings;
  names: [string, string];
  south: Player;
  scores: [number, number];
  gameIndex: number;
  gate: SeriesGate;
  lastWinner: Winner | null;
  lastCoops: [number, number];
  board: GameState;
  host: boolean;
  room: string | null;
  peerId?: string;
  seq?: number;
}

export function loadMuted(): boolean {
  return readStore(MUTE_KEY) === "1";
}

export function saveMuted(muted: boolean): void {
  writeStore(MUTE_KEY, muted ? "1" : "0");
}

export interface MixerLevels {
  master: number;
  chickens: number;
  yard: number;
  muted: boolean;
}

export const DEFAULT_MIXER: MixerLevels = {
  master: 0.72,
  chickens: 1,
  yard: 0.34,
  muted: false,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function loadMixer(): MixerLevels {
  const muted = loadMuted();
  try {
    const raw = readStore(MIXER_KEY);
    if (!raw) return { ...DEFAULT_MIXER, muted };
    const parsed = JSON.parse(raw) as Partial<MixerLevels>;
    return {
      master: parsed.master == null ? DEFAULT_MIXER.master : clamp01(Number(parsed.master)),
      chickens: parsed.chickens == null ? DEFAULT_MIXER.chickens : clamp01(Number(parsed.chickens)),
      yard: parsed.yard == null ? DEFAULT_MIXER.yard : clamp01(Number(parsed.yard)),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : muted,
    };
  } catch {
    return { ...DEFAULT_MIXER, muted };
  }
}

export function saveMixer(levels: MixerLevels): void {
  writeStore(
    MIXER_KEY,
    JSON.stringify({
      master: clamp01(levels.master),
      chickens: clamp01(levels.chickens),
      yard: clamp01(levels.yard),
      muted: !!levels.muted,
    }),
  );
  saveMuted(!!levels.muted);
}

export function loadSettingsPatch(): Partial<MatchSettings> {
  try {
    const raw = readStore(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<MatchSettings>;
    const patch: Partial<MatchSettings> = {};
    if (parsed.mode === "solo" || parsed.mode === "hotseat" || parsed.mode === "online") {
      patch.mode = parsed.mode as PlayMode;
    }
    if (parsed.rules === "classic" || parsed.rules === "first-empty" || parsed.rules === "until-empty") {
      patch.rules = parsed.rules as RuleSet;
    }
    if (parsed.bestOf === 1 || parsed.bestOf === 3 || parsed.bestOf === 5 || parsed.bestOf === 7) {
      patch.bestOf = parsed.bestOf as BestOf;
    }
    if (
      typeof parsed.difficulty === "number" &&
      Number.isInteger(parsed.difficulty) &&
      parsed.difficulty >= 1 &&
      parsed.difficulty <= 5
    ) {
      patch.difficulty = parsed.difficulty as Difficulty;
    }
    if (typeof parsed.friendName === "string") {
      const friend = parsed.friendName.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
      if (friend && !/^keeper$/i.test(friend)) patch.friendName = friend;
    }
    if (typeof parsed.playerName === "string") {
      const name = parsed.playerName.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
      if (name && !/^keeper$/i.test(name)) patch.playerName = name;
    }
    return patch;
  } catch {
    return {};
  }
}

export function saveSettings(settings: MatchSettings): void {
  writeStore(
    SETTINGS_KEY,
    JSON.stringify({
      mode: settings.mode,
      rules: settings.rules,
      bestOf: settings.bestOf,
      difficulty: settings.difficulty,
      friendName: settings.friendName,
      playerName: settings.playerName,
    }),
  );
}

export function loadStats(): YardStats {
  try {
    const raw = readStore(STATS_KEY);
    if (!raw) return { played: 0, won: 0 };
    const parsed = JSON.parse(raw) as YardStats;
    return {
      played: Number(parsed.played) || 0,
      won: Number(parsed.won) || 0,
    };
  } catch {
    return { played: 0, won: 0 };
  }
}

export function recordGame(didWin: boolean): YardStats {
  const next = loadStats();
  next.played += 1;
  if (didWin) next.won += 1;
  writeStore(STATS_KEY, JSON.stringify(next));
  return next;
}

export function loadTipped(): boolean {
  return readStore(TIP_KEY) === "1";
}

export function saveTipped(): void {
  writeStore(TIP_KEY, "1");
}

function isPlayer(value: unknown): value is Player {
  return value === 0 || value === 1;
}

function isWinner(value: unknown): value is Winner {
  return value === 0 || value === 1 || value === "draw";
}

function stripKeeper(name: string, fallback = "You"): string {
  const t = name.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim();
  return !t || /^keeper$/i.test(t) ? fallback : t.slice(0, 24);
}

function parseBoard(value: unknown, rules: RuleSet): GameState | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.pits) || rec.pits.length !== PIT_COUNT) return null;
  if (!rec.pits.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 48)) return null;
  const pits = rec.pits.map((n) => Number(n));
  const total = pits.reduce((a, b) => a + b, 0);
  if (total > 48) return null;
  if (!isPlayer(rec.turn)) return null;
  const boardRules =
    rec.rules === "classic" || rec.rules === "first-empty" || rec.rules === "until-empty" ? rec.rules : rules;
  if (boardRules !== rules) return null;
  if (typeof rec.ended !== "boolean") return null;
  if (rec.winner != null && !isWinner(rec.winner)) return null;
  const board: GameState = {
    pits,
    turn: rec.turn,
    ended: rec.ended,
    winner: rec.winner == null ? null : rec.winner,
    rules: boardRules,
  };
  if (board.ended && (sideSum(board.pits, 0) > 0 || sideSum(board.pits, 1) > 0)) {
    board.ended = false;
    board.winner = null;
  }
  const settled = settleState(board);
  if (settled.ended && settled.winner == null) settled.winner = "draw";
  return settled;
}

export function parseMatchSnapshot(raw: unknown): MatchSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1) return null;
  if (typeof rec.savedAt !== "number" || !Number.isFinite(rec.savedAt)) return null;
  if (rec.savedAt > Date.now() + 60_000) return null;
  if (Date.now() - rec.savedAt > MATCH_MAX_AGE_MS) return null;
  if (rec.phase !== "play" && rec.phase !== "lobby") return null;
  if (rec.gate === "over") return null;
  const settings = rec.settings as MatchSettings | undefined;
  if (!settings || typeof settings !== "object") return null;
  if (settings.mode !== "solo" && settings.mode !== "hotseat" && settings.mode !== "online") return null;
  if (settings.rules !== "classic" && settings.rules !== "first-empty" && settings.rules !== "until-empty") {
    return null;
  }
  if (settings.bestOf !== 1 && settings.bestOf !== 3 && settings.bestOf !== 5 && settings.bestOf !== 7) {
    return null;
  }
  const names = rec.names;
  if (!Array.isArray(names) || names.length !== 2 || typeof names[0] !== "string" || typeof names[1] !== "string") {
    return null;
  }
  if (!isPlayer(rec.south)) return null;
  if (!Array.isArray(rec.scores) || rec.scores.length !== 2) return null;
  const board = parseBoard(rec.board, settings.rules);
  if (!board) return null;
  if (rec.gate !== "play" && rec.gate !== "between") return null;
  const room = typeof rec.room === "string" && /^[A-Z0-9]{6}$/.test(rec.room) ? rec.room : null;
  if (settings.mode === "online" && !room) return null;
  const score0 = Number(rec.scores[0]);
  const score1 = Number(rec.scores[1]);
  if (!Number.isInteger(score0) || !Number.isInteger(score1) || score0 < 0 || score1 < 0 || score0 > 20 || score1 > 20) {
    return null;
  }
  const need = settings.bestOf === 1 ? 1 : settings.bestOf === 3 ? 2 : settings.bestOf === 5 ? 3 : 4;
  if (score0 >= need || score1 >= need) return null;
  return {
    v: 1,
    savedAt: rec.savedAt,
    phase: rec.phase,
    settings: {
      mode: settings.mode,
      rules: settings.rules,
      bestOf: settings.bestOf,
      difficulty:
        Number.isInteger(settings.difficulty) && settings.difficulty >= 1 && settings.difficulty <= 5
          ? settings.difficulty
          : 3,
      playerName: stripKeeper(String(settings.playerName || "You"), "You"),
      friendName: stripKeeper(String(settings.friendName || "Friend"), "Friend"),
    },
    names: [
      stripKeeper(names[0], "You"),
      (() => {
        const far = stripKeeper(names[1], "Friend");
        return /^you$/i.test(far) ? "Friend" : far;
      })(),
    ],
    south: rec.south,
    scores: [score0, score1],
    gameIndex:
      typeof rec.gameIndex === "number" && Number.isFinite(rec.gameIndex)
        ? Math.max(0, Math.min(20, Math.trunc(rec.gameIndex)))
        : 0,
    gate: rec.gate,
    lastWinner: rec.lastWinner == null || !isWinner(rec.lastWinner) ? null : rec.lastWinner,
    lastCoops: Array.isArray(rec.lastCoops)
      ? [Math.max(0, Math.min(48, Number(rec.lastCoops[0]) || 0)), Math.max(0, Math.min(48, Number(rec.lastCoops[1]) || 0))]
      : [0, 0],
    board,
    host: rec.host === true,
    room,
    peerId: typeof rec.peerId === "string" && PEER_RE.test(rec.peerId) ? rec.peerId : undefined,
    seq:
      typeof rec.seq === "number" && Number.isInteger(rec.seq) && rec.seq >= 0 && rec.seq <= 9999 ? rec.seq : 0,
  };
}

export function loadMatchSnapshot(): MatchSnapshot | null {
  try {
    const raw = readStore(MATCH_KEY);
    if (!raw) return null;
    return parseMatchSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearMatchSnapshot(): void {
  removeStore(MATCH_KEY);
}
