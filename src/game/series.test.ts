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

test("draws do not advance the series", () => {
  const s = tallyGame([1, 1], "draw", 2);
  assert.deepEqual(s.scores, [1, 1]);
  assert.equal(s.gate, "between");
  assert.equal(s.seriesWinner, null);
});
