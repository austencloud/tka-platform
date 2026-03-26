import type { Deck } from "../../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface FamilyRatioGroup {
  readonly ratio: string;
  readonly turns: number;
  readonly sequences: SequenceData[];
}

export interface IVtgFamilyAggregator {
  aggregateFamilySequences(
    familyId: string,
    decks: Deck[],
  ): Promise<FamilyRatioGroup[]>;
}
