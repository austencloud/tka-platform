import type { ResolvedReversalPattern } from "../reversal-transform";
import type { VariationConfig } from "../../services/deck-variation";

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

/**
 * The frozen dial-set that produced a deck. Stamped onto the manifest at release
 * so any saved deck can be reused as a recipe — the deck list doubles as the
 * recipe library (no separate recipe collection). Only the dials are stored, NOT
 * per-deck instance metadata (name/notes/description) or re-derivable pool counts
 * (`StepCountWeight.available`). Absent on legacy manifests → no reuse affordance.
 */
export interface DeckRecipe {
  /** Shape version of THIS object — migrate-on-read. Absent ⇒ legacy (treat as 0). */
  schemaVersion?: number;
  /** Generation logic pin. Absent ⇒ legacy pool draw (pre-seeding). */
  generatorVersion?: string;
  /** Explicit draw seed. Reroll mints a new one; reproduce reuses it. Absent ⇒ legacy. */
  seed?: string;

  deckMode: "loop" | "tnd";
  /** Shared transform dials (both modes). */
  startOriModes: ("radial" | "nonradial" | "split")[];
  gridModes: ("diamond" | "box")[];
  reversalPattern?: ResolvedReversalPattern | null;
  /** LOOP-only: per-step-count weights (`available` dropped — re-derived live). */
  weights?: { stepCount: number; weight: number }[];
  totalCards?: number;
  sliceTypes?: ("halved" | "quartered")[];
  variationConfig?: VariationConfig;
  /** New LOOP axis: which loop type(s) the deck draws from. Absent ⇒ all enumerated (legacy = rotated only). */
  loopTypes?: string[];
  /** New LOOP axis: which level(s). Absent ⇒ all available. */
  levels?: number[];
  /** New LOOP axis: start-position id subset. Absent/empty ⇒ any. */
  startPositionIds?: string[];
  /** Style axes (Smooth/Mixed/Choppy). Props drives prop-reversal density (live);
   *  hands + dashes are stamped intent for the live-generation phase. */
  propStyle?: "smooth" | "mixed" | "choppy";
  handStyle?: "smooth" | "mixed" | "choppy";
  dashStyle?: "low" | "mixed" | "high";
  /** Fixed sequence length — every LOOP card generated at this step count. */
  length?: number;
  /** TnD-only. */
  tndFamilyIds?: string[];
  tndTurnPatternIds?: string[];
}

export interface DeckRelease {
  deckNumber: number;
  createdAt: string;
  /** Frozen dial-set that produced this deck. Absent on legacy manifests. */
  recipe?: DeckRecipe;
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
