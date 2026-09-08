import { legalPits, otherPlayer, scoreOf, sideSum, tryMove } from "./engine.ts";
import type { Difficulty, GameState, Player } from "./types.ts";

const DEPTH: Record<Difficulty, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 5,
};

const JITTER: Record<Difficulty, number> = {
  1: 99,
  2: 14,
  3: 8,
  4: 4,
  5: 2,
};

const BLUNDER: Record<Difficulty, number> = {
  1: 1,
  2: 0.4,
  3: 0.18,
  4: 0.08,
  5: 0.02,
};

const NODE_CAP = 8_000;

function evaluate(state: GameState, me: Player): number {
  const opp = otherPlayer(me);
  const myStore = scoreOf(state, me);
  const oppStore = scoreOf(state, opp);
  if (state.ended) {
    if (state.winner === me) return 10_000 + myStore - oppStore;
    if (state.winner === "draw") return 0;
    return -10_000 + myStore - oppStore;
  }
  let value = (myStore - oppStore) * 12;
  value += sideSum(state.pits, me) - sideSum(state.pits, opp);
  if (state.rules === "first-empty") {
    const mine = sideSum(state.pits, me);
    const theirs = sideSum(state.pits, opp);
    value += mine === 0 ? 80 : Math.max(0, 18 - mine) * 2;
    value -= theirs === 0 ? 80 : 0;
  }
  if (state.rules === "until-empty") {
    value += myStore * 2;
  }
  return value;
}

function orderMoves(state: GameState, pits: number[]): number[] {
  const scored = pits.map((pit) => {
    const result = tryMove(state, pit);
    let rank = 0;
    if (result?.extraTurn) rank += 50;
    if (result?.capture) rank += result.capture.amount * 4;
    if (result?.state.ended && result.state.winner === state.turn) rank += 200;
    return { pit, rank };
  });
  scored.sort((a, b) => b.rank - a.rank);
  return scored.map((s) => s.pit);
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  me: Player,
  nodes: { n: number },
): number {
  if (depth === 0 || state.ended || nodes.n > NODE_CAP) return evaluate(state, me);
  nodes.n += 1;
  const moves = orderMoves(state, legalPits(state));
  if (moves.length === 0) return evaluate(state, me);

  const maximizing = state.turn === me;
  if (maximizing) {
    let best = -Infinity;
    for (const pit of moves) {
      const result = tryMove(state, pit);
      if (!result) continue;
      best = Math.max(best, minimax(result.state, depth - 1, alpha, beta, me, nodes));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const pit of moves) {
    const result = tryMove(state, pit);
    if (!result) continue;
    best = Math.min(best, minimax(result.state, depth - 1, alpha, beta, me, nodes));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function pickRandom(moves: number[]): number {
  return moves[Math.floor(Math.random() * moves.length)]!;
}

export function chooseAiMove(state: GameState, difficulty: Difficulty): number | null {
  const moves = legalPits(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]!;
  if (Math.random() < BLUNDER[difficulty]) return pickRandom(moves);

  const depth = DEPTH[difficulty];
  if (depth <= 0) return pickRandom(moves);

  let bestScore = -Infinity;
  const ranked: { pit: number; score: number }[] = [];
  const nodes = { n: 0 };

  for (const pit of orderMoves(state, moves)) {
    const result = tryMove(state, pit);
    if (!result) continue;
    const score = minimax(result.state, depth - 1, -Infinity, Infinity, state.turn, nodes);
    ranked.push({ pit, score });
    if (score > bestScore) bestScore = score;
  }

  const pool = ranked.filter((r) => r.score >= bestScore - JITTER[difficulty]);
  return pool[Math.floor(Math.random() * pool.length)]!.pit;
}

export function thinkMs(difficulty: Difficulty): number {
  return 220 + difficulty * 140;
}
