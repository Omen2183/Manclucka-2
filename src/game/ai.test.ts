import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseAiMove } from "./ai.ts";
import { initialState, isLegal, legalPits, tryMove } from "./engine.ts";

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
