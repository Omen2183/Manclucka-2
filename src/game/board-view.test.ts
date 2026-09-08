import assert from "node:assert/strict";
import { test } from "node:test";
import { keyRow, northOrder, southOrder } from "./board-view.ts";

test("south stays pits 0-5 when player 0 sits near", () => {
  assert.deepEqual([...southOrder(0)], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...northOrder(0)], [12, 11, 10, 9, 8, 7]);
});

test("vs keys follow the acting side without flipping the board", () => {
  assert.deepEqual([...keyRow(0, 0, false)], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...keyRow(0, 1, false)], [12, 11, 10, 9, 8, 7]);
  assert.deepEqual([...keyRow(0, 0, true)], [12, 11, 10, 9, 8, 7]);
  assert.deepEqual([...keyRow(0, 1, true)], [0, 1, 2, 3, 4, 5]);
});
