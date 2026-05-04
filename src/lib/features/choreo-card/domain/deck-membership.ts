/**
 * Deck Membership Resolver
 *
 * Given a sequence, compute which decks it belongs to - purely from its data,
 * never from a stored `deckId` field. Deck membership is a function of:
 *
 *   level        - from SequenceDifficultyCalculator
 *   gridMode     - inherent to the sequence
 *   loopType     - from LOOPDetector
 *   sliceType    - from LOOPDetector
 *   stepCount    - `sequence.steps.length`
 *   reversalPattern - from reversal-matcher
 *
 * This lets the system re-derive deck membership for any sequence - including
 * imported ones or ones whose canonical deck doc has been deleted - and
 * handles the orphan-shortcode case where a sequence was shared before its
 * deck origin was recorded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { Deck } from "./models/Deck";
import { matchReversalPatternId } from "./reversal-matcher";
import { detectLevelFeatures } from "$lib/shared/domain/curriculum/level-feature-detector";

export interface DeckSignals {
  /**
   * 1-3 if classifiable by the current runtime classifier;
   * null when L4+ features are present (level is beyond what
   * `SequenceDifficultyCalculator` can honestly classify yet).
   */
  readonly level: number | null;
  /** Features that triggered a null level, for diagnostics. */
  readonly beyondLevel3Features: readonly string[];
  readonly gridMode: string | null;
  readonly loopType: string | null;
  readonly sliceType: "halved" | "quartered" | null;
  readonly stepCount: number;
  readonly reversalPatternId: string | null;
}

export interface SignalProviders {
  /** Returns 1-9. Today only 1/2/3 are classified; L4+ return 1 until classifier extended. */
  readonly analyzeLevel: (steps: readonly StepData[]) => number;
  /** Returns LOOP type and period. Null when the sequence isn't a LOOP. */
  readonly analyzeLoop: (sequence: SequenceData) => {
    loopType: string | null;
    period: "halved" | "quartered" | null;
  };
}

export function buildSignals(sequence: SequenceData, providers: SignalProviders): DeckSignals {
  const loopResult = providers.analyzeLoop(sequence);
  const featureReport = detectLevelFeatures(sequence);

  const level = featureReport.beyondLevel3
    ? null
    : providers.analyzeLevel(sequence.steps);

  return {
    level,
    beyondLevel3Features: featureReport.features,
    gridMode: sequence.gridMode ?? null,
    loopType: loopResult.loopType,
    sliceType: loopResult.period,
    stepCount: sequence.steps.length,
    reversalPatternId: matchReversalPatternId(sequence.steps),
  };
}

export interface DeckMatch {
  readonly deck: Deck;
  readonly exact: boolean;
  readonly missingFields: readonly (keyof DeckSignals)[];
}

/**
 * Match signals against a list of decks. A deck is a candidate when every
 * signal that has a non-null value agrees with the deck's corresponding
 * field. A signal of `null` is treated as "this sequence does not commit to
 * that dimension" and matches any deck value.
 *
 * Exact matches (every signal agreed and no nulls were skipped) come first;
 * partial matches follow and record which fields were loose.
 */
export function resolveDeckMembership(
  signals: DeckSignals,
  decks: readonly Deck[],
): DeckMatch[] {
  const matches: DeckMatch[] = [];

  for (const deck of decks) {
    const missing: (keyof DeckSignals)[] = [];

    // A null level means the sequence uses L4+ features that the classifier
    // can't disambiguate yet. No L4+ decks exist today, so refuse to match
    // any deck rather than falsely matching an L1-L3 deck.
    if (signals.level === null) continue;
    if (signals.level !== deck.level) continue;
    if (signals.stepCount !== deck.stepCount) continue;

    if (signals.gridMode == null) missing.push("gridMode");
    else if (signals.gridMode !== deck.gridMode) continue;

    if (signals.loopType == null) missing.push("loopType");
    else if (signals.loopType !== deck.loopType) continue;

    if (signals.sliceType == null) missing.push("sliceType");
    else if (signals.sliceType !== deck.sliceType) continue;

    if (signals.reversalPatternId == null) missing.push("reversalPatternId");
    else if (signals.reversalPatternId !== deck.reversalPattern) continue;

    matches.push({ deck, exact: missing.length === 0, missingFields: missing });
  }

  matches.sort((a, b) => Number(b.exact) - Number(a.exact));
  return matches;
}
