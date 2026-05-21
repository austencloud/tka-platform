import type { CardPair } from "../../services/types";

export interface RenderedCard {
  frontUrl: string;
  backUrl: string;
  label: string;
}

export interface CachedCard {
  rendered: RenderedCard;
  pair: CardPair | null;
}

export const cardCache = new Map<string, CachedCard>();
