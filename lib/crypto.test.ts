import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveKey, isSealed, newSalt, open, openWithPassword, seal, sealWithPassword } from "./crypto";
import { protectedBox } from "./backup";

test("seal and open round-trip with the right PIN", async () => {
  const salt = newSalt();
  const key = await deriveKey("1234", salt);
  const box = await seal(key, salt, '{"txs":[{"note":"Lunch"}]}');
  assert.ok(isSealed(box));
  assert.ok(!box.ct.includes("Lunch"));
  assert.equal(await open(await deriveKey("1234", salt), box), '{"txs":[{"note":"Lunch"}]}');
});

test("wrong PIN is rejected", async () => {
  const salt = newSalt();
  const box = await seal(await deriveKey("1234", salt), salt, "secret");
  await assert.rejects(open(await deriveKey("0000", salt), box));
});

test("tampered data is rejected", async () => {
  const salt = newSalt();
  const key = await deriveKey("1234", salt);
  const box = await seal(key, salt, "secret");
  const bad = { ...box, ct: box.ct.slice(0, -4) + (box.ct.endsWith("AAAA") ? "BBBB" : "AAAA") };
  await assert.rejects(open(key, bad));
});

test("password-protected backup file round-trip", async () => {
  const enc = await sealWithPassword("hunter22", '{"accounts":[]}');
  const file = JSON.stringify({ kwenta: "backup", protected: true, enc });
  const box = protectedBox(file)!;
  assert.ok(box);
  assert.equal(await openWithPassword("hunter22", box), '{"accounts":[]}');
  await assert.rejects(openWithPassword("wrong", box));
  assert.equal(protectedBox('{"accounts":[],"txs":[]}'), null);
});
