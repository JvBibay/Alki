import { currentUserId } from "./cloud";
import { cloudConfigured, getSupabase } from "./supabase";
import { assertUploadable } from "./upload";

/**
 * Feedback goes to the Supabase `feedback` table (insert-only for users, see scripts/feedback.sql).
 * It is plain text, NOT end-to-end encrypted, and never includes any budget data.
 */

export type FeedbackKind = "idea" | "problem" | "praise";
export interface FeedbackItem {
  kind: FeedbackKind;
  message: string;
  /** 1 (unhappy) to 3 (loving it), from Alki's check-in. */
  rating?: number;
  contactOk: boolean;
  /** May be shown publicly (after you approve it), with the name masked. */
  publicOk?: boolean;
  /** Name from Settings; only sent when publicOk. The public view shows just its first letter. */
  name?: string;
  /** Which screen it was sent from. */
  screen: string;
  at: number;
  /** Optional screenshot: its path in the private `feedback-files` bucket (set once uploaded). */
  attachment?: string;
}

export const MAX_FEEDBACK = 1000;
const QUEUE = "kwenta-fb-queue";
const META = "kwenta-fb";
const DAY = 86_400_000;

export const feedbackAvailable = () => cloudConfigured();

/** Trims, caps the length and rejects an empty message. */
export function cleanMessage(raw: string): string | null {
  const m = raw.replace(/\s+/g, " ").trim().slice(0, MAX_FEEDBACK);
  return m.length >= 3 ? m : null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: the prompt just won't remember */
  }
}

export const queued = () => read<FeedbackItem[]>(QUEUE, []);

async function insert(item: FeedbackItem) {
  const sb = getSupabase();
  if (!sb) throw new Error("Feedback isn’t set up.");
  const user_id = await currentUserId();
  const { error } = await sb.from("feedback").insert({
    user_id,
    kind: item.kind,
    message: item.message,
    rating: item.rating ?? null,
    contact_ok: item.contactOk,
    public_ok: !!item.publicOk,
    display_name: item.publicOk && item.name ? item.name.slice(0, 30) : null,
    screen: item.screen.slice(0, 40),
    // Only sent when there is one, so feedback keeps working before the optional SQL has been run.
    ...(item.attachment ? { attachment: item.attachment } : {}),
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || "web",
    created_at: new Date(item.at).toISOString(),
  });
  if (error) throw new Error(error.message);
}

const offline = (e: unknown) => typeof navigator !== "undefined" && !navigator.onLine || (e instanceof TypeError && /fetch|network/i.test(e.message));

export const FEEDBACK_BUCKET = "feedback-files";

/** Uploads a screenshot (already shrunk to a JPEG) into the sender's own folder and returns its path. */
export async function uploadAttachment(blob: Blob): Promise<string> {
  await assertUploadable(blob);
  const sb = getSupabase();
  if (!sb) throw new Error("Feedback isn’t set up.");
  const uid = await currentUserId();
  const path = `${uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(FEEDBACK_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Sends feedback, with an optional screenshot. If the phone is offline the text is kept and sent later
 * (the screenshot isn't kept offline, it's too big). Returns "sent" or "queued".
 */
export async function sendFeedback(item: FeedbackItem, file?: Blob): Promise<"sent" | "queued"> {
  try {
    const attachment = file ? await uploadAttachment(file) : undefined;
    await insert({ ...item, attachment });
    return "sent";
  } catch (e) {
    if (offline(e)) {
      write(QUEUE, [...queued(), { ...item, attachment: undefined }].slice(-10));
      return "queued";
    }
    throw e;
  }
}

/** Sends anything saved while offline. Safe to call often. */
export async function flushFeedback() {
  const list = queued();
  if (!list.length) return;
  const left: FeedbackItem[] = [];
  for (const item of list) {
    try {
      await insert(item);
    } catch {
      left.push(item); // offline or signed out: keep it for next time
    }
  }
  write(QUEUE, left);
}

// ---------------- Alki's check-in ----------------

export interface FeedbackMeta {
  /** First time the app was opened on this device. */
  first: number;
  /** Rated or dismissed for good. */
  done?: boolean;
  /** Don't ask again before this time. */
  snooze?: number;
}

export const feedbackMeta = (now = Date.now()): FeedbackMeta => {
  const m = read<FeedbackMeta | null>(META, null);
  if (m && typeof m.first === "number") return m;
  const fresh = { first: now };
  write(META, fresh);
  return fresh;
};
export const saveFeedbackMeta = (m: FeedbackMeta) => write(META, m);

/** Ask once someone has really used the app: a week in and at least 10 entries. */
export function askDue(meta: FeedbackMeta, entries: number, now = Date.now()): boolean {
  if (meta.done) return false;
  if (meta.snooze && now < meta.snooze) return false;
  return now - meta.first >= 7 * DAY && entries >= 10;
}

/** "Not now" waits two weeks. */
export const snoozeFor = (now = Date.now()) => now + 14 * DAY;
