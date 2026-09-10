import type { BestOf, GameState, MatchSettings, Player, RuleSet, Winner } from "./types.ts";
import { PIT_COUNT } from "./types.ts";

export type HelloMsg = { type: "hello"; name: string; seq?: number };
export type SettingsMsg = { type: "settings"; settings: Pick<MatchSettings, "rules" | "bestOf"> };
export type StartMsg = {
  type: "start";
  names: [string, string];
  settings: Pick<MatchSettings, "rules" | "bestOf">;
};
export type MoveMsg = { type: "move"; pit: number; seq: number };
export type NextMsg = { type: "next"; gameIndex: number };
export type ForfeitMsg = { type: "forfeit"; player: Player };
export type SyncMsg = {
  type: "sync";
  seq: number;
  gameIndex: number;
  scores: [number, number];
  gate: "play" | "between" | "over";
  pits: number[];
  turn: Player;
  ended: boolean;
  winner: Winner | null;
  names?: [string, string];
};

export type NetMessage = HelloMsg | SettingsMsg | StartMsg | MoveMsg | NextMsg | ForfeitMsg | SyncMsg;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanName(name: string): string {
  const t = name
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  if (!t || /^keeper$/i.test(t)) return "";
  return t;
}

function isRuleSet(value: unknown): value is RuleSet {
  return value === "classic" || value === "first-empty" || value === "until-empty";
}

function isBestOf(value: unknown): value is BestOf {
  return value === 1 || value === 3 || value === 5 || value === 7;
}

function isPlayer(value: unknown): value is Player {
  return value === 0 || value === 1;
}

function isWinner(value: unknown): value is Winner {
  return value === 0 || value === 1 || value === "draw";
}

function isYardIndex(pit: number): boolean {
  return Number.isInteger(pit) && pit >= 0 && pit <= 12 && pit !== 6;
}

function parseSettings(value: unknown): Pick<MatchSettings, "rules" | "bestOf"> | null {
  if (!isObject(value)) return null;
  if (!isRuleSet(value.rules) || !isBestOf(value.bestOf)) return null;
  return { rules: value.rules, bestOf: value.bestOf };
}

function parsePits(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== PIT_COUNT) return null;
  if (!value.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 48)) return null;
  const pits = value.map((n) => Number(n));
  const total = pits.reduce((a, b) => a + b, 0);
  if (total > 48) return null;
  return pits;
}

export function parseNetMessage(data: unknown): NetMessage | null {
  if (!isObject(data) || typeof data.type !== "string") return null;
  switch (data.type) {
    case "hello": {
      if (typeof data.name !== "string") return null;
      const seq =
        typeof data.seq === "number" && Number.isInteger(data.seq) && data.seq >= 0 && data.seq <= 9999
          ? data.seq
          : undefined;
      return { type: "hello", name: cleanName(data.name) || "Friend", ...(seq != null ? { seq } : {}) };
    }
    case "settings": {
      const settings = parseSettings(data.settings);
      return settings ? { type: "settings", settings } : null;
    }
    case "start": {
      const settings = parseSettings(data.settings);
      const names = data.names;
      if (!settings || !Array.isArray(names) || names.length !== 2) return null;
      if (typeof names[0] !== "string" || typeof names[1] !== "string") return null;
      return {
        type: "start",
        names: [cleanName(names[0]) || "You", cleanName(names[1]) || "Friend"],
        settings,
      };
    }
    case "move":
      if (typeof data.pit !== "number" || typeof data.seq !== "number") return null;
      if (!isYardIndex(data.pit) || !Number.isInteger(data.seq)) return null;
      if (data.seq < 1 || data.seq > 9999) return null;
      return { type: "move", pit: data.pit, seq: data.seq };
    case "next":
      if (typeof data.gameIndex !== "number" || !Number.isInteger(data.gameIndex)) return null;
      if (data.gameIndex < 0 || data.gameIndex > 20) return null;
      return { type: "next", gameIndex: data.gameIndex };
    case "forfeit":
      return data.player === 0 || data.player === 1 ? { type: "forfeit", player: data.player } : null;
    case "sync": {
      if (typeof data.seq !== "number" || !Number.isInteger(data.seq) || data.seq < 0 || data.seq > 9999) return null;
      if (typeof data.gameIndex !== "number" || !Number.isInteger(data.gameIndex)) return null;
      if (data.gameIndex < 0 || data.gameIndex > 20) return null;
      if (data.gate !== "play" && data.gate !== "between" && data.gate !== "over") return null;
      if (!Array.isArray(data.scores) || data.scores.length !== 2) return null;
      const scores: [number, number] = [Number(data.scores[0]), Number(data.scores[1])];
      if (!scores.every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) return null;
      const pits = parsePits(data.pits);
      if (!pits || !isPlayer(data.turn) || typeof data.ended !== "boolean") return null;
      if (data.winner != null && !isWinner(data.winner)) return null;
      let names: [string, string] | undefined;
      if (Array.isArray(data.names) && data.names.length === 2 && typeof data.names[0] === "string" && typeof data.names[1] === "string") {
        names = [cleanName(data.names[0]) || "You", cleanName(data.names[1]) || "Friend"];
      }
      return {
        type: "sync",
        seq: data.seq,
        gameIndex: data.gameIndex,
        scores,
        gate: data.gate,
        pits,
        turn: data.turn,
        ended: data.ended,
        winner: data.winner == null ? null : data.winner,
        ...(names ? { names } : {}),
      };
    }
    default:
      return null;
  }
}

export type { GameState };
