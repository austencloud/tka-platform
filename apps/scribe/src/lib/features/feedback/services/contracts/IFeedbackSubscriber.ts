/**
 * IFeedbackSubscriber
 *
 * Handles real-time feedback subscriptions via Firestore listeners.
 */

import type { Unsubscribe } from "firebase/firestore";
import type { FeedbackItem } from "../../domain/models/feedback-models";

export interface IFeedbackSubscriber {
  /**
   * Subscribe to real-time feedback updates (all feedback for admin dashboard)
   * Returns an unsubscribe function
   */
  subscribeToFeedback(
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;

  /**
   * Subscribe to real-time updates for a specific user's feedback
   * Returns an unsubscribe function
   */
  subscribeToUserFeedback(
    userId: string,
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;
}
