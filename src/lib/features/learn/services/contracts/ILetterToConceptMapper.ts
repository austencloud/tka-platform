/**
 * Maps TKA letters to curriculum concept IDs.
 *
 * Quiz questions reference letters (A, W, Σ-, etc.) but persistence
 * and mastery tracking operate on curriculum concept IDs (type1-abc-ghi,
 * type2-wxyz, etc.). This mapper bridges the two.
 */

export interface ILetterToConceptMapper {
  /**
   * Get the curriculum concept ID for a given letter.
   * Returns null if the letter has no mapped concept.
   */
  getConceptId(letter: string): string | null;

  /**
   * Get the knowledge graph node ID for a letter's type.
   * Returns node IDs like "type-1", "type-2", etc.
   */
  getTypeNodeId(letter: string): string | null;
}
