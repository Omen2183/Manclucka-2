import type { BestOf, Difficulty, GameState, MatchSettings, PlayMode, Player, RuleSet, Winner } from "@/game/types";
import { PIT_COUNT } from "@/game/types";

const SETTINGS_KEY = "manclucka:settings";
const MUTE_KEY = "manclucka:muted";
const STATS_KEY = "manclucka:stats";
const TIP_KEY = "manclucka:tipped";
const MATCH_KEY = "manclucka:match";

const MATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
}

export function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function saveMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export function loadSettingsPatch(): Partial<MatchSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
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
    if (parsed.difficulty && parsed.difficulty >= 1 && parsed.difficulty <= 5) {
      patch.difficulty = parsed.difficulty as Difficulty;
    }
    if (typeof parsed.friendName === "string") {
      patch.friendName = parsed.friendName.slice(0, 24);
    }
    return patch;
  } catch {
    return {};
  }
}

export function saveSettings(settings: MatchSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      mode: settings.mode,
      rules: settings.rules,
      bestOf: settings.bestOf,
      difficulty: settings.difficulty,
      friendName: settings.friendName,
    }),
  );
}

export function loadStats(): YardStats {
  if (typeof window === "undefined") return { played: 0, won: 0 };
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadTipped(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(TIP_KEY) === "1";
}

export function saveTipped(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIP_KEY, "1");
}

function isPlayer(value: unknown): value is Player {
  return value === 0 || value === 1;
}

function isWinner(value: unknown): value is Winner {
  return value === 0 || value === 1 || value === "draw";
}

function parseBoard(value: unknown): GameState | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.pits) || rec.pits.length !== PIT_COUNT) return null;
  if (!rec.pits.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return null;
  if (!isPlayer(rec.turn)) return null;
  if (rec.rules !== "classic" && rec.rules !== "first-empty" && rec.rules !== "until-empty") return null;
  if (typeof rec.ended !== "boolean") return null;
  if (rec.winner != null && !isWinner(rec.winner)) return null;
  return {
    pits: rec.pits.map((n) => Math.floor(Number(n))),
    turn: rec.turn,
    ended: rec.ended,
    winner: rec.winner == null ? null : rec.winner,
    rules: rec.rules,
  };
}

export function parseMatchSnapshot(raw: unknown): MatchSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1) return null;
  if (typeof rec.savedAt !== "number") return null;
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
  const board = parseBoard(rec.board);
  if (!board) return null;
  if (rec.gate !== "play" && rec.gate !== "between" && rec.gate !== "over") return null;
  return {
    v: 1,
    savedAt: rec.savedAt,
    phase: rec.phase,
    settings: {
      mode: settings.mode,
      rules: settings.rules,
      bestOf: settings.bestOf,
      difficulty: settings.difficulty >= 1 && settings.difficulty <= 5 ? settings.difficulty : 3,
      playerName: String(settings.playerName || "Keeper").slice(0, 24),
      friendName: String(settings.friendName || "Friend").slice(0, 24),
    },
    names: [names[0].slice(0, 24), names[1].slice(0, 24)],
    south: rec.south,
    scores: [Number(rec.scores[0]) || 0, Number(rec.scores[1]) || 0],
    gameIndex: typeof rec.gameIndex === "number" ? rec.gameIndex : 0,
    gate: rec.gate,
    lastWinner: rec.lastWinner == null || !isWinner(rec.lastWinner) ? null : rec.lastWinner,
    lastCoops: Array.isArray(rec.lastCoops) ? [Number(rec.lastCoops[0]) || 0, Number(rec.lastCoops[1]) || 0] : [0, 0],
    board,
    host: rec.host === true,
    room: typeof rec.room === "string" && rec.room.length >= 4 ? rec.room : null,
  };
}

export function loadMatchSnapshot(): MatchSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MATCH_KEY);
    if (!raw) return null;
    return parseMatchSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveMatchSnapshot(snap: MatchSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATCH_KEY, JSON.stringify({ ...snap, v: 1, savedAt: Date.now() }));
}

export function clearMatchSnapshot(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MATCH_KEY);
}