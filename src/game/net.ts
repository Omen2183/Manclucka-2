import type { BestOf, GameState, MatchSettings, Player, RuleSet } from "./types.ts";

export type HelloMsg = { type: "hello"; name: string };
export type SettingsMsg = { type: "settings"; settings: Pick<MatchSettings, "rules" | "bestOf"> };
export type StartMsg = {
  type: "start";
  names: [string, string];
  settings: Pick<MatchSettings, "rules" | "bestOf">;
};
export type MoveMsg = { type: "move"; pit: number; seq: number };
export type NextMsg = { type: "next"; gameIndex: number };
export type ForfeitMsg = { type: "forfeit"; player: Player };

export type NetMessage = HelloMsg | SettingsMsg | StartMsg | MoveMsg | NextMsg | ForfeitMsg;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRuleSet(value: unknown): value is RuleSet {
  return value === "classic" || value === "first-empty" || value === "until-empty";
}

function isBestOf(value: unknown): value is BestOf {
  return value === 1 || value === 3 || value === 5 || value === 7;
}

function parseSettings(value: unknown): Pick<MatchSettings, "rules" | "bestOf"> | null {
  if (!isObject(value)) return null;
  if (!isRuleSet(value.rules) || !isBestOf(value.bestOf)) return null;
  return { rules: value.rules, bestOf: value.bestOf };
}

export function parseNetMessage(data: unknown): NetMessage | null {
  if (!isObject(data) || typeof data.type !== "string") return null;
  switch (data.type) {
    case "hello":
      return typeof data.name === "string" ? { type: "hello", name: data.name.slice(0, 24) } : null;
    case "settings": {
      const settings = parseSettings(data.settings);
      return settings ? { type: "settings", settings } : null;
    }
    case "start": {
      const settings = parseSettings(data.settings);
      const names = data.names;
      if (!settings || !Array.isArray(names) || names.length !== 2) return null;
      if (typeof names[0] !== "string" || typeof names[1] !== "string") return null;
      return { type: "start", names: [names[0].slice(0, 24), names[1].slice(0, 24)], settings };
    }
    case "move":
      if (typeof data.pit !== "number" || typeof data.seq !== "number") return null;
      if (!Number.isInteger(data.pit) || !Number.isInteger(data.seq)) return null;
      return { type: "move", pit: data.pit, seq: data.seq };
    case "next":
      return typeof data.gameIndex === "number" && Number.isInteger(data.gameIndex)
        ? { type: "next", gameIndex: data.gameIndex }
        : null;
    case "forfeit":
      return data.player === 0 || data.player === 1 ? { type: "forfeit", player: data.player } : null;
    default:
      return null;
  }
}

export type { GameState };
