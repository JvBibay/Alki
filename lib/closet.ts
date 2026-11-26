/**
 * Alki's closet: accessories in four slots that can be worn together.
 * Items unlock by earning badges (see lib/badges.ts); a few are free or seasonal.
 */

export type Slot = "head" | "eyes" | "neck" | "hand" | "scene";
export type Look = Partial<Record<Slot, string>>;

/** `glyph` is the one-color tab icon (components/Icon.tsx); `icon` is the emoji, kept for other uses. */
export const SLOTS: { id: Slot; label: string; icon: string; glyph: string }[] = [
  { id: "head", label: "Head", icon: "🎩", glyph: "hat" },
  { id: "eyes", label: "Eyes", icon: "👓", glyph: "glasses" },
  { id: "neck", label: "Neck", icon: "🎀", glyph: "bowtie" },
  { id: "hand", label: "Hold", icon: "✋", glyph: "hand" },
  { id: "scene", label: "Scene", icon: "🏞️", glyph: "scene" },
];

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Badge id that unlocks it; "season" = available in the ber months (Sep–Dec) and early January. */
  needs?: string;
}

export const ITEMS: Item[] = [
  // Head
  { id: "beanie", slot: "head", name: "Beanie", needs: "streak3" },
  { id: "salakot", slot: "head", name: "Salakot", needs: "streak7" },
  { id: "santa", slot: "head", name: "Pasko hat", needs: "season" },
  { id: "party", slot: "head", name: "Party hat", needs: "goal" },
  { id: "headphones", slot: "head", name: "Headphones", needs: "budget" },
  { id: "gradcap", slot: "head", name: "Grad cap", needs: "tx50" },
  { id: "sampaguita", slot: "head", name: "Flower crown", needs: "bills" },
  { id: "crown", slot: "head", name: "Golden crown", needs: "streak30" },
  { id: "witch", slot: "head", name: "Witch hat" },
  // Eyes
  { id: "round", slot: "eyes", name: "Round glasses" },
  { id: "shades", slot: "eyes", name: "Cool shades", needs: "streak3" },
  { id: "hearts", slot: "eyes", name: "Heart glasses", needs: "goal" },
  { id: "monocle", slot: "eyes", name: "Monocle", needs: "tx50" },
  { id: "stars", slot: "eyes", name: "Star glasses", needs: "goaldone" },
  // Neck
  { id: "bowtie", slot: "neck", name: "Bow tie" },
  { id: "scarf", slot: "neck", name: "Cozy scarf", needs: "first" },
  { id: "lei", slot: "neck", name: "Sampaguita lei", needs: "bills" },
  { id: "medal", slot: "neck", name: "Gold medal", needs: "goaldone" },
  { id: "xmas", slot: "neck", name: "Pasko scarf", needs: "season" },
  // Hand
  { id: "coffee", slot: "hand", name: "Kape" },
  { id: "coin", slot: "hand", name: "Lucky coin" },
  { id: "moneybag", slot: "hand", name: "Money bag", needs: "first" },
  { id: "flag", slot: "hand", name: "Mini flag", needs: "streak7" },
  { id: "balloon", slot: "hand", name: "Balloon", needs: "goal" },
  // Scene (drawn behind Alki, see components/AlkiScene.tsx)
  { id: "classic", slot: "scene", name: "Green glow" },
  { id: "grove", slot: "scene", name: "Bamboo grove" },
  { id: "beach", slot: "scene", name: "Beach sunset", needs: "first" },
  { id: "rain", slot: "scene", name: "Rainy day", needs: "streak3" },
  { id: "fiesta", slot: "scene", name: "Fiesta", needs: "budget" },
  { id: "city", slot: "scene", name: "City lights", needs: "tx50" },
  { id: "night", slot: "scene", name: "Starry night", needs: "streak7" },
  { id: "pasko", slot: "scene", name: "Parol night", needs: "season" },
];

export const getItem = (id?: string) => ITEMS.find((i) => i.id === id);

/** Ber months (Sep–Dec) and the first week of January: Christmas season in the Philippines. */
export function isPaskoSeason(now = Date.now()) {
  const d = new Date(now);
  return d.getMonth() >= 8 || (d.getMonth() === 0 && d.getDate() <= 6);
}

export function isUnlocked(item: Item, earned: Set<string>, now = Date.now()) {
  if (!item.needs) return true;
  if (item.needs === "season") return isPaskoSeason(now);
  return earned.has(item.needs);
}

/** Converts the old single "outfit" setting to a look. */
export function outfitToLook(outfit?: string): Look {
  switch (outfit) {
    case "scarf":
      return { neck: "scarf" };
    case "shades":
      return { eyes: "shades" };
    case "salakot":
    case "party":
    case "crown":
      return { head: outfit };
    default:
      return {};
  }
}

/** The look to draw, from settings (new `look`, or the old `outfit`). */
export function lookOf(settings: { look?: Look; outfit?: string }): Look {
  return settings.look ?? outfitToLook(settings.outfit);
}
