/**
 * Optional fingerprint (or device-lock) unlock, built on a passkey with the WebAuthn PRF extension.
 *
 * How it stays safe: the fingerprint never reaches Kwenta. The phone's secure hardware checks it and
 * then releases a secret (the PRF output) that only this passkey can produce. We use that secret
 * to encrypt the user's PIN, and store only the encrypted PIN here. Unlocking with a fingerprint
 * decrypts the PIN and hands it to the normal PIN unlock, so the data stays encrypted by the PIN
 * and nothing weaker is stored. If the phone or browser has no PRF support, we don't offer it.
 */

const KEY = "kwenta-bio";

interface Stored {
  id: string; // passkey credential id (base64url)
  salt: string; // PRF input (base64url)
  iv: string;
  ct: string; // the PIN, encrypted with the PRF output
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const toB64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.id === "string" && typeof v.salt === "string" && typeof v.iv === "string" && typeof v.ct === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Whether fingerprint unlock is turned on for this device. */
export const bioEnrolled = () => read() !== null;

/** Turns it off (also done whenever the PIN changes or is removed, since the stored PIN would be stale). */
export function clearBio() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Whether this phone has a built-in authenticator (fingerprint, face or screen lock) to use. */
export async function bioAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type PrfExt = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

/** Asks the phone to verify the user, and returns the secret tied to this passkey and salt. */
async function prfSecret(credId: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: credId }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const first = (assertion?.getClientExtensionResults() as PrfExt | undefined)?.prf?.results?.first;
  if (!first) throw new Error("NO_PRF");
  return crypto.subtle.importKey("raw", first, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Thrown when this phone or browser can't do fingerprint unlock securely. */
export class BioUnsupported extends Error {
  constructor() {
    super("This phone or browser doesn’t support secure fingerprint unlock yet.");
    this.name = "BioUnsupported";
  }
}

/** Creates the passkey (fingerprint prompt) and stores the PIN encrypted under it. The PIN must already be verified. */
export async function enrollBio(pin: string): Promise<void> {
  const salt = rand(32);
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: "Kwenta" },
        user: { id: rand(16), name: "kwenta", displayName: "Kwenta" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60_000,
        extensions: { prf: {} } as unknown as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) throw err; // user cancelled
    throw new BioUnsupported();
  }
  if (!cred) throw new BioUnsupported();
  if (!(cred.getClientExtensionResults() as PrfExt).prf?.enabled) throw new BioUnsupported();

  const id = new Uint8Array(cred.rawId.slice(0));
  const key = await prfSecret(id, salt).catch((e) => {
    if (e instanceof Error && e.message === "NO_PRF") throw new BioUnsupported();
    throw e;
  });
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(pin));
  localStorage.setItem(KEY, JSON.stringify({ id: toB64u(id), salt: toB64u(salt), iv: toB64u(iv), ct: toB64u(ct) } satisfies Stored));
}

/** Fingerprint prompt, then the PIN. Returns null if it was cancelled, failed, or isn't set up. */
export async function unlockWithBio(): Promise<string | null> {
  const s = read();
  if (!s) return null;
  try {
    const key = await prfSecret(fromB64u(s.id), fromB64u(s.salt));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64u(s.iv) }, key, fromB64u(s.ct));
    return dec.decode(pt);
  } catch {
    return null;
  }
}
