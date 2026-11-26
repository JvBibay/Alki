import type { State } from "./types";
import { isSealed, openWithPassword, sealWithPassword } from "./crypto";
import { normalize } from "./store";
import { getSupabase } from "./supabase";

/**
 * Cloud backup. The whole state is encrypted in the browser (AES-256-GCM, key from the sync
 * passphrase) before upload, so Supabase only ever stores ciphertext. The passphrase is never sent.
 *
 * Saves are optimistic: an update only goes through if the cloud copy is still the one this device
 * last saw (matched by its updated_at). Otherwise another device saved first, and we raise a
 * ConflictError instead of overwriting it.
 */

export class ConflictError extends Error {
  constructor() {
    super("A newer backup from another device is in the cloud.");
    this.name = "ConflictError";
  }
}

function db() {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync isn’t set up.");
  return sb;
}

export async function currentUserId() {
  const { data, error } = await db().auth.getSession();
  if (error || !data.session) throw new Error("Please sign in first.");
  return data.session.user.id;
}

/** 42501 = the database refused because there is no active plan. */
const saveError = (e: { code?: string; message: string }) => (e.code === "42501" ? "Cloud backup needs an active plan. See Plans in Cloud backup." : e.message);

/**
 * Encrypts the data and stores it as this account's snapshot. Returns the new save time.
 * `expectedAt` is the cloud time this device last saw (null = it has never seen one).
 * Pass "force" to overwrite whatever is there.
 */
export async function pushSnapshot(state: State, passphrase: string, expectedAt: string | null | "force"): Promise<string> {
  const user_id = await currentUserId();
  const box = await sealWithPassword(passphrase, JSON.stringify(state));
  const updated_at = new Date().toISOString();
  const expect = expectedAt === "force" ? await snapshotTime() : expectedAt;

  if (expect === null) {
    const { data, error } = await db().from("snapshots").insert({ user_id, data: box, updated_at }).select("updated_at").single();
    if (error) {
      if (error.code === "23505") throw new ConflictError(); // a snapshot already exists
      throw new Error(saveError(error));
    }
    return data.updated_at;
  }

  const { data, error } = await db().from("snapshots").update({ data: box, updated_at }).eq("user_id", user_id).eq("updated_at", expect).select("updated_at");
  if (error) throw new Error(saveError(error));
  if (!data || data.length === 0) throw new ConflictError();
  return data[0].updated_at;
}

/** When this account's snapshot was last saved, or null if there isn't one. */
export async function snapshotTime(): Promise<string | null> {
  const user_id = await currentUserId();
  const { data, error } = await db().from("snapshots").select("updated_at").eq("user_id", user_id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.updated_at ?? null;
}

/** Deletes this account's cloud backup (the account itself stays). */
export async function deleteSnapshot(): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await db().from("snapshots").delete().eq("user_id", user_id);
  if (error) throw new Error(error.message);
}

async function fetchSealed() {
  const user_id = await currentUserId();
  const { data, error } = await db().from("snapshots").select("data, updated_at").eq("user_id", user_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (data && !isSealed(data.data)) throw new Error("The cloud backup is in an unknown format.");
  return data as { data: Parameters<typeof openWithPassword>[1]; updated_at: string } | null;
}

/**
 * Checks a passphrase against the existing cloud backup. Returns true if there's none yet (any
 * passphrase can start one) or it opens it; false if it's wrong. Stops a typo from ever
 * overwriting a good backup with one nobody can open.
 */
export async function passphraseWorks(passphrase: string): Promise<boolean> {
  const row = await fetchSealed();
  if (!row) return true;
  try {
    await openWithPassword(passphrase, row.data);
    return true;
  } catch {
    return false;
  }
}

/** Downloads and decrypts the snapshot, with the cloud time it came from. */
export async function pullSnapshot(passphrase: string): Promise<{ state: State; updatedAt: string }> {
  const row = await fetchSealed();
  if (!row) throw new Error("There’s no cloud backup for this account yet.");
  let text: string;
  try {
    text = await openWithPassword(passphrase, row.data);
  } catch {
    throw new Error("Wrong sync passphrase, or the backup is damaged.");
  }
  const next = normalize(JSON.parse(text));
  if (!next) throw new Error("The cloud backup couldn’t be read.");
  return { state: next, updatedAt: row.updated_at };
}
