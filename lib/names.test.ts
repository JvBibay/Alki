import { test } from "node:test";
import assert from "node:assert/strict";
import { nameTaken } from "./names";

const list = [
  { id: "a", name: "GCash" },
  { id: "b", name: "BDO Savings" },
];

test("duplicate account names are found ignoring case and spacing", () => {
  assert.equal(nameTaken(list, "gcash"), true);
  assert.equal(nameTaken(list, "  BDO   savings "), true);
  assert.equal(nameTaken(list, "Maya"), false);
  assert.equal(nameTaken(list, ""), false);
});

test("renaming an account to its own name is fine", () => {
  assert.equal(nameTaken(list, "GCash", "a"), false);
  assert.equal(nameTaken(list, "GCash", "b"), true);
});
