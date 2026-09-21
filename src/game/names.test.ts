import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFFICULTY_LABELS, difficultyBlurb, difficultyLabel, OPPONENT_NAMES, pickOpponentName } from "./names.ts";
import { clampDifficulty } from "./types.ts";

test("pickOpponentName stays in the flock and skips excludes", () => {
  for (let i = 0; i < 40; i++) {
    const name = pickOpponentName("Thatch", "Goldie");
    assert.ok((OPPONENT_NAMES as readonly string[]).includes(name));
    assert.notEqual(name, "Thatch");
    assert.notEqual(name, "Goldie");
  }
});

test("difficulty snaps to half steps and names the rungs", () => {
  assert.equal(clampDifficulty(2.4), 2.5);
  assert.equal(clampDifficulty(0), 1);
  assert.equal(clampDifficulty(9), 5);
  assert.equal(clampDifficulty("3"), 3);
  assert.equal(difficultyLabel(2), "Pullet");
  assert.equal(difficultyLabel(2.5), "Pullet–Hen");
  assert.equal(difficultyLabel(3), "Hen");
  assert.equal(difficultyBlurb(2).includes("wandering"), true);
  assert.equal(DIFFICULTY_LABELS[3], "Hen");
});
