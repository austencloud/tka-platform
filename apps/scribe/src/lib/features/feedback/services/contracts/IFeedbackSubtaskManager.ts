/**
 * IFeedbackSubtaskManager
 *
 * Contract for managing feedback subtasks (prerequisites for complex feedback).
 * Provides utilities for subtask manipulation, blocking, and progress tracking.
 */

import type {
  FeedbackSubtask,
  SubtaskStatus,
} from "../../domain/models/feedback-models";

/**
 * Contract for feedback subtask operations
 */
export interface IFeedbackSubtaskManager {
  /**
   * Add a new subtask to feedback item
   */
  addSubtask(
    feedbackId: string,
    subtask: Omit<FeedbackSubtask, "id">
  ): Promise<FeedbackSubtask>;

  /**
   * Update subtask status (pending → in-progress → completed)
   */
  updateSubtaskStatus(
    feedbackId: string,
    subtaskId: string,
    status: SubtaskStatus
  ): Promise<void>;

  /**
   * Delete a subtask
   */
  deleteSubtask(feedbackId: string, subtaskId: string): Promise<void>;

  /**
   * Check if a subtask is blocked by dependencies
   * Returns true if subtask has unmet dependencies
   */
  isSubtaskBlocked(
    subtask: FeedbackSubtask,
    allSubtasks: FeedbackSubtask[]
  ): boolean;

  /**
   * Get completion percentage for feedback's subtasks (0-100)
   */
  getCompletionPercentage(subtasks: FeedbackSubtask[]): number;
}
