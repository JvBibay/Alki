/** Color palettes. The CSS for each lives in app/globals.css under [data-palette]. */
export interface Palette {
  id: string;
  name: string;
  desc: string;
  /** Preview colors: header, accent, background. */
  band: string;
  /** Header color in dark mode (also used for the phone's status bar). */
  bandDark: string;
  accent: string;
  bg: string;
}

export const PALETTES: Palette[] = [
  { id: "forest", name: "Forest", desc: "Calm green and white", bandDark: "#1f4a32", band: "#2f7a4d", accent: "#2e7d4f", bg: "#f4f8f5" },
  { id: "mint", name: "Mint", desc: "Fresh teal green", bandDark: "#124a40", band: "#13866e", accent: "#0f8f74", bg: "#f3f9f7" },
  { id: "sage", name: "Sage", desc: "Soft muted green", bandDark: "#2f4232", band: "#637f67", accent: "#5a7a5f", bg: "#f6f8f6" },
  { id: "ocean", name: "Ocean", desc: "Quiet blue", bandDark: "#1b3a5e", band: "#2a62a0", accent: "#2563a8", bg: "#f4f7fb" },
  { id: "lavender", name: "Lavender", desc: "Gentle violet", bandDark: "#2e2a66", band: "#5a4fc2", accent: "#5b50c8", bg: "#f6f6fc" },
  { id: "rose", name: "Rose", desc: "Warm pink", bandDark: "#5a2537", band: "#b34a6c", accent: "#b8456b", bg: "#fbf5f7" },
  { id: "bamboo", name: "Bamboo", desc: "Alki’s gold and green", bandDark: "#4a3510", band: "#8a5f1a", accent: "#17794d", bg: "#f6f8f4" },
  { id: "mono", name: "Graphite", desc: "Black, white and gray", bandDark: "#24282b", band: "#2f3438", accent: "#32373b", bg: "#f6f7f7" },
];

/** More colors, shown after the originals in Settings. */
PALETTES.push(
  { id: "violet", name: "Violet", desc: "Bright purple", bandDark: "#3b2470", band: "#7c4fe0", accent: "#7c4fe0", bg: "#f8f6fd" },
  { id: "crimson", name: "Crimson", desc: "Bold red", bandDark: "#5c1d1d", band: "#c43a3a", accent: "#c43a3a", bg: "#fcf5f5" },
  { id: "tangerine", name: "Tangerine", desc: "Warm orange", bandDark: "#5a3010", band: "#c9631a", accent: "#c9631a", bg: "#fcf7f2" },
  { id: "gold", name: "Gold", desc: "Sunny yellow", bandDark: "#4d3d0c", band: "#a87d12", accent: "#a87d12", bg: "#fbf9f1" },
  { id: "slate", name: "Slate", desc: "Cool blue-gray", bandDark: "#2a3544", band: "#4b6178", accent: "#4b6178", bg: "#f5f7f9" },
);

export const CUSTOM_ID = "custom";
export const DEFAULT_CUSTOM = "#d6457b";
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** Mixes two #rrggbb colors; t is how much of `b` (0..1). */
function mix(a: string, b: string, t: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(n(a, i) * (1 - t) + n(b, i) * t).toString(16).padStart(2, "0")).join("");
}

/** A palette built from one chosen color (same shape as the built-in ones). */
export function customPalette(hex: string): Palette {
  const c = isHex(hex) ? hex : DEFAULT_CUSTOM;
  return { id: CUSTOM_ID, name: "Custom", desc: "Your color", band: c, bandDark: mix(c, "#000000", 0.6), accent: mix(c, "#000000", 0.15), bg: mix(c, "#ffffff", 0.95) };
}

/** The palette for an id, including "custom". */
export function resolvePalette(id: string | undefined, custom?: string): Palette {
  if (id === CUSTOM_ID) return customPalette(custom ?? DEFAULT_CUSTOM);
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Puts a theme on <html>: light/dark/amoled/auto, the palette, and the custom color if used. */
export function applyLook(theme: string, palette: string, custom?: string) {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
  el.dataset.palette = palette;
  if (palette === CUSTOM_ID && isHex(custom)) el.style.setProperty("--custom", custom);
  else el.style.removeProperty("--custom");
}
