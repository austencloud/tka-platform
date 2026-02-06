/**
 * IFeedbackStatusManager
 *
 * Handles feedback status updates, deferrals, and deletions.
 */

import type {
  FeedbackItem,
  FeedbackStatus,
} from "../../domain/models/feedback-models";

export interface IFeedbackStatusManager {
  /**
   * Update the status of a feedback item
   * Tracks status history with debouncing
   */
  updateStatus(feedbackId: string, status: FeedbackStatus): Promise<void>;

  /**
   * Defer a feedback item until a future date
   */
  deferFeedback(
    feedbackId: string,
    deferredUntil: Date,
    notes: string
  ): Promise<void>;

  /**
   * Delete a feedback item (admin operation)
   */
  deleteFeedback(feedbackId: string): Promise<void>;

  /**
   * Update feedback fields (admin operation)
   */
  updateFeedback(
    feedbackId: string,
    updates: Partial<
      Pick<FeedbackItem, "type" | "title" | "description" | "priority">
    >
  ): Promise<void>;

  /**
   * Update user's own feedback
   * Validates ownership and status constraints
   */
  updateUserFeedback(
    feedbackId: string,
    updates: Partial<Pick<FeedbackItem, "type" | "description">>,
    appendMode?: boolean
  ): Promise<FeedbackItem>;

  /**
   * Delete user's own feedback
   * Only allowed when status is "new"
   */
  deleteUserFeedback(feedbackId: string): Promise<void>;
}
