/**
 * FeedbackQueryService
 *
 * Handles feedback querying and loading operations.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  where,
  startAfter,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { firestoreGet, firestoreList } from "$lib/shared/firestore";
import type { FeedbackQueryResult } from "../contracts/types";
import type {
  FeedbackItem,
  FeedbackFilterOptions,
} from "../../domain/models/feedback-models";
import { FeedbackItemSchema } from "../../domain/models/feedback-schemas";
import * as feedbackDocumentMapper from "../feedback-document-mapper";

const COLLECTION_NAME = "feedback";

export class FeedbackQueryService {
  private readonly mapper = feedbackDocumentMapper;

  async loadFeedback(
    filters: FeedbackFilterOptions,
    pageSize: number,
    lastDocId?: string
  ): Promise<FeedbackQueryResult> {
    // Pagination uses doc snapshot cursors — keep raw Firestore for startAfter
    if (lastDocId) {
      return this.loadFeedbackWithCursor(filters, pageSize, lastDocId);
    }

    const whereClauses: { field: string; op: "==" | "in"; value: unknown }[] = [];
    if (filters.type !== "all") {
      whereClauses.push({ field: "type", op: "==", value: filters.type });
    }
    if (filters.status !== "all") {
      whereClauses.push({ field: "status", op: "==", value: filters.status });
    }
    if (filters.priority !== "all") {
      whereClauses.push({ field: "priority", op: "==", value: filters.priority });
    }

    const items = await firestoreList<FeedbackItem>(
      COLLECTION_NAME,
      FeedbackItemSchema,
      {
        where: whereClauses,
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: pageSize,
      },
    );

    const lastItem = items[items.length - 1];

    return {
      items,
      lastDocId: lastItem?.id || null,
      hasMore: items.length === pageSize,
    };
  }

  private async loadFeedbackWithCursor(
    filters: FeedbackFilterOptions,
    pageSize: number,
    lastDocId: string
  ): Promise<FeedbackQueryResult> {
    const firestore = await getFirestoreInstance();
    const constraints: Parameters<typeof query>[1][] = [];

    if (filters.type !== "all") {
      constraints.push(where("type", "==", filters.type));
    }
    if (filters.status !== "all") {
      constraints.push(where("status", "==", filters.status));
    }
    if (filters.priority !== "all") {
      constraints.push(where("priority", "==", filters.priority));
    }

    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(pageSize));

    const lastDocRef = doc(firestore, COLLECTION_NAME, lastDocId);
    const lastDocSnap = await getDoc(lastDocRef);
    if (lastDocSnap.exists()) {
      constraints.push(startAfter(lastDocSnap));
    }

    const q = query(collection(firestore, COLLECTION_NAME), ...constraints);
    const snapshot = await getDocs(q);

    const items: FeedbackItem[] = snapshot.docs.map((docSnap) =>
      this.mapper.mapDocToFeedbackItem(docSnap.id, docSnap.data())
    );

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return {
      items,
      lastDocId: lastDoc?.id || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  }

  async loadUserFeedback(
    userId: string,
    pageSize: number,
    lastDocId?: string
  ): Promise<FeedbackQueryResult> {
    // Pagination uses doc snapshot cursors — keep raw Firestore for startAfter
    if (lastDocId) {
      return this.loadUserFeedbackWithCursor(userId, pageSize, lastDocId);
    }

    const items = await firestoreList<FeedbackItem>(
      COLLECTION_NAME,
      FeedbackItemSchema,
      {
        where: [{ field: "userId", op: "==", value: userId }],
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: pageSize,
      },
    );

    const lastItem = items[items.length - 1];

    return {
      items,
      lastDocId: lastItem?.id || null,
      hasMore: items.length === pageSize,
    };
  }

  private async loadUserFeedbackWithCursor(
    userId: string,
    pageSize: number,
    lastDocId: string
  ): Promise<FeedbackQueryResult> {
    const firestore = await getFirestoreInstance();
    const constraints: Parameters<typeof query>[1][] = [];

    constraints.push(where("userId", "==", userId));
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(pageSize));

    const lastDocRef = doc(firestore, COLLECTION_NAME, lastDocId);
    const lastDocSnap = await getDoc(lastDocRef);
    if (lastDocSnap.exists()) {
      constraints.push(startAfter(lastDocSnap));
    }

    const q = query(collection(firestore, COLLECTION_NAME), ...constraints);
    const snapshot = await getDocs(q);

    const items: FeedbackItem[] = snapshot.docs.map((docSnap) =>
      this.mapper.mapDocToFeedbackItem(docSnap.id, docSnap.data())
    );

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return {
      items,
      lastDocId: lastDoc?.id || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  }

  async getFeedback(feedbackId: string): Promise<FeedbackItem | null> {
    return firestoreGet<FeedbackItem>(
      COLLECTION_NAME,
      feedbackId,
      FeedbackItemSchema,
    );
  }
}

// Export singleton instance
export const feedbackQueryService = new FeedbackQueryService();
