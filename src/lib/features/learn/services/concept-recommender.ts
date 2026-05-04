/**
 * ConceptRecommender
 *
 * Traverses the prerequisite graph from concepts.ts to suggest
 * next concepts and identify review needs.
 *
 * Decision criteria:
 * - Next concepts: unlocked but not completed, ordered by curriculum position
 * - Review: mastery < 80% or last practiced > 7 days ago
 * - Skip explanation: mastery > 95% with 5+ successful attempts
 */

import {
  TKA_CONCEPTS,
  isConceptUnlocked,
} from "../domain/concepts";
import type { LearnConcept } from "../domain/types";
import type { ConceptMastery } from "../domain/quiz-history-types";

/** Below this average score, flag concept for review */
const REVIEW_SCORE_THRESHOLD = 80;

/** Days since last practice before flagging for review */
const REVIEW_STALENESS_DAYS = 7;

/** Above this score with enough attempts, skip detailed explanation */
const SKIP_EXPLANATION_THRESHOLD = 95;

/** Minimum attempts before allowing explanation skip */
const SKIP_EXPLANATION_MIN_ATTEMPTS = 5;

export function getNextConcepts(
  completedIds: Set<string>,
  limit: number = 3
): LearnConcept[] {
  const suggestions: LearnConcept[] = [];

  for (const concept of TKA_CONCEPTS) {
    if (completedIds.has(concept.id)) continue;
    if (!isConceptUnlocked(concept.id, completedIds)) continue;

    suggestions.push(concept);
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

export function getConceptsDueForReview(
  masteryScores: Map<string, ConceptMastery>
): string[] {
  const now = new Date();
  const dueIds: string[] = [];

  for (const [conceptId, mastery] of masteryScores) {
    // Low mastery score
    if (mastery.averageScore < REVIEW_SCORE_THRESHOLD) {
      dueIds.push(conceptId);
      continue;
    }

    // Stale practice (hasn't practiced recently)
    const daysSinceLastAttempt = Math.floor(
      (now.getTime() - mastery.lastAttemptAt.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastAttempt > REVIEW_STALENESS_DAYS) {
      dueIds.push(conceptId);
    }
  }

  return dueIds;
}

export function shouldSkipExplanation(
  _conceptId: string,
  mastery: ConceptMastery | undefined
): boolean {
  if (!mastery) return false;

  return (
    mastery.averageScore >= SKIP_EXPLANATION_THRESHOLD &&
    mastery.attempts >= SKIP_EXPLANATION_MIN_ATTEMPTS
  );
}
