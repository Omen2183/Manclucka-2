import assert from "node:assert/strict";
import { test } from "node:test";
import { initialState } from "../game/engine.ts";
import { parseMatchSnapshot } from "./persist.ts";

test("rejects expired or finished snapshots", () => {
  const board = initialState("classic");
  assert.equal(
    parseMatchSnapshot({
      v: 1,
      savedAt: Date.now(),
      phase: "play",
      gate: "over",
      settings: { mode: "solo", rules: "classic", bestOf: 3, difficulty: 3, playerName: "A", friendName: "B" },
      names: ["A", "B"],
      south: 0,
      scores: [0, 0],
      gameIndex: 0,
      lastWinner: null,
      lastCoops: [0, 0],
      board,
      host: true,
      room: null,
    }),
    null,
  );
});

test("keeps a live solo board", () => {
  const board = initialState("classic");
  board.pits[0] = 0;
  board.pits[1] = 5;
  const snap = parseMatchSnapshot({
    v: 1,
    savedAt: Date.now(),
    phase: "play",
    gate: "play",
    settings: { mode: "solo", rules: "classic", bestOf: 3, difficulty: 2, playerName: "Keeper", friendName: "Friend" },
    names: ["Keeper", "Thatch"],
    south: 0,
    scores: [1, 0],
    gameIndex: 1,
    lastWinner: 0,
    lastCoops: [24, 12],
    board,
    host: true,
    room: null,
  });
  assert.ok(snap);
  assert.equal(snap?.names[0], "You");
  assert.equal(snap?.names[1], "Thatch");
  assert.equal(snap?.settings.playerName, "You");
  assert.equal(snap?.board.pits[1], 5);
  assert.equal(snap?.scores[0], 1);
});

test("settles a stuck classic snapshot that never marked ended", () => {
  const board = initialState("classic");
  board.pits = [0, 0, 0, 0, 0, 0, 10, 2, 0, 0, 0, 0, 0, 8];
  const snap = parseMatchSnapshot({
    v: 1,
    savedAt: Date.now(),
    phase: "play",
    gate: "play",
    settings: { mode: "solo", rules: "classic", bestOf: 3, difficulty: 3, playerName: "A", friendName: "B" },
    names: ["A", "B"],
    south: 0,
    scores: [0, 0],
    gameIndex: 0,
    lastWinner: null,
    lastCoops: [0, 0],
    board,
    host: true,
    room: null,
  });
  assert.ok(snap);
  assert.equal(snap?.board.ended, true);
  assert.equal(snap?.board.pits[6], 10);
  assert.equal(snap?.board.pits[13], 10);
});

test("rejects a series that already has a winner", () => {
  const board = initialState("classic");
  assert.equal(
    parseMatchSnapshot({
      v: 1,
      savedAt: Date.now(),
      phase: "play",
      gate: "play",
      settings: { mode: "solo", rules: "classic", bestOf: 3, difficulty: 3, playerName: "A", friendName: "B" },
      names: ["A", "B"],
      south: 0,
      scores: [2, 0],
      gameIndex: 2,
      lastWinner: 0,
      lastCoops: [24, 12],
      board,
      host: true,
      room: null,
    }),
    null,
  );
});
