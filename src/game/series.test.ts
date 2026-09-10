import assert from "node:assert/strict";
import { test } from "node:test";
import { emptySeries, seriesNeed, tallyGame } from "./series.ts";

test("best-of-3 needs two wins", () => {
  assert.equal(seriesNeed(3), 2);
  let s = emptySeries();
  s = tallyGame(s.scores, 0, 2);
  assert.equal(s.gate, "between");
  assert.equal(s.seriesWinner, null);
  s = tallyGame(s.scores, 0, 2);
  assert.equal(s.gate, "over");
  assert.equal(s.seriesWinner, 0);
  assert.deepEqual(s.scores, [2, 0]);
});

test("player 1 can take the series", () => {
  const s = tallyGame([0, 1], 1, 2);
  assert.equal(s.gate, "over");
  assert.equal(s.seriesWinner, 1);
  assert.deepEqual(s.scores, [0, 2]);
});

test("draws do not advance the series", () => {
  const s = tallyGame([1, 1], "draw", 2);
  assert.deepEqual(s.scores, [1, 1]);
  assert.equal(s.gate, "between");
  assert.equal(s.seriesWinner, null);
});

test("best-of-1 draw ends the series even", () => {
  const s = tallyGame([0, 0], "draw", 1);
  assert.deepEqual(s.scores, [0, 0]);
  assert.equal(s.gate, "over");
  assert.equal(s.seriesWinner, null);
});

test("best-of-1 win ends immediately", () => {
  assert.equal(seriesNeed(1), 1);
  const s = tallyGame([0, 0], 0, 1);
  assert.equal(s.gate, "over");
  assert.equal(s.seriesWinner, 0);
});

test("2-1 finish on best-of-3", () => {
  const s = tallyGame([1, 1], 0, 2);
  assert.equal(s.gate, "over");
  assert.equal(s.seriesWinner, 0);
  assert.deepEqual(s.scores, [2, 1]);
});
