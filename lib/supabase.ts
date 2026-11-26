import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Whether the Supabase env vars are set. Without them, cloud sync is simply hidden. */
export const cloudConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Browser-only Supabase client (the session lives in localStorage). Call it once on app start so a
 * magic-link redirect (?code=…) is picked up and turned into a session.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined" || !cloudConfigured()) return null;
  if (client === undefined) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
