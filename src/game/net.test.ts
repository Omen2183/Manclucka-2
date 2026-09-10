import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNetMessage } from "./net.ts";

test("accepts a well-formed move", () => {
  const msg = parseNetMessage({ type: "move", pit: 3, seq: 2 });
  assert.deepEqual(msg, { type: "move", pit: 3, seq: 2 });
});

test("rejects junk payloads", () => {
  assert.equal(parseNetMessage(null), null);
  assert.equal(parseNetMessage({ type: "move", pit: 1.5, seq: 1 }), null);
  assert.equal(parseNetMessage({ type: "hello" }), null);
  assert.equal(parseNetMessage({ type: "settings", settings: { rules: "kalah", bestOf: 3 } }), null);
});

test("clamps names on hello/start", () => {
  const hello = parseNetMessage({ type: "hello", name: "x".repeat(40) });
  assert.equal(hello?.type, "hello");
  if (hello?.type === "hello") assert.equal(hello.name.length, 24);
});

test("accepts rematch next of 0 and rejects negatives", () => {
  assert.deepEqual(parseNetMessage({ type: "next", gameIndex: 0 }), { type: "next", gameIndex: 0 });
  assert.equal(parseNetMessage({ type: "next", gameIndex: -1 }), null);
  assert.equal(parseNetMessage({ type: "next", gameIndex: 1.5 }), null);
});

test("parses forfeit and optional hello seq", () => {
  assert.deepEqual(parseNetMessage({ type: "forfeit", player: 1 }), { type: "forfeit", player: 1 });
  assert.equal(parseNetMessage({ type: "forfeit", player: 2 }), null);
  const hello = parseNetMessage({ type: "hello", name: "Josh", seq: 4 });
  assert.deepEqual(hello, { type: "hello", name: "Josh", seq: 4 });
});

test("strips Keeper from hello", () => {
  const hello = parseNetMessage({ type: "hello", name: "Keeper" });
  assert.equal(hello?.type, "hello");
  if (hello?.type === "hello") assert.equal(hello.name, "Friend");
});

test("parses a sync snapshot", () => {
  const pits = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : 4));
  const msg = parseNetMessage({
    type: "sync",
    seq: 3,
    gameIndex: 1,
    scores: [1, 0],
    gate: "play",
    pits,
    turn: 1,
    ended: false,
    winner: null,
    names: ["Josh", "Ashley"],
  });
  assert.ok(msg?.type === "sync");
  if (msg?.type === "sync") {
    assert.equal(msg.gameIndex, 1);
    assert.deepEqual(msg.names, ["Josh", "Ashley"]);
    assert.equal(msg.turn, 1);
  }
});

test("parses series-over sync and rejects fractional scores", () => {
  const pits = Array.from({ length: 14 }, () => 0);
  pits[6] = 24;
  pits[13] = 24;
  const msg = parseNetMessage({
    type: "sync",
    seq: 0,
    gameIndex: 2,
    scores: [2, 1],
    gate: "over",
    pits,
    turn: 0,
    ended: true,
    winner: 0,
  });
  assert.ok(msg?.type === "sync");
  if (msg?.type === "sync") assert.equal(msg.gate, "over");
  assert.equal(
    parseNetMessage({
      type: "sync",
      seq: 0,
      gameIndex: 0,
      scores: [1.5, 0],
      gate: "play",
      pits,
      turn: 0,
      ended: false,
      winner: null,
    }),
    null,
  );
});
