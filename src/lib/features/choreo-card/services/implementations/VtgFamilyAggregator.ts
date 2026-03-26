import type { Deck } from "../../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDeckLoader } from "../contracts/IDeckLoader";
import type {
  IVtgFamilyAggregator,
  FamilyRatioGroup,
} from "../contracts/IVtgFamilyAggregator";
import { VTG_RATIO_TURNS_MAP } from "../../domain/elemental-theme";

export class VtgFamilyAggregator implements IVtgFamilyAggregator {
  constructor(private readonly deckLoader: IDeckLoader) {}

  async aggregateFamilySequences(
    familyId: string,
    decks: Deck[],
  ): Promise<FamilyRatioGroup[]> {
    const deckFamilyPairs = decks
      .map((deck) => {
        const family = deck.families.find((f) => f.id === familyId);
        return family ? { deck, family } : null;
      })
      .filter(
        (pair): pair is NonNullable<typeof pair> => pair !== null,
      );

    const results = await Promise.all(
      deckFamilyPairs.map(async ({ deck, family }) => {
        const sequences = await this.deckLoader.loadSequencesByIds(
          deck.id,
          family.sequenceIds as string[],
        );
        const ratio = deck.vtgRatio ?? deck.name.match(/\((\d+:\d+)/)?.[1] ?? "?";
        const turns = deck.turns ?? VTG_RATIO_TURNS_MAP[ratio] ?? 0;
        return { ratio, turns, sequences };
      }),
    );

    return results
      .filter((group) => group.sequences.length > 0)
      .sort((a, b) => a.turns - b.turns);
  }
}
