import type { Player, Winner } from "./types.ts";
import { winsNeeded } from "./engine.ts";

export type SeriesGate = "play" | "between" | "over";

export interface SeriesScore {
  scores: [number, number];
  gate: SeriesGate;
  seriesWinner: Player | null;
}

export function emptySeries(): SeriesScore {
  return { scores: [0, 0], gate: "play", seriesWinner: null };
}

export function tallyGame(
  scores: readonly [number, number],
  winner: Winner,
  need: number,
): SeriesScore {
  const next: [number, number] = [scores[0], scores[1]];
  if (winner !== "draw") next[winner] += 1;
  const seriesWinner: Player | null = next[0] >= need ? 0 : next[1] >= need ? 1 : null;
  const tiedOpener = winner === "draw" && need === 1;
  return {
    scores: next,
    gate: seriesWinner != null || tiedOpener ? "over" : "between",
    seriesWinner,
  };
}

export function seriesNeed(bestOf: 1 | 3 | 5 | 7): number {
  return winsNeeded(bestOf);
}
