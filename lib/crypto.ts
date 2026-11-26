/**
 * Encryption for data at rest, using the browser's built-in Web Crypto.
 * A key is derived from the user's PIN or password with PBKDF2 (SHA-256, 310,000 rounds),
 * then data is sealed with AES-256-GCM. The PIN itself is never stored.
 */

export interface Sealed {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(secret: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(salt), iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, salt: string, plain: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return { v: 1, salt, iv: toB64(iv), ct: toB64(ct) };
}

/** Throws if the key is wrong or the data was tampered with. */
export async function open(key: CryptoKey, box: Sealed): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
  return dec.decode(pt);
}

export const isSealed = (x: unknown): x is Sealed =>
  !!x && typeof x === "object" && (x as Sealed).v === 1 && typeof (x as Sealed).ct === "string" && typeof (x as Sealed).salt === "string";

/** One-shot helpers for password-protected backups. */
export async function sealWithPassword(password: string, plain: string): Promise<Sealed> {
  const salt = newSalt();
  return seal(await deriveKey(password, salt), salt, plain);
}
export async function openWithPassword(password: string, box: Sealed): Promise<string> {
  return open(await deriveKey(password, box.salt), box);
}
