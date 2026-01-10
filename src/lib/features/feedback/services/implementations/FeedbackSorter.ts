import type { FeedbackItem } from "../../domain/models/feedback-models";
import type { IFeedbackSorter } from "../contracts/IFeedbackSorter";

export class FeedbackSorter implements IFeedbackSorter {
  private readonly PRIORITY_ORDER: Record<string, number> = {
    "": 0, // No priority - highest sort priority (appears first)
    high: 1,
    medium: 2,
    low: 3,
  };

  sortByPriority(items: FeedbackItem[]): FeedbackItem[] {
    return [...items].sort((a, b) => {
      const priorityA = this.PRIORITY_ORDER[a.priority || ""] ?? 4;
      const priorityB = this.PRIORITY_ORDER[b.priority || ""] ?? 4;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // Secondary sort: oldest first within same priority
      return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
    });
  }

  groupByStatus(
    items: FeedbackItem[]
  ): Record<"new" | "in-progress" | "in-review" | "completed", FeedbackItem[]> {
    const grouped: Record<string, FeedbackItem[]> = {
      new: [],
      "in-progress": [],
      "in-review": [],
      completed: [],
    };

    for (const item of items) {
      // Filter out soft-deleted items
      if (item.isDeleted) continue;

      // Filter out archived items - they don't appear in Kanban
      if (item.status === "archived") continue;

      // Map to the 4 statuses
      if (grouped[item.status]) {
        grouped[item.status]?.push(item);
      }
    }

    // Sort each column by priority
    return {
      new: this.sortByPriority(grouped.new ?? []),
      "in-progress": this.sortByPriority(grouped["in-progress"] ?? []),
      "in-review": this.sortByPriority(grouped["in-review"] ?? []),
      completed: this.sortByPriority(grouped.completed ?? []),
    };
  }

  getDeferredItems(items: FeedbackItem[]): FeedbackItem[] {
    return items.filter(
      (item: FeedbackItem) =>
        item.status === "archived" && item.deferredUntil && !item.isDeleted
    );
  }
}
