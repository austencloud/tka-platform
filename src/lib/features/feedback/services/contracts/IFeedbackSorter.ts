import type { FeedbackItem } from "../../domain/models/feedback-models";

export interface IFeedbackSorter {
  /**
   * Sort items by priority (no priority first, then high, medium, low)
   * Secondary sort by creation date (oldest first)
   */
  sortByPriority(items: FeedbackItem[]): FeedbackItem[];

  /**
   * Group items by status, excluding deleted and archived items
   * Returns record with 4 kanban statuses, each sorted by priority
   */
  groupByStatus(
    items: FeedbackItem[]
  ): Record<"new" | "in-progress" | "in-review" | "completed", FeedbackItem[]>;

  /**
   * Get deferred items (archived with deferredUntil timestamp)
   */
  getDeferredItems(items: FeedbackItem[]): FeedbackItem[];
}
