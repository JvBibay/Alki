import { CARD_ARTS, type CardArt } from "./cards.generated";
import type { Account } from "./types";

export type { CardArt };

/**
 * Credit card pictures (public/cards/<id>.webp, built by `npm run cards`). Sample cardholder
 * names and numbers are erased, so every picture is a plain card.
 */
const BY_ID = new Map(CARD_ARTS.map((c) => [c.id, c]));

export const getCardArt = (id?: string): CardArt | undefined => (id ? BY_ID.get(id) : undefined);

/** Cards issued by a bank, by its credit-card institution id ("bpi-cc"). */
export const cardsFor = (inst?: string): CardArt[] => (inst ? CARD_ARTS.filter((c) => c.bank === inst) : []);

export const cardSrc = (c: CardArt) => `/cards/${c.id}.webp`;

/** The picture for an account, if it's a credit card with one picked. */
export const accountCard = (a: Pick<Account, "kind" | "card">) => (a.kind === "credit" ? getCardArt(a.card) : undefined);
