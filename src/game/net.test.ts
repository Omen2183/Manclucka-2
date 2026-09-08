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
