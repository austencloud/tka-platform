/**
 * Contract for recording and querying quiz attempt history.
 *
 * Append-only log of quiz results stored in Firestore.
 * Provides computed mastery summaries from raw attempt data.
 */

import type { QuizAttempt, ConceptMastery } from "../../domain/quiz-history-types";

export interface IQuizHistoryRecorder {
  /**
   * Record a completed quiz attempt.
   * Appends to the user's quiz history collection.
   */
  recordAttempt(userId: string, attempt: Omit<QuizAttempt, "id">): Promise<void>;

  /**
   * Get quiz history, optionally filtered by concept.
   * Results are ordered by timestamp descending (most recent first).
   */
  getHistory(
    userId: string,
    conceptId?: string,
    limit?: number
  ): Promise<QuizAttempt[]>;

  /**
   * Compute mastery summary for a specific concept.
   * Derived from the user's quiz attempt history.
   */
  getConceptMastery(
    userId: string,
    conceptId: string
  ): Promise<ConceptMastery | null>;

  /**
   * Compute mastery summaries for all concepts the user has attempted.
   * Returns a map of concept ID to mastery data.
   */
  getAllMasteryScores(
    userId: string
  ): Promise<Map<string, ConceptMastery>>;
}
