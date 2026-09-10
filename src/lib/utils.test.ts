import assert from "node:assert/strict";
import { test } from "node:test";
import { isLeakedDefaultName, loadName, migrateLeakedNames, otherKeep, trimName } from "./utils.ts";

test("trimName keeps a typed keeper name", () => {
  assert.equal(trimName("Josh", "You"), "Josh");
  assert.equal(trimName("  Goldie  ", "You"), "Goldie");
  assert.equal(trimName("", "You"), "You");
  assert.equal(trimName("   ", "Friend"), "Friend");
  assert.equal(trimName("a".repeat(40), "You").length, 24);
});

test("trimName rejects the leftover default Keeper", () => {
  assert.equal(trimName("Keeper", "You"), "You");
  assert.equal(trimName("keeper", "Friend"), "Friend");
});

test("otherKeep never leaves You on the far coop", () => {
  assert.equal(otherKeep("You"), "Friend");
  assert.equal(otherKeep("you", "Waffles"), "Waffles");
  assert.equal(otherKeep("Ashley"), "Ashley");
});

test("leaked sample names are the old placeholders", () => {
  assert.equal(isLeakedDefaultName("Josh"), true);
  assert.equal(isLeakedDefaultName(" joshua "), true);
  assert.equal(isLeakedDefaultName("Ashley"), true);
  assert.equal(isLeakedDefaultName("Thatch"), false);
  assert.equal(isLeakedDefaultName("You"), false);
});

test("migrateLeakedNames clears leftover Josh once", () => {
  const mem = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = { localStorage };
  mem.set("manclucka:name", "Josh");
  mem.set(
    "manclucka:settings",
    JSON.stringify({ mode: "hotseat", playerName: "Josh", friendName: "Ashley" }),
  );
  migrateLeakedNames();
  assert.equal(loadName(), "");
  const settings = JSON.parse(mem.get("manclucka:settings") ?? "{}") as { playerName: string; friendName: string };
  assert.equal(settings.playerName, "");
  assert.equal(settings.friendName, "");
  mem.set("manclucka:name", "Goldie");
  migrateLeakedNames();
  assert.equal(loadName(), "Goldie");
  delete (globalThis as { window?: unknown }).window;
});
