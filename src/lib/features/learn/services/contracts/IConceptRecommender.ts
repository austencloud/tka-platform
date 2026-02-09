/**
 * Contract for recommending next concepts and identifying review needs.
 *
 * Uses the prerequisite graph from concepts.ts and mastery data
 * from quiz history to make intelligent suggestions.
 */

import type { LearnConcept } from "../../domain/types";
import type { ConceptMastery } from "../../domain/quiz-history-types";

export interface IConceptRecommender {
  /**
   * Get the next unlocked concepts the user should learn.
   * Returns concepts whose prerequisites are all completed.
   */
  getNextConcepts(completedIds: Set<string>, limit?: number): LearnConcept[];

  /**
   * Get concepts that need review based on mastery scores.
   * Includes concepts with low mastery or stale practice dates.
   */
  getConceptsDueForReview(
    masteryScores: Map<string, ConceptMastery>
  ): string[];

  /**
   * Determine whether TIKA should skip explaining a concept.
   * True if the user has demonstrated strong mastery.
   */
  shouldSkipExplanation(
    conceptId: string,
    mastery: ConceptMastery | undefined
  ): boolean;
}
