import { getSupabase } from "./supabase";
import { applyLook, CUSTOM_ID, isHex, PALETTES } from "./themes";
import type { Theme } from "./types";

/**
 * Keeps the chosen theme (light/dark/auto) and color palette with the account, so a new device
 * shows your choice as soon as you sign in. It isn't sensitive, so it's stored as plain account
 * metadata, which means it's available before the sync passphrase is entered.
 */

const THEMES: Theme[] = ["system", "light", "dark", "amoled"];

export interface ThemeChoice {
  theme: Theme;
  palette: string;
  custom?: string;
}

/** Reads a theme choice from account metadata, ignoring anything that isn't a known value. */
export function themeFromMetadata(meta: unknown): ThemeChoice | null {
  const m = (meta ?? {}) as { kwenta_theme?: unknown; kwenta_palette?: unknown; kwenta_custom?: unknown };
  const theme = THEMES.find((t) => t === m.kwenta_theme);
  if (m.kwenta_palette === CUSTOM_ID && isHex(m.kwenta_custom)) return theme ? { theme, palette: CUSTOM_ID, custom: m.kwenta_custom } : null;
  const palette = PALETTES.find((p) => p.id === m.kwenta_palette)?.id;
  return theme && palette ? { theme, palette } : null;
}

/** Applies a theme immediately (before the app has loaded its own data) and remembers it for the next launch. */
export function applyThemeNow(t: ThemeChoice) {
  applyLook(t.theme, t.palette, t.custom);
  try {
    localStorage.setItem("kwenta-prefs", JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

/** Saves the choice to the signed-in account (skipped when it's already what's stored). */
export async function pushTheme(t: ThemeChoice) {
  try {
    const sb = getSupabase();
    const user = (await sb?.auth.getSession())?.data.session?.user;
    if (!sb || !user) return;
    const cur = themeFromMetadata(user.user_metadata);
    if (cur && cur.theme === t.theme && cur.palette === t.palette && cur.custom === t.custom) return;
    await sb.auth.updateUser({ data: { kwenta_theme: t.theme, kwenta_palette: t.palette, kwenta_custom: t.custom ?? null } });
  } catch {
    /* offline or not signed in: the choice is still saved on this device */
  }
}

/** The theme saved with the signed-in account, if any. */
export async function pullTheme(): Promise<ThemeChoice | null> {
  try {
    const user = (await getSupabase()?.auth.getSession())?.data.session?.user;
    return user ? themeFromMetadata(user.user_metadata) : null;
  } catch {
    return null;
  }
}
