/**
 * A small built-in list of passwords people (and password-guessing scripts) try first. It is not a breach database,
 * but it stops the worst choices. Nothing is sent anywhere: the check runs in the browser.
 */
const COMMON = new Set([
  "password", "passw0rd", "p@ssw0rd", "p@ssword", "pass1234", "password1", "admin", "admin123", "administrator", "welcome", "welcome1", "login", "letmein",
  "qwerty", "qwertyui", "qwertyuiop", "qwerty123", "asdfghjk", "asdfghjkl", "zxcvbnm", "azerty", "1q2w3e4r", "1qaz2wsx", "abc123", "abcd1234", "abcdefgh",
  "iloveyou", "iloveu", "ilovey0u", "loveyou", "mylove", "mahalkita", "mahal", "mahalko", "pilipinas", "philippines", "pinoy", "pinas", "maynila", "manila", "bayan",
  "kwenta", "kwenta123", "alki", "money", "monkey", "dragon", "master", "shadow", "sunshine", "princess", "superman", "batman", "football", "basketball", "baseball",
  "michael", "jordan", "jessica", "charlie", "freedom", "whatever", "trustno1", "starwars", "computer", "internet", "changeme", "secret", "default", "test1234", "testing",
  "gcash", "gcash123", "paymaya", "maya123", "bdo12345", "bpi12345", "cebuana", "jollibee",
]);

/** Letters only and lower case, with a short run of digits or symbols at the end removed ("Password123!" → "password"). */
function core(pw: string): string {
  return pw.toLowerCase().replace(/[\d!@#$%^&*._-]{1,4}$/, "");
}

/** Whether every character is the same, or the whole thing is a simple run like 12345678 / abcdefgh / 87654321. */
function isPattern(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  const codes = [...pw].map((c) => c.charCodeAt(0));
  if (codes.length < 6) return false;
  const step = codes[1] - codes[0];
  return Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === step);
}

/** True for passwords that are far too easy to guess. */
export function isCommonPassword(pw: string): boolean {
  const p = pw.toLowerCase();
  return COMMON.has(p) || COMMON.has(core(pw)) || isPattern(p) || /^\d{1,}$/.test(pw) || /^(\d{2,4})\1+$/.test(pw);
}

export const COMMON_PASSWORD_MESSAGE = "That password is too easy to guess. Please choose a less common one.";
