/**
 * Spending categories: the built-in ones plus any the user creates (e.g. "Milk tea 🧋").
 * The app registers the custom list once per render (like the main currency), so any
 * component can look up a category's emoji and color.
 */
import { CAT_COLORS, CATS } from "./types";

export interface CustomCat {
  name: string;
  emoji: string;
  color: string;
  /** Extra words that should map to this category when typing, e.g. ["boba"]. */
  keywords?: string[];
}

export const CAT_EMOJI_CHOICES = ["🧋", "☕", "🍔", "🍺", "👶", "🐶", "🐱", "🎮", "✈️", "🏠", "🎓", "💅", "🏋️", "⛽", "🎁", "📱", "🙏", "🚗", "👕", "📚", "💇", "🧾", "🌱", "⚽"];
export const CAT_COLOR_CHOICES = ["#f59e0b", "#ef4444", "#ec4899", "#a855f7", "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#78716c"];

let CUSTOM: CustomCat[] = [];
export const setCustomCategories = (list?: CustomCat[]) => {
  CUSTOM = Array.isArray(list) ? list : [];
};

const builtIn = Object.keys(CATS);

/** All category names: built-in first, then custom. */
export function catNames(custom: CustomCat[] = CUSTOM): string[] {
  return [...builtIn, ...custom.map((c) => c.name).filter((n) => !builtIn.includes(n))];
}

export const isBuiltIn = (name: string) => builtIn.includes(name);

export function catEmoji(name: string, custom: CustomCat[] = CUSTOM): string {
  return CATS[name] ?? custom.find((c) => c.name === name)?.emoji ?? (name === "Income" ? "💰" : name === "Debt" ? "🤝" : name === "Adjustment" ? "⚖️" : name === "Interest" ? "💹" : "📦");
}

export function catColor(name: string, custom: CustomCat[] = CUSTOM): string {
  return CAT_COLORS[name] ?? custom.find((c) => c.name === name)?.color ?? (name === "Debt" ? "#0ea5e9" : name === "Adjustment" ? "#64748b" : name === "Interest" ? "#16a34a" : "#94a3b8");
}
