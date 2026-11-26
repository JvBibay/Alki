import { cardSrc, type CardArt } from "@/lib/cardart";

/**
 * A credit card picture at a given width, always shown landscape (card-shaped, 1.586:1).
 * Portrait cards are turned sideways, the way phone wallets show them.
 */
export default function CardPic({ art, w, className = "" }: { art: CardArt; w: number; className?: string }) {
  return (
    <span className={`cardpic ${className}`} style={{ width: w, height: Math.round(w / 1.586) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardSrc(art)} alt={art.name} className={art.v ? "rot" : undefined} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}
