export interface CardFooter {
  left?: string;
  center?: string;
  right?: string;
  /** Path to an icon image drawn on both sides of center text */
  iconPath?: string;
}

export interface DeckReleaseCard {
  sequenceId: string;
  sourceCatalogId: string;
  stepCount: number;
  word: string;
  position: number;
  footer: CardFooter;
}

export interface DeckRelease {
  deckNumber: number;
  createdAt: string;
  theme: string;
  cardCount: number;
  notes: string;
  sequences: DeckReleaseCard[];
  stepCountDistribution: Record<number, number>;
}

export interface StepCountWeight {
  stepCount: number;
  weight: number;
  available: number;
}
