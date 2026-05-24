export interface DeckReleaseCard {
  sequenceId: string;
  sourceDeckId: string;
  stepCount: number;
  word: string;
  position: number;
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
