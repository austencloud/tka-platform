import type { FeedbackItem } from "../../domain/models/feedback-models";
import type { SwimLane } from "./ISwimLaneDeriver";

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
   * Group items by status AND swim lane
   * Returns nested record: status -> lane -> items
   */
  groupByStatusAndLane(
    items: FeedbackItem[]
  ): Record<"new" | "in-progress" | "in-review" | "completed", Record<SwimLane, FeedbackItem[]>>;

  /**
   * Get deferred items (archived with deferredUntil timestamp)
   */
  getDeferredItems(items: FeedbackItem[]): FeedbackItem[];
}
