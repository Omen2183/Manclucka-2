import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseAiMove } from "./ai.ts";
import { initialState, isLegal, legalPits, tryMove } from "./engine.ts";
import type { GameState } from "./types.ts";

test("AI always returns a legal pit", () => {
  for (const difficulty of [1, 2, 3, 4, 5] as const) {
    let state = initialState("classic");
    for (let i = 0; i < 12 && !state.ended; i++) {
      const pit = chooseAiMove(state, difficulty);
      if (pit == null) {
        assert.equal(legalPits(state).length, 0);
        break;
      }
      assert.equal(isLegal(state, pit), true);
      const result = tryMove(state, pit);
      assert.ok(result);
      state = result.state;
    }
  }
});

test("search does not mutate the board", () => {
  const start = initialState("classic");
  const before = start.pits.slice();
  chooseAiMove(start, 5);
  assert.deepEqual(start.pits, before);
  assert.equal(start.ended, false);
});

test("ended games return null", () => {
  const ended = initialState("classic");
  ended.ended = true;
  ended.winner = 0;
  assert.equal(chooseAiMove(ended, 5), null);
});

test("until-empty gathering only sows the far side", () => {
  const state: GameState = {
    pits: [0, 0, 0, 0, 0, 0, 12, 4, 4, 0, 0, 0, 0, 8],
    turn: 0,
    ended: false,
    winner: null,
    rules: "until-empty",
  };
  const pit = chooseAiMove(state, 4);
  assert.ok(pit != null);
  assert.equal(legalPits(state).includes(pit!), true);
  assert.ok(pit === 7 || pit === 8);
});
