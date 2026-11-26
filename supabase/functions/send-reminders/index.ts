// Supabase Edge Function: sends the "wake up" pushes that are due. Run by pg_cron every 15 minutes (scripts/push.sql).
//
// A push from here carries NO content. It only wakes the phone; the service worker (public/sw.js) then builds the
// notification from the reminder list stored on that phone. So this function never sees titles, amounts or dates
// of bills, only which device to wake and when.
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with:  supabase functions deploy send-reminders --no-verify-jwt
// (it checks the x-cron-secret header itself instead).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { timingSafeEqual } from "node:crypto";

/** Wakes later than this after their time are skipped (e.g. the sender was down), so a stale reminder never arrives. */
const MAX_LATE_MS = 6 * 60 * 60 * 1000;
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;

/** Compares two secrets without leaking, through timing, how much of a guess was right. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

/**
 * Only real browser push services are ever contacted (the database enforces this too). A saved address pointing
 * anywhere else is skipped, so a device record can't make this function call arbitrary servers.
 */
function isPushService(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "fcm.googleapis.com" ||
      h === "updates.push.services.mozilla.com" ||
      h === "push.apple.com" || h.endsWith(".push.apple.com") ||
      h === "notify.windows.com" || h.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

const fail = (what: string, detail?: unknown) => {
  // Details go to the function logs (visible only to you), never back to whoever called.
  console.error(what, detail);
  return new Response("Server error", { status: 500 });
};

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secret || secret.length < 20 || !(await sameSecret(req.headers.get("x-cron-secret") ?? "", secret))) {
    return new Response("Forbidden", { status: 403 });
  }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !subject) return fail("Missing VAPID secrets");
  webpush.setVapidDetails(subject, pub, priv);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = Date.now();

  // Tidy up old rows.
  await sb.from("push_wakes").delete().lt("fire_at", new Date(now - KEEP_MS).toISOString());

  // Claim what is due in one step (marking it sent) so two overlapping runs can't send the same wake twice.
  const { data: claimed, error } = await sb
    .from("push_wakes")
    .update({ sent: true })
    .eq("sent", false)
    .lte("fire_at", new Date(now).toISOString())
    .gte("fire_at", new Date(now - MAX_LATE_MS).toISOString())
    .select("device_id");
  if (error) return fail("claim failed", error.message);

  const ids = [...new Set((claimed ?? []).map((w) => w.device_id as string))];
  if (ids.length === 0) return Response.json({ sent: 0, removed: 0 });

  const { data: devices, error: devError } = await sb.from("push_devices").select("id, endpoint, p256dh, auth_key").in("id", ids);
  if (devError) return fail("load devices failed", devError.message);

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (devices ?? []).map(async (d) => {
      if (!isPushService(d.endpoint)) {
        gone.push(d.id); // not a real push service: forget it, never contact it
        return;
      }
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth_key } }, undefined, { TTL: 60 * 60, urgency: "normal", timeout: 10_000 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404 / 410: the phone no longer accepts pushes (app removed, permission revoked). Forget it.
        if (status === 404 || status === 410) gone.push(d.id);
      }
    }),
  );
  if (gone.length) await sb.from("push_devices").delete().in("id", gone);

  return Response.json({ sent, removed: gone.length });
});
