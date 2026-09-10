import assert from "node:assert/strict";
import { test } from "node:test";
import {
  flockCount,
  initialState,
  isLegal,
  legalPits,
  openerOf,
  pitsOf,
  scoreOf,
  settleState,
  sideSum,
  tryMove,
} from "./engine.ts";
import { STARTING_FLOCK, type GameState } from "./types.ts";

function stateWith(pits: number[], turn: 0 | 1 = 0, rules: GameState["rules"] = "classic"): GameState {
  return { pits: pits.slice(), turn, ended: false, winner: null, rules };
}

test("opening extra turn from pit 2", () => {
  const start = initialState("classic");
  const result = tryMove(start, 2);
  assert.ok(result);
  assert.equal(result.extraTurn, true);
  assert.deepEqual(result.drops, [3, 4, 5, 6]);
  assert.equal(result.state.turn, 0);
  assert.equal(scoreOf(result.state, 0), 1);
});

test("sowing skips the opponent coop", () => {
  const pits = [1, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = tryMove(stateWith(pits), 5);
  assert.ok(result);
  assert.equal(result.drops.includes(13), false);
  assert.equal(result.drops.at(-1), 0);
  assert.equal(result.state.pits[6], 1);
  assert.equal(result.state.pits[0], 2);
});

test("capture from a singleton into an empty own yard", () => {
  const pits = [3, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 2, 0];
  const result = tryMove(stateWith(pits), 4);
  assert.ok(result);
  assert.ok(result.capture);
  assert.equal(result.capture.amount, 4);
  assert.equal(scoreOf(result.state, 0), 4);
  assert.equal(result.state.pits[5], 0);
  assert.equal(result.state.pits[7], 0);
  assert.equal(result.state.ended, false);
});

test("no capture when opposite yard is empty", () => {
  const pits = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0];
  const result = tryMove(stateWith(pits), 4);
  assert.ok(result);
  assert.equal(result.capture, null);
  assert.equal(result.state.pits[5], 1);
});

test("classic: emptying your side gives leftovers to the opponent", () => {
  const pits = [0, 0, 0, 0, 0, 1, 10, 2, 0, 0, 0, 0, 0, 8];
  const result = tryMove(stateWith(pits, 0, "classic"), 5);
  assert.ok(result);
  assert.equal(result.state.ended, true);
  assert.equal(result.state.pits[6], 11);
  assert.equal(result.state.pits[13], 10);
  assert.equal(result.state.winner, 0);
});

test("first-empty: emptying your side claims the leftover flock", () => {
  const pits = [0, 0, 0, 0, 0, 1, 10, 2, 0, 0, 0, 0, 0, 8];
  const result = tryMove(stateWith(pits, 0, "first-empty"), 5);
  assert.ok(result);
  assert.equal(result.state.ended, true);
  assert.equal(result.state.pits[6], 13);
  assert.equal(result.state.pits[13], 8);
  assert.equal(result.state.winner, 0);
});

test("until-empty lets you gather from the other side", () => {
  const pits = [0, 0, 0, 0, 0, 0, 12, 4, 4, 0, 0, 0, 0, 8];
  const start = stateWith(pits, 0, "until-empty");
  assert.deepEqual(legalPits(start), [7, 8]);
  const result = tryMove(start, 7);
  assert.ok(result);
  assert.equal(result.state.ended, false);
  assert.equal(result.capture, null);
  assert.equal(sideSum(result.state.pits, 0), 0);
  assert.ok(legalPits(result.state).every((i) => pitsOf(1).includes(i)));
});

test("until-empty: both keepers take turns on the remaining side", () => {
  const pits = [0, 0, 0, 0, 0, 0, 10, 3, 2, 1, 0, 0, 0, 12];
  const p0 = tryMove(stateWith(pits, 0, "until-empty"), 7);
  assert.ok(p0);
  assert.equal(p0.state.ended, false);
  assert.equal(p0.state.turn, 1);
  const p1Legal = legalPits(p0.state);
  assert.ok(p1Legal.length > 0);
  assert.ok(p1Legal.every((i) => pitsOf(1).includes(i)));
  const p1 = tryMove(p0.state, p1Legal[0]!);
  assert.ok(p1);
  assert.equal(p1.state.ended, false);
  const p0Again = legalPits(p1.state);
  assert.ok(p0Again.length > 0);
  if (sideSum(p1.state.pits, 0) === 0) {
    assert.ok(p0Again.every((i) => pitsOf(1).includes(i)));
  }
});

test("until-empty: empty north can gather from south", () => {
  const pits = [2, 2, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 10];
  const start = stateWith(pits, 1, "until-empty");
  assert.deepEqual(legalPits(start), [0, 1]);
  const result = tryMove(start, 0);
  assert.ok(result);
  assert.equal(result.state.ended, false);
});

test("until-empty: the game only ends when every yard is bare", () => {
  const pits = [0, 0, 0, 0, 0, 1, 20, 0, 0, 0, 0, 0, 0, 7];
  const result = tryMove(stateWith(pits, 0, "until-empty"), 5);
  assert.ok(result);
  assert.equal(result.state.ended, true);
  assert.equal(sideSum(result.state.pits, 0), 0);
  assert.equal(sideSum(result.state.pits, 1), 0);
});

test("until-empty still captures into an empty own yard", () => {
  const pits = [0, 0, 0, 0, 1, 0, 10, 3, 0, 0, 0, 0, 2, 8];
  const result = tryMove(stateWith(pits, 0, "until-empty"), 4);
  assert.ok(result);
  assert.ok(result.capture);
  assert.equal(result.capture.amount, 4);
  assert.equal(scoreOf(result.state, 0), 14);
  assert.equal(result.state.ended, false);
});

test("rejects empty pits and stores", () => {
  const start = initialState("classic");
  assert.equal(isLegal(start, 6), false);
  const emptied = stateWith([0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(isLegal(emptied, 0), false);
  assert.equal(tryMove(emptied, 0), null);
});

test("every sow keeps all 48 chickens on the board", () => {
  let state = initialState("classic");
  assert.equal(flockCount(state.pits), STARTING_FLOCK);
  for (let i = 0; i < 40 && !state.ended; i++) {
    const moves = legalPits(state);
    if (moves.length === 0) break;
    const result = tryMove(state, moves[i % moves.length]!);
    assert.ok(result);
    assert.equal(flockCount(result.state.pits), STARTING_FLOCK);
    state = result.state;
  }
});

test("pitsOf returns a copy so callers cannot mutate the yard table", () => {
  const yards = pitsOf(0);
  yards.reverse();
  assert.deepEqual([...pitsOf(0)], [0, 1, 2, 3, 4, 5]);
  assert.equal(tryMove(initialState("classic"), 0)?.drops[0], 1);
});

test("openerOf alternates each game", () => {
  assert.equal(openerOf(0), 0);
  assert.equal(openerOf(1), 1);
  assert.equal(openerOf(2), 0);
  assert.equal(openerOf(-3), 0);
  assert.equal(openerOf(Number.NaN), 0);
});

test("player 1 extra turn from pit 9", () => {
  const result = tryMove(initialState("classic", 1), 9);
  assert.ok(result);
  assert.equal(result.extraTurn, true);
  assert.deepEqual(result.drops, [10, 11, 12, 13]);
  assert.equal(result.state.turn, 1);
});

test("tryMove does not mutate the input pits", () => {
  const start = initialState("classic");
  const before = start.pits.slice();
  tryMove(start, 0);
  assert.deepEqual(start.pits, before);
  assert.equal(start.turn, 0);
});

test("settleState ends a classic board that already has an empty side", () => {
  const stuck = stateWith([0, 0, 0, 0, 0, 0, 10, 2, 0, 0, 0, 0, 0, 8], 0, "classic");
  const settled = settleState(stuck);
  assert.equal(settled.ended, true);
  assert.equal(settled.pits[13], 10);
  assert.equal(settled.pits[6], 10);
  assert.equal(flockCount(settled.pits), 20);
  assert.equal(stuck.ended, false);
});

test("extra turn is cancelled when that sow empties the board", () => {
  const pits = [0, 0, 0, 0, 0, 1, 20, 0, 0, 0, 0, 0, 0, 7];
  const result = tryMove(stateWith(pits, 0, "classic"), 5);
  assert.ok(result);
  assert.equal(result.state.ended, true);
  assert.equal(result.extraTurn, false);
});

test("first-empty settle matches tryMove when a capture empties the other side", () => {
  const pits = [4, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 12];
  const stuck = stateWith(pits, 0, "first-empty");
  const settled = settleState(stuck);
  assert.equal(settled.ended, true);
  assert.equal(settled.pits[6], 14);
  assert.equal(settled.pits[13], 12);
  assert.equal(settled.winner, 0);
});

test("first-empty capture that empties the opponent still scoops to the mover", () => {
  const pits = [0, 0, 0, 0, 1, 0, 10, 3, 0, 0, 0, 0, 2, 8];
  const result = tryMove(stateWith(pits, 0, "first-empty"), 4);
  assert.ok(result);
  assert.ok(result.capture);
  assert.equal(result.state.ended, true);
  assert.equal(result.state.pits[6], 16);
  assert.equal(sideSum(result.state.pits, 0), 0);
  assert.equal(sideSum(result.state.pits, 1), 0);
});

test("until-empty extra turn is kept when the other side still has hens", () => {
  const pits = [0, 0, 0, 0, 0, 1, 10, 2, 0, 0, 0, 0, 0, 8];
  const result = tryMove(stateWith(pits, 0, "until-empty"), 5);
  assert.ok(result);
  assert.equal(result.state.ended, false);
  assert.equal(result.extraTurn, true);
  assert.ok(legalPits(result.state).every((i) => pitsOf(1).includes(i)));
});
