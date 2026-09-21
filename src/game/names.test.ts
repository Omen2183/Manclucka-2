import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFFICULTY_LABELS, difficultyBlurb, difficultyLabel, displayCallsHome, displayLeftovers, displayTakes, OPPONENT_NAMES, pickOpponentName, yardBrief } from "./names.ts";
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

test("keeper copy stays grammatical when the coop says You", () => {
  assert.equal(displayTakes("You", "the game"), "You take the game");
  assert.equal(displayTakes("Goldie", "the game"), "Goldie takes the game");
  assert.equal(displayCallsHome("You", 8), "You call 8 home");
  assert.equal(displayCallsHome("Thatch", 8), "Thatch calls 8 home");
  assert.equal(displayLeftovers("You", true), "You claim the leftover flock");
  assert.equal(displayLeftovers("Pearl", false), "Pearl takes the leftover flock");
});

test("yard brief names the match before you start", () => {
  assert.equal(
    yardBrief({
      you: "",
      rival: "",
      mode: "solo",
      difficulty: 2,
      rules: "classic",
      bestOf: 3,
    }),
    "You vs a surprise hen · Pullet · Classic Kalah · best of 3",
  );
  assert.equal(
    yardBrief({
      you: "Josh",
      rival: "Thatch",
      mode: "hotseat",
      difficulty: 3,
      rules: "first-empty",
      bestOf: 1,
    }),
    "Josh vs Thatch · First empty · one game",
  );
});
