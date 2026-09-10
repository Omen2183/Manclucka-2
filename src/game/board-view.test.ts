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

test("guest sitting south keeps their own yards near", () => {
  assert.deepEqual([...southOrder(1)], [7, 8, 9, 10, 11, 12]);
  assert.deepEqual([...northOrder(1)], [5, 4, 3, 2, 1, 0]);
  assert.deepEqual([...keyRow(1, 1, false)], [7, 8, 9, 10, 11, 12]);
});
