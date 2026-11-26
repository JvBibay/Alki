import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CARD_ARTS } from "./cards.generated";
import { accountCard, cardsFor, getCardArt } from "./cardart";
import { getInst } from "./institutions";

test("every card picture exists and belongs to a known credit card issuer", () => {
  assert.ok(CARD_ARTS.length > 0);
  for (const c of CARD_ARTS) {
    assert.ok(existsSync(join("public", "cards", `${c.id}.webp`)), `missing picture for ${c.id}`);
    const inst = getInst(c.bank);
    // Bank credit cards, or a credit line with its own card (Maya Credit).
    assert.ok(inst && (inst.group === "credit" || inst.group === "bnpl"), `${c.id}: ${c.bank} is not a credit card issuer`);
  }
  assert.equal(new Set(CARD_ARTS.map((c) => c.id)).size, CARD_ARTS.length, "card ids are unique");
});

test("cards are found by issuer and only shown for credit accounts", () => {
  assert.ok(cardsFor("metrobank-cc").some((c) => c.id === "mb-world"));
  assert.deepEqual(cardsFor("gcash"), []);
  assert.equal(getCardArt("mb-world")?.net, "mastercard");
  assert.equal(accountCard({ kind: "credit", card: "mb-world" })?.id, "mb-world");
  assert.equal(accountCard({ kind: "bank", card: "mb-world" }), undefined);
  assert.equal(accountCard({ kind: "credit", card: "nope" }), undefined);
});
