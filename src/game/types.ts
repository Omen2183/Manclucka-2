export type Player = 0 | 1;
export type RuleSet = "classic" | "first-empty" | "until-empty";
export type PlayMode = "solo" | "hotseat" | "online";
export type BestOf = 1 | 3 | 5 | 7;
export type Difficulty = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export const DIFFICULTY_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function clampDifficulty(n: unknown): Difficulty {
  const x = Number(n);
  if (!Number.isFinite(x)) return 3;
  const stepped = Math.round(x * 2) / 2;
  if (stepped <= 1) return 1;
  if (stepped >= 5) return 5;
  return stepped as Difficulty;
}
export type Winner = Player | "draw";

export const PIT_COUNT = 14;
export const SEEDS_PER_PIT = 4;
export const PITS_PER_SIDE = 6;
export const STARTING_FLOCK = PITS_PER_SIDE * 2 * SEEDS_PER_PIT;

export interface GameState {
  pits: number[];
  turn: Player;
  ended: boolean;
  winner: Winner | null;
  rules: RuleSet;
}

export interface CaptureEvent {
  land: number;
  opposite: number;
  amount: number;
}

export interface MoveResult {
  from: number;
  drops: number[];
  extraTurn: boolean;
  capture: CaptureEvent | null;
  emptiedSide: Player | null;
  state: GameState;
}

export interface MatchSettings {
  mode: PlayMode;
  rules: RuleSet;
  bestOf: BestOf;
  difficulty: Difficulty;
  playerName: string;
  friendName: string;
}
