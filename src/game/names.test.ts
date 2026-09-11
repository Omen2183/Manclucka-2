import assert from "node:assert/strict";
import { test } from "node:test";
import { OPPONENT_NAMES, pickOpponentName } from "./names.ts";

test("pickOpponentName stays in the flock and skips excludes", () => {
  for (let i = 0; i < 40; i++) {
    const name = pickOpponentName("Thatch", "Goldie");
    assert.ok((OPPONENT_NAMES as readonly string[]).includes(name));
    assert.notEqual(name, "Thatch");
    assert.notEqual(name, "Goldie");
  }
});
