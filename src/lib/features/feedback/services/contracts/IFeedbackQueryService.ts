/**
 * IFeedbackQueryService
 *
 * Handles feedback querying and loading operations.
 */

import type {
  FeedbackItem,
  FeedbackFilterOptions,
} from "../../domain/models/feedback-models";

export interface FeedbackQueryResult {
  items: FeedbackItem[];
  lastDocId: string | null;
  hasMore: boolean;
}

export interface IFeedbackQueryService {
  /**
   * Load feedback items with filtering and pagination
   */
  loadFeedback(
    filters: FeedbackFilterOptions,
    pageSize: number,
    lastDocId?: string
  ): Promise<FeedbackQueryResult>;

  /**
   * Load feedback items for a specific user
   */
  loadUserFeedback(
    userId: string,
    pageSize: number,
    lastDocId?: string
  ): Promise<FeedbackQueryResult>;

  /**
   * Get a single feedback item by ID
   */
  getFeedback(feedbackId: string): Promise<FeedbackItem | null>;
}
