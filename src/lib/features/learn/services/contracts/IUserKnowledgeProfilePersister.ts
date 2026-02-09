/**
 * Contract for persisting user learning progress to Firestore.
 *
 * Enables cross-device sync and data durability beyond localStorage.
 * Follows the FirebaseSettingsPersister pattern for consistency.
 */

import type { LearningProgress } from "../../domain/types";

/**
 * Serializable representation of LearningProgress for Firestore.
 * Maps and Sets are converted to plain objects and arrays.
 */
export interface SerializedLearningProgress {
  concepts: Record<string, unknown>;
  completedConcepts: string[];
  currentConceptId?: string;
  overallProgress: number;
  totalCorrect: number;
  totalTimeSpent: number;
  badges: string[];
  lastUpdated: string;
}

export interface IUserKnowledgeProfilePersister {
  /**
   * Save learning progress to Firestore.
   * Uses merge: true to preserve existing fields.
   */
  saveProgress(userId: string, progress: LearningProgress): Promise<void>;

  /**
   * Load learning progress from Firestore.
   * Returns null if no progress exists for this user.
   */
  loadProgress(userId: string): Promise<LearningProgress | null>;

  /**
   * Subscribe to real-time progress changes from Firestore.
   * Enables cross-device sync via onSnapshot.
   * Returns an unsubscribe function.
   */
  subscribeToProgress(
    userId: string,
    callback: (progress: LearningProgress) => void
  ): () => void;
}
