import { test } from "node:test";
import assert from "node:assert/strict";
import { isCommonPassword } from "./passwords";

test("easy-to-guess passwords are refused", () => {
  for (const p of ["password", "Password123", "PASSWORD1!", "qwerty123", "iloveyou", "Kwenta123", "12345678", "87654321", "abcdefgh", "aaaaaaaa", "00000000", "12341234", "Pilipinas2024"]) {
    assert.equal(isCommonPassword(p), true, p);
  }
});

test("ordinary good passwords are accepted", () => {
  for (const p of ["blue-Mango-sunrise-42", "T9#kLm2$vQ", "ang aso ni lola 77", "correct horse battery"]) {
    assert.equal(isCommonPassword(p), false, p);
  }
});
