import type { BestOf, Difficulty, MatchSettings, PlayMode, RuleSet } from "@/game/types";

const SETTINGS_KEY = "manclucka:settings";
const MUTE_KEY = "manclucka:muted";
const STATS_KEY = "manclucka:stats";
const TIP_KEY = "manclucka:tipped";

export interface YardStats {
  played: number;
  won: number;
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
