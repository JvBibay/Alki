import type { Notice, State } from "./types";
import { badges } from "./badges";

export const MAX_NOTICES = 50;

/**
 * Badges earned but not announced yet. Returns the new notices (newest first) and the full list of announced ids,
 * or null when there is nothing new. Badges earned before this feature existed are announced once, the first time.
 */
export function newBadgeNotices(state: State, now = Date.now()): { notices: Notice[]; seen: string[] } | null {
  const seen = new Set(state.settings.badgesSeen ?? []);
  const fresh = badges(state, now).filter((b) => b.earned && !seen.has(b.id));
  if (!fresh.length) return null;
  const notices: Notice[] = fresh.map((b) => ({
    id: `badge-${b.id}`,
    kind: "badge",
    icon: b.icon,
    tier: b.tier,
    title: `New badge: ${b.name}`,
    text: b.desc,
    at: now,
    read: false,
  }));
  return { notices, seen: [...seen, ...fresh.map((b) => b.id)] };
}

/** Adds notices to the front of the list, skipping ids already there, and keeps the newest MAX_NOTICES. */
export function addNotices(list: Notice[] | undefined, add: Notice[]): Notice[] {
  const have = new Set((list ?? []).map((n) => n.id));
  return [...add.filter((n) => !have.has(n.id)), ...(list ?? [])].slice(0, MAX_NOTICES);
}

export const unreadCount = (list: Notice[] | undefined) => (list ?? []).filter((n) => !n.read).length;
