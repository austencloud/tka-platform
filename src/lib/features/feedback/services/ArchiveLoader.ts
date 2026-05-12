import type { FeedbackItem } from "$lib/shared/feedback/domain/models/feedback-models";
import { firestoreList } from "$lib/shared/firestore";
import { FeedbackItemSchema } from "$lib/shared/feedback/domain/models/feedback-schemas";

/**
 * Loads archived feedback items from Firestore
 */
class ArchiveLoaderImpl {
  async loadAllArchived(): Promise<FeedbackItem[]> {
    try {
      return await firestoreList<FeedbackItem>(
        "feedback",
        FeedbackItemSchema,
        {
          where: [{ field: "status", op: "==", value: "archived" }],
          orderBy: [{ field: "archivedAt", direction: "desc" }],
        },
      );
    } catch (e) {
      console.error("Failed to load archived items:", e);
      return [];
    }
  }
}

// Singleton instance
export const archiveLoader = new ArchiveLoaderImpl();
