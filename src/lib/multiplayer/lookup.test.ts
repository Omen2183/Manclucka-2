import assert from "node:assert/strict";
import { test } from "node:test";
import { isFlockCode, lookupErrorCopy, lookupFlock, normalizeFlockCode } from "./lookup.ts";

test("flock codes are six alphanumerics", () => {
  assert.equal(normalizeFlockCode("ab cd!ef"), "ABCDEF");
  assert.equal(isFlockCode("ABCDEF"), true);
  assert.equal(isFlockCode("ABC"), false);
});

test("lookup treats empty rooms as missing, not a hang", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ exists: false, peers: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const result = await lookupFlock("ABCDEF", 1000, fetchImpl as typeof fetch);
  assert.deepEqual(result, { ok: true, exists: false, peers: 0 });
});

test("lookup times out instead of waiting forever", async () => {
  const fetchImpl = (_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new DOMException("Aborted", "AbortError");
        reject(err);
      });
    });
  const result = await lookupFlock("ABCDEF", 30, fetchImpl as typeof fetch);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "timeout");
});

test("missing-code copy is inline-ready", () => {
  assert.match(lookupErrorCopy("missing"), /flock/i);
});
