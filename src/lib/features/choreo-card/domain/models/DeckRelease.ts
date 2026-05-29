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
  /** Display name shown in the releaser header and history; editable post-release. */
  name?: string;
  /** Optional free-text description of the deck. */
  description?: string;
  theme: string;
  /** Prop types snapshotted at release time so cached card renders stay valid across setting changes. */
  bluePropType?: string;
  redPropType?: string;
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
