import { getSupabase } from "./supabase";

/**
 * "Get started" is first-run setup for a brand-new person. Settings live on the device, so on a new phone an
 * existing user would see it again. To prevent that, finishing it is also noted on the account (user metadata),
 * and a cloud backup counts as proof too.
 */

/** Has this account already been through setup somewhere? false when unknown (not signed in, offline). */
export async function accountOnboarded(): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return false;
    if ((user.user_metadata as { kwenta_onboarded?: unknown } | undefined)?.kwenta_onboarded === true) return true;
    // Older accounts have no marker yet: an existing cloud backup shows they have used Kwenta before.
    const { data: row } = await sb.from("snapshots").select("user_id").eq("user_id", user.id).maybeSingle();
    return !!row;
  } catch {
    return false;
  }
}

/** Remember on the account that setup is done, so other devices skip it. Safe to call offline (it just won't stick). */
export async function markAccountOnboarded(): Promise<void> {
  try {
    const sb = getSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    if (!sb || !data?.session) return;
    await sb.auth.updateUser({ data: { kwenta_onboarded: true } });
  } catch {
    /* not signed in or offline: this device still remembers it */
  }
}
