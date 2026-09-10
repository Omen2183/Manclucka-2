import {
  PIT_COUNT,
  SEEDS_PER_PIT,
  type GameState,
  type MoveResult,
  type Player,
  type RuleSet,
  type Winner,
} from "./types.ts";

const YARDS: Record<Player, readonly number[]> = {
  0: Object.freeze([0, 1, 2, 3, 4, 5]),
  1: Object.freeze([7, 8, 9, 10, 11, 12]),
};

const STORE: Record<Player, number> = { 0: 6, 1: 13 };

export function storeOf(player: Player): number {
  return STORE[player];
}

export function pitsOf(player: Player): number[] {
  return YARDS[player].slice();
}

export function isStore(index: number): boolean {
  return index === STORE[0] || index === STORE[1];
}

export function isYard(index: number): boolean {
  return index >= 0 && index < PIT_COUNT && !isStore(index);
}

export function isOwnPit(player: Player, index: number): boolean {
  return index >= YARDS[player][0]! && index <= YARDS[player][5]!;
}

export function oppositePit(index: number): number {
  if (!isYard(index)) return -1;
  return PIT_COUNT - 2 - index;
}

export function otherPlayer(player: Player): Player {
  return player === 0 ? 1 : 0;
}

export function openerOf(gameIndex: number): Player {
  const n = Number.isFinite(gameIndex) ? Math.max(0, Math.trunc(gameIndex)) : 0;
  return (n % 2 === 0 ? 0 : 1) as Player;
}

export function sideSum(pits: readonly number[], player: Player): number {
  let sum = 0;
  for (const i of YARDS[player]) sum += pits[i]!;
  return sum;
}

export function flockCount(pits: readonly number[]): number {
  let sum = 0;
  for (const n of pits) sum += n;
  return sum;
}

export function scoreOf(state: GameState, player: Player): number {
  return state.pits[STORE[player]]!;
}

export function cloneState(state: GameState): GameState {
  return {
    pits: state.pits.slice(),
    turn: state.turn,
    ended: state.ended,
    winner: state.winner,
    rules: state.rules,
  };
}

export function initialState(rules: RuleSet, first: Player = 0): GameState {
  const pits = Array.from({ length: PIT_COUNT }, (_, i) => (isStore(i) ? 0 : SEEDS_PER_PIT));
  return { pits, turn: first, ended: false, winner: null, rules };
}

export function legalPits(state: GameState): number[] {
  if (state.ended) return [];
  const own = YARDS[state.turn].filter((i) => Number.isInteger(state.pits[i]) && state.pits[i]! > 0);
  if (own.length > 0) return own;
  if (state.rules === "until-empty") {
    return YARDS[otherPlayer(state.turn)].filter((i) => Number.isInteger(state.pits[i]) && state.pits[i]! > 0);
  }
  return [];
}

export function isLegal(state: GameState, pit: number): boolean {
  return legalPits(state).includes(pit);
}

function nextDrop(cursor: number, skipStore: number): number {
  let i = cursor;
  do {
    i = (i + 1) % PIT_COUNT;
  } while (i === skipStore);
  return i;
}

function collectRemaining(pits: number[], into: Player): void {
  const dest = STORE[into];
  for (const player of [0, 1] as const) {
    for (const i of YARDS[player]) {
      pits[dest]! += pits[i]!;
      pits[i] = 0;
    }
  }
}

function decideWinner(pits: readonly number[]): Winner {
  const a = pits[STORE[0]]!;
  const b = pits[STORE[1]]!;
  if (a > b) return 0;
  if (b > a) return 1;
  return "draw";
}

function finish(state: GameState, emptiedSide: Player | null): Player | null {
  state.ended = true;
  state.winner = decideWinner(state.pits);
  return emptiedSide;
}

function maybeEnd(state: GameState, mover: Player): Player | null {
  const other = otherPlayer(mover);
  const moverEmpty = sideSum(state.pits, mover) === 0;
  const otherEmpty = sideSum(state.pits, other) === 0;

  if (state.rules === "until-empty") {
    return moverEmpty && otherEmpty ? finish(state, mover) : null;
  }

  if (!moverEmpty && !otherEmpty) return null;

  if (state.rules === "first-empty" && moverEmpty) {
    collectRemaining(state.pits, mover);
    return finish(state, mover);
  }

  if (moverEmpty) collectRemaining(state.pits, other);
  else collectRemaining(state.pits, mover);
  return finish(state, moverEmpty ? mover : other);
}

/** Mark a loaded/stuck board ended if nobody can sow. */
export function settleState(state: GameState): GameState {
  if (state.ended) return state;
  const next = cloneState(state);
  const s0 = sideSum(next.pits, 0);
  const s1 = sideSum(next.pits, 1);

  if (next.rules !== "until-empty" && (s0 === 0 || s1 === 0)) {
    if (s0 === 0 && s1 === 0) {
      finish(next, next.turn);
      return next;
    }
    if (next.rules === "first-empty") {
      const turnEmpty = (next.turn === 0 ? s0 : s1) === 0;
      const holder: Player = s0 > 0 ? 0 : 1;
      collectRemaining(next.pits, turnEmpty ? next.turn : holder);
      finish(next, turnEmpty ? next.turn : otherPlayer(holder));
      return next;
    }
    const holder: Player = s0 > 0 ? 0 : 1;
    collectRemaining(next.pits, holder);
    finish(next, otherPlayer(holder));
    return next;
  }

  if (legalPits(next).length > 0) return state;

  if (next.rules === "until-empty") {
    finish(next, next.turn);
    return next;
  }
  if (s0 === 0 && s1 === 0) {
    finish(next, next.turn);
    return next;
  }
  const holder: Player = s0 > 0 ? 0 : 1;
  collectRemaining(next.pits, holder);
  finish(next, otherPlayer(holder));
  return next;
}

export function leftoverHolder(rules: RuleSet, emptiedSide: Player, mover: Player): Player {
  if (rules === "first-empty" && emptiedSide === mover) return mover;
  return otherPlayer(emptiedSide);
}

export function tryMove(state: GameState, from: number): MoveResult | null {
  if (state.ended || !isYard(from) || !isLegal(state, from)) return null;

  const next = cloneState(state);
  const player = state.turn;
  const seeds = next.pits[from]!;
  if (!Number.isInteger(from) || !Number.isInteger(seeds) || seeds <= 0) return null;
  next.pits[from] = 0;

  const oppStore = STORE[otherPlayer(player)];
  const ownStore = STORE[player];
  const drops: number[] = [];
  let cursor = from;
  let remaining = seeds;
  while (remaining > 0) {
    cursor = nextDrop(cursor, oppStore);
    next.pits[cursor]! += 1;
    drops.push(cursor);
    remaining -= 1;
  }

  const last = drops[drops.length - 1];
  if (last == null) return null;

  let capture: MoveResult["capture"] = null;
  if (isOwnPit(player, last) && next.pits[last] === 1) {
    const opp = oppositePit(last);
    const stolen = next.pits[opp]!;
    if (stolen > 0 && isOwnPit(otherPlayer(player), opp)) {
      next.pits[last] = 0;
      next.pits[opp] = 0;
      next.pits[ownStore]! += stolen + 1;
      capture = { land: last, opposite: opp, amount: stolen + 1 };
    }
  }

  const emptiedSide = maybeEnd(next, player);
  const extraTurn = last === ownStore && !next.ended;

  if (!next.ended) {
    next.turn = extraTurn ? player : otherPlayer(player);
    if (legalPits(next).length === 0) {
      maybeEnd(next, player);
      if (!next.ended) {
        if (next.rules === "first-empty") {
          const emptier: Player = sideSum(next.pits, 0) === 0 ? 0 : 1;
          collectRemaining(next.pits, emptier);
          finish(next, emptier);
        } else {
          const holder: Player = sideSum(next.pits, 0) > 0 ? 0 : 1;
          collectRemaining(next.pits, holder);
          finish(next, otherPlayer(holder));
        }
      }
    }
  }

  return { from, drops, extraTurn, capture, emptiedSide, state: next };
}

export function winsNeeded(bestOf: 1 | 3 | 5 | 7): number {
  return Math.ceil(bestOf / 2);
}
