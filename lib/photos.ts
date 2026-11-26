/**
 * Receipt photos, stored on the device in IndexedDB (not localStorage, which is too small).
 * Each photo is shrunk to at most 1280px, saved as JPEG, and encrypted with AES-GCM using a
 * random "photo key". That key lives inside the app data, so when the PIN lock is on it is
 * encrypted by the PIN too, and changing the PIN never requires re-encrypting photos.
 */

import { assertImage } from "./upload";

const DB = "kwenta-photos";
const STORE = "photos";

interface StoredPhoto {
  iv: ArrayBuffer;
  data: ArrayBuffer;
  type: string;
  created: number;
}

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** A new random 256-bit key, as base64. */
export function newPhotoKey(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

const importKey = (b64: string) => crypto.subtle.importKey("raw", fromB64(b64), "AES-GCM", false, ["encrypt", "decrypt"]);

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = run(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Shrinks an image file to at most `max` px on its longest side, as a JPEG blob. */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<Blob> {
  await assertImage(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn’t read that image."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t save that image."))), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Saves a photo and returns its id. */
export async function savePhoto(blob: Blob, keyB64: string): Promise<string> {
  const id = `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(keyB64), await blob.arrayBuffer());
  const rec: StoredPhoto = { iv: iv.buffer, data, type: blob.type || "image/jpeg", created: Date.now() };
  await tx("readwrite", (s) => s.put(rec, id));
  return id;
}

/** Loads a photo as an object URL (remember to revoke it), or null if missing. */
export async function loadPhoto(id: string, keyB64: string): Promise<string | null> {
  const rec = (await tx("readonly", (s) => s.get(id))) as StoredPhoto | undefined;
  if (!rec) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(rec.iv) }, await importKey(keyB64), rec.data);
  return URL.createObjectURL(new Blob([plain], { type: rec.type }));
}

export async function deletePhoto(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

/** Deletes photos no longer attached to any entry (run on startup, so Undo still works in-session). */
export async function cleanupPhotos(keep: Set<string>) {
  try {
    const keys = (await tx("readonly", (s) => s.getAllKeys())) as string[];
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => deletePhoto(k)));
  } catch {
    /* IndexedDB unavailable: nothing to clean */
  }
}

/** A photo as it travels in a backup: still encrypted, as base64 text. */
export interface PhotoExport {
  iv: string;
  data: string;
  type: string;
  created: number;
}

/** Base64 for big buffers (spreading a whole photo into fromCharCode overflows the stack). */
function bigToB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

/**
 * Reads photos for a backup. They stay encrypted with the photo key, which is in the backed-up
 * data, so a password-protected backup protects them too. Missing photos are skipped.
 */
export async function exportPhotos(ids: string[]): Promise<Record<string, PhotoExport>> {
  const out: Record<string, PhotoExport> = {};
  for (const id of new Set(ids)) {
    const rec = (await tx("readonly", (s) => s.get(id))) as StoredPhoto | undefined;
    if (rec) out[id] = { iv: bigToB64(rec.iv), data: bigToB64(rec.data), type: rec.type, created: rec.created };
  }
  return out;
}

/** Puts photos from a backup back on this device. Returns how many were restored. */
export async function importPhotos(photos: unknown): Promise<number> {
  if (!photos || typeof photos !== "object") return 0;
  let n = 0;
  for (const [id, p] of Object.entries(photos as Record<string, Partial<PhotoExport>>)) {
    if (!/^ph_[a-z0-9]+$/.test(id) || !p || typeof p.iv !== "string" || typeof p.data !== "string") continue;
    const rec: StoredPhoto = {
      iv: fromB64(p.iv).buffer,
      data: fromB64(p.data).buffer,
      type: typeof p.type === "string" && p.type.startsWith("image/") ? p.type : "image/jpeg",
      created: typeof p.created === "number" ? p.created : Date.now(),
    };
    await tx("readwrite", (s) => s.put(rec, id));
    n++;
  }
  return n;
}

/** Removes every photo (used by "Reset all data" / "Erase everything"). */
export async function clearPhotos() {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignore */
  }
}
