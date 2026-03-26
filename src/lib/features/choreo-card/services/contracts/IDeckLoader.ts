import type { Deck } from "../../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IDeckLoader {
  loadDecks(): Promise<Deck[]>;
  loadDeckSequences(deckId: string): Promise<SequenceData[]>;
  loadSequencesByIds(deckId: string, sequenceIds: string[]): Promise<SequenceData[]>;
}
