import type { FeedbackItem } from "../../domain/models/feedback-models";

/**
 * Contract for loading archived feedback items from Firestore
 */
export interface IArchiveLoader {
  /**
   * Load all archived feedback items
   */
  loadAllArchived(): Promise<FeedbackItem[]>;
}
