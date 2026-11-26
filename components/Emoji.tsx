import { Fragment, type ReactNode } from "react";
import { EMOJI_IMAGES } from "@/lib/emoji.generated";
import { ICON_BODIES } from "@/lib/icons.generated";
import EMOJI_ICONS from "@/lib/emoji-icons.json";

/**
 * Kwenta draws its emoji as one-color line icons (Lucide, see lib/emoji-icons.json), so they
 * match the rest of the interface and take the color of the text around them. Saved data still
 * stores the emoji character; only the drawing changes. Country flags stay as round flag images.
 * Anything without an icon or flag falls back to the plain character.
 */

/** "🗓️" → "1f5d3": variation selectors dropped, ZWJ parts joined by "-". */
export const emojiKey = (e: string) =>
  [...e]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join("-");

/** emojiKey → Lucide icon name */
const ICON_FOR = new Map<string, string>(
  Object.entries(EMOJI_ICONS as Record<string, string>)
    .filter(([e]) => !e.startsWith("_"))
    .map(([e, name]) => [emojiKey(e), name]),
);

export const iconFor = (e: string) => {
  const name = ICON_FOR.get(emojiKey(e));
  return name && ICON_BODIES[name] ? name : undefined;
};

export const hasEmojiImage = (e: string) => !!iconFor(e) || EMOJI_IMAGES.has(emojiKey(e));

export default function Emoji({ e, label, className = "" }: { e: string; /** Accessible name; without it the icon is decorative. */ label?: string; className?: string }) {
  if (!e) return null;
  const name = iconFor(e);
  if (name) {
    return (
      <svg
        className={`emo icn ${className}`}
        viewBox="0 0 24 24"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        dangerouslySetInnerHTML={{ __html: ICON_BODIES[name] }}
      />
    );
  }
  const key = emojiKey(e);
  if (EMOJI_IMAGES.has(key)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`emo ${className}`} src={`/emoji/${key}.svg`} alt={label ?? e} aria-hidden={label ? undefined : true} draggable={false} loading="lazy" decoding="async" />;
  }
  return <span className={className}>{e}</span>;
}

const PIC = "\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF\\u2B00-\\u2BFF\\u2300-\\u23FF\\u3297\\u3299\\u203C\\u2049\\u2139\\u24C2";
/** Emoji in running text: flags, or a pictograph with optional variation selector and ZWJ parts. */
const EMOJI_RE = new RegExp(`([\\u{1F1E6}-\\u{1F1FF}]{2}|[${PIC}]\\uFE0F?(?:\\u200D[${PIC}]\\uFE0F?)*)`, "u");

/** App-written text with its emoji drawn as icons (not for what people type themselves). */
export function EmojiText({ text }: { text: string }): ReactNode {
  if (!text) return text;
  const parts = text.split(EMOJI_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 && hasEmojiImage(p) ? <Emoji key={i} e={p} /> : <Fragment key={i}>{p}</Fragment>));
}
