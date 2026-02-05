/**
 * Interface for searching/matching sequences by TKA word
 */
import type { MatchedSequence } from "../../types";

export interface ISequenceMatcher {
  /**
   * Search for sequences matching a TKA word
   * Searches both public sequences and a specific user's sequences
   */
  searchByWord(word: string): Promise<MatchedSequence[]>;
}
