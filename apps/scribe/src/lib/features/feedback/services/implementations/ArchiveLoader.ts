import type { IArchiveLoader } from "../contracts/IArchiveLoader";
import type { FeedbackItem } from "../../domain/models/feedback-models";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

/**
 * Loads archived feedback items from Firestore
 */
class ArchiveLoaderImpl implements IArchiveLoader {
  async loadAllArchived(): Promise<FeedbackItem[]> {
    try {
      const firestore = await getFirestoreInstance();
      const q = query(
        collection(firestore, "feedback"),
        where("status", "==", "archived"),
        orderBy("archivedAt", "desc")
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          archivedAt: data.archivedAt?.toDate?.() || undefined,
          deferredUntil: data.deferredUntil?.toDate?.() || undefined,
        } as FeedbackItem;
      });
    } catch (e) {
      console.error("Failed to load archived items:", e);
      return [];
    }
  }
}

// Singleton instance
export const archiveLoader: IArchiveLoader = new ArchiveLoaderImpl();
