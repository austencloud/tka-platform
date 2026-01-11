/**
 * Tree Feedback Persister Contract
 *
 * Manages localStorage persistence for tree approval/rejection feedback in Tree Lab.
 */

import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";

/** Feedback status for a tree sample */
export type TreeSampleStatus = "pending" | "approved" | "rejected";

/** Stored feedback for all tree types */
export interface TreeFeedback {
  [treeType: string]: {
    approved: number[];
    rejected: number[];
  };
}

/** A tree sample with its feedback status */
export interface TreeSample {
  seed: number;
  status: TreeSampleStatus;
}

export interface ITreeFeedbackPersister {
  /**
   * Load all feedback from localStorage
   */
  load(): TreeFeedback;

  /**
   * Save feedback to localStorage
   */
  save(feedback: TreeFeedback): void;

  /**
   * Get the status of a specific seed for a tree type
   */
  getStatus(feedback: TreeFeedback, treeType: TreeType, seed: number): TreeSampleStatus;

  /**
   * Update the status of a seed, cycling through pending -> approved -> rejected -> pending
   */
  cycleStatus(feedback: TreeFeedback, treeType: TreeType, seed: number): TreeFeedback;

  /**
   * Get feedback stats for a tree type
   */
  getStats(feedback: TreeFeedback, treeType: TreeType): { approved: number; rejected: number };

  /**
   * Generate a set of samples with their current feedback status
   */
  generateSamples(feedback: TreeFeedback, treeType: TreeType, count: number): TreeSample[];
}
