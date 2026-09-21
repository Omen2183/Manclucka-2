import { legalPits, otherPlayer, scoreOf, sideSum, tryMove } from "./engine.ts";
import { clampDifficulty, type Difficulty, type GameState, type Player } from "./types.ts";

type Profile = {
  depth: number;
  blunder: number;
  jitter: number;
  takeWin: boolean;
};

const PROFILES: Record<Difficulty, Profile> = {
  1: { depth: 0, blunder: 1, jitter: 99, takeWin: false },
  1.5: { depth: 0, blunder: 0.9, jitter: 8, takeWin: false },
  2: { depth: 0, blunder: 0.8, jitter: 6, takeWin: false },
  2.5: { depth: 0, blunder: 0.58, jitter: 5, takeWin: false },
  3: { depth: 0, blunder: 0.38, jitter: 4, takeWin: false },
  3.5: { depth: 1, blunder: 0.26, jitter: 14, takeWin: false },
  4: { depth: 2, blunder: 0.16, jitter: 8, takeWin: true },
  4.5: { depth: 2, blunder: 0.1, jitter: 5, takeWin: true },
  5: { depth: 3, blunder: 0.06, jitter: 3, takeWin: true },
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
  if (state.turn === me) value += 16;
  if (state.rules === "first-empty") {
    const mine = sideSum(state.pits, me);
    const theirs = sideSum(state.pits, opp);
    value += mine === 0 ? 80 : Math.max(0, 18 - mine) * 2;
    value -= theirs === 0 ? 80 : Math.max(0, 18 - theirs) * 2;
  }
  if (state.rules === "until-empty") {
    if (sideSum(state.pits, me) === 0 && sideSum(state.pits, opp) > 0) value += 24;
  }
  return value;
}

function greedyScore(state: GameState, pit: number): number {
  const result = tryMove(state, pit);
  if (!result) return Number.NEGATIVE_INFINITY;
  let score = scoreOf(result.state, state.turn) - scoreOf(state, state.turn);
  if (result.extraTurn) score += 5;
  if (result.capture) score += 2 + result.capture.amount;
  if (result.state.ended && result.state.winner === state.turn) score += 40;
  return score;
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

function pickFrom(ranked: { pit: number; score: number }[], jitter: number, fallback: number[]): number {
  if (ranked.length === 0) return pickRandom(fallback);
  let best = Number.NEGATIVE_INFINITY;
  for (const row of ranked) if (row.score > best) best = row.score;
  const pool = ranked.filter((r) => r.score >= best - jitter);
  return pool[Math.floor(Math.random() * pool.length)]!.pit;
}

export function chooseAiMove(state: GameState, difficulty: Difficulty): number | null {
  const moves = legalPits(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]!;

  const profile = PROFILES[clampDifficulty(difficulty)];

  if (profile.takeWin) {
    const winning = moves.find((pit) => {
      const result = tryMove(state, pit);
      return result?.state.ended && result.state.winner === state.turn;
    });
    if (winning != null) return winning;
  }

  if (Math.random() < profile.blunder) return pickRandom(moves);

  if (profile.depth <= 0) {
    return pickFrom(
      moves.map((pit) => ({ pit, score: greedyScore(state, pit) })),
      profile.jitter,
      moves,
    );
  }

  let bestScore = -Infinity;
  const ranked: { pit: number; score: number }[] = [];
  const nodes = { n: 0 };

  for (const pit of orderMoves(state, moves)) {
    const result = tryMove(state, pit);
    if (!result) continue;
    const score = minimax(result.state, profile.depth - 1, -Infinity, Infinity, state.turn, nodes);
    ranked.push({ pit, score });
    if (score > bestScore) bestScore = score;
    if (nodes.n > NODE_CAP) break;
  }

  return pickFrom(ranked, profile.jitter, moves);
}

export function thinkMs(difficulty: Difficulty): number {
  return 90 + clampDifficulty(difficulty) * 70;
}
