/**
 * Contract for managing user progress through the TKA learning path.
 * Handles concept unlocking, progress tracking, and persistence.
 */

import type {
  ConceptProgress,
  ConceptStatus,
  LearningProgress,
} from "../../domain/types";

export interface IConceptProgressTracker {
  /**
   * Subscribe to progress changes
   */
  subscribe(callback: (progress: LearningProgress) => void): () => void;

  /**
   * Get current progress state
   */
  getProgress(): LearningProgress;

  /**
   * Get status of a specific concept
   */
  getConceptStatus(conceptId: string): ConceptStatus;

  /**
   * Get progress for a specific concept
   */
  getConceptProgress(conceptId: string): ConceptProgress;

  /**
   * Start learning a concept
   */
  startConcept(conceptId: string): void;

  /**
   * Record a practice attempt
   */
  recordPracticeAttempt(
    conceptId: string,
    correct: boolean,
    timeSpentSeconds?: number
  ): void;

  /**
   * Mark a concept as completed
   */
  completeConcept(conceptId: string): void;

  /**
   * Get concepts that are ready for review (spaced repetition)
   */
  getConceptsDueForReview(): string[];

  /**
   * Reset all progress (for testing/development)
   */
  resetProgress(): void;

  /**
   * Export progress as JSON (for backup/transfer)
   */
  exportProgress(): string;

  /**
   * Import progress from JSON
   */
  importProgress(json: string): void;
}
