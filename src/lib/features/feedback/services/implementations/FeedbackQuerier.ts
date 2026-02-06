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
import type {
  IFeedbackQueryService,
  FeedbackQueryResult,
} from "../contracts/IFeedbackQueryService";
import type {
  FeedbackItem,
  FeedbackFilterOptions,
} from "../../domain/models/feedback-models";
import type { IFeedbackDocumentMapper } from "../contracts/IFeedbackDocumentMapper";
import { feedbackDocumentMapper } from "./FeedbackDocumentMapper";

const COLLECTION_NAME = "feedback";

export class FeedbackQueryService implements IFeedbackQueryService {
  constructor(
    private readonly mapper: IFeedbackDocumentMapper = feedbackDocumentMapper
  ) {}

  async loadFeedback(
    filters: FeedbackFilterOptions,
    pageSize: number,
    lastDocId?: string
  ): Promise<FeedbackQueryResult> {
    const firestore = await getFirestoreInstance();
    const constraints: Parameters<typeof query>[1][] = [];

    // Add filters
    if (filters.type !== "all") {
      constraints.push(where("type", "==", filters.type));
    }
    if (filters.status !== "all") {
      constraints.push(where("status", "==", filters.status));
    }
    if (filters.priority !== "all") {
      constraints.push(where("priority", "==", filters.priority));
    }

    // Order by createdAt descending
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(pageSize));

    // Handle pagination
    if (lastDocId) {
      const lastDocRef = doc(firestore, COLLECTION_NAME, lastDocId);
      const lastDocSnap = await getDoc(lastDocRef);
      if (lastDocSnap.exists()) {
        constraints.push(startAfter(lastDocSnap));
      }
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
    const firestore = await getFirestoreInstance();
    const constraints: Parameters<typeof query>[1][] = [];

    // Filter by user
    constraints.push(where("userId", "==", userId));
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(pageSize));

    // Handle pagination
    if (lastDocId) {
      const lastDocRef = doc(firestore, COLLECTION_NAME, lastDocId);
      const lastDocSnap = await getDoc(lastDocRef);
      if (lastDocSnap.exists()) {
        constraints.push(startAfter(lastDocSnap));
      }
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
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapper.mapDocToFeedbackItem(docSnap.id, docSnap.data());
  }
}

// Export singleton instance
export const feedbackQueryService = new FeedbackQueryService();
