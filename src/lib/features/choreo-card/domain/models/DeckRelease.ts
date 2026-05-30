export interface CardFooter {
  left?: string;
  center?: string;
  right?: string;
  /** Path to an icon image drawn on both sides of center text */
  iconPath?: string;
}

/**
 * A frozen, deterministic variation recipe applied to a card's base sequence at
 * render time. Absent → the card renders its base sequence unchanged (every deck
 * released before this feature). LOOP cards roll one randomly; TnD cards set
 * `turnPattern` deterministically. There is NO parallel `card.turnPattern` field —
 * both producers write here.
 */
export interface CardVariation {
  /** Book reversal id, e.g. "long-book". LOOP only. */
  reversalPatternId?: string;
  /** Raw tiled reversal symbol string (P/R/B/-), re-resolved at apply. LOOP only. */
  reversalSequence?: string;
  /** Turn pattern: tiled per-beat "1|1-0|0" (LOOP) OR a single uniform unit "1|2" (TnD). */
  turnPattern?: string;
  /** Display label for the applied turn pattern, e.g. "Pulse 1" or "1|2". */
  turnLabel?: string;
  /** Start-orientation register, deck-wide. Absent / "radial" → canonical in|in. */
  startOriMode?: "radial" | "nonradial" | "split";
  /** Grid-mode register, deck-wide. Absent / "diamond" → as-authored. "box" →
   *  hand path rotated 45° (per-family direction: alpha/gamma CW, beta CCW). */
  gridMode?: "diamond" | "box";
}

export interface DeckReleaseCard {
  sequenceId: string;
  sourceCatalogId: string;
  stepCount: number;
  word: string;
  position: number;
  footer: CardFooter;
  /** Optional frozen variation recipe; absent → renders base. */
  variation?: CardVariation;
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
