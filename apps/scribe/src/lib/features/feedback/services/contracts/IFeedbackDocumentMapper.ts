/**
 * IFeedbackDocumentMapper
 *
 * Maps Firestore documents to FeedbackItem domain models.
 * Extracted from FeedbackService for single responsibility.
 */

import type { FeedbackItem } from "../../domain/models/feedback-models";

export interface IFeedbackDocumentMapper {
  /**
   * Map a Firestore document to a FeedbackItem domain model
   */
  mapDocToFeedbackItem(id: string, data: Record<string, unknown>): FeedbackItem;
}
