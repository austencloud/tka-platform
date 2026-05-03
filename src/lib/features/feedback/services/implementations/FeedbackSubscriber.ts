/**
 * FeedbackSubscriptionService
 *
 * Handles real-time feedback subscriptions via Firestore listeners.
 * Ensures fresh data by first fetching from server, then setting up listeners.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  getDocsFromServer,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/isPermissionDeniedError";
import type { IFeedbackSubscriptionService } from "../contracts/IFeedbackSubscriptionService";
import type { FeedbackItem } from "../../domain/models/feedback-models";
import { type FeedbackDocumentMapper, feedbackDocumentMapper } from "./FeedbackDocumentMapper";

const COLLECTION_NAME = "feedback";

export class FeedbackSubscriptionService implements IFeedbackSubscriptionService {
  constructor(
    private readonly mapper: FeedbackDocumentMapper = feedbackDocumentMapper
  ) {}

  subscribeToFeedback(
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    let unsubscribed = false;
    let firestoreUnsubscribe: Unsubscribe | null = null;

    (async () => {
      try {
        const firestore = await getFirestoreInstance();

        const q = query(
          collection(firestore, COLLECTION_NAME),
          where("status", "in", [
            "new",
            "in-progress",
            "in-review",
            "completed",
          ]),
          orderBy("createdAt", "desc"),
          limit(200)
        );

        // First, do an initial server fetch to ensure fresh data
        getDocsFromServer(q)
          .then((snapshot) => {
            if (unsubscribed) return;

            const items = this.mapSnapshotToItems(snapshot);
            onUpdate(items);
          })
          .catch((error) => {
            console.error("[FeedbackSubscriber] Initial fetch error:", error);
          });

        // Then set up the real-time listener
        firestoreUnsubscribe = onSnapshot(
          q,
          { includeMetadataChanges: false },
          (snapshot) => {
            if (unsubscribed) return;

            const items = this.mapSnapshotToItems(snapshot);
            onUpdate(items);
          },
          (error) => {
            // Expected on sign-out; stay quiet.
            if (isPermissionDeniedError(error)) {
              onError?.(error);
              return;
            }
            console.error("[FeedbackSubscriber] Subscription error:", error);
            toast.error("Lost connection to feedback. Please refresh.");
            onError?.(error);
          }
        );
      } catch (error) {
        console.error(
          "[FeedbackSubscriber] Failed to initialize subscription:",
          error
        );
        toast.error("Failed to connect to feedback.");
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => {
      unsubscribed = true;
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }

  subscribeToUserFeedback(
    userId: string,
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    let unsubscribed = false;
    let firestoreUnsubscribe: Unsubscribe | null = null;

    (async () => {
      try {
        const firestore = await getFirestoreInstance();

        const q = query(
          collection(firestore, COLLECTION_NAME),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        );

        // First, do an initial server fetch to ensure fresh data
        getDocsFromServer(q)
          .then((snapshot) => {
            if (unsubscribed) return;

            const items = this.mapSnapshotToItems(snapshot);
            onUpdate(items);
          })
          .catch((error) => {
            console.error(
              "[FeedbackSubscriber] Initial user fetch error:",
              error
            );
          });

        // Then set up the real-time listener
        firestoreUnsubscribe = onSnapshot(
          q,
          { includeMetadataChanges: false },
          (snapshot) => {
            if (unsubscribed) return;

            const items = this.mapSnapshotToItems(snapshot);
            onUpdate(items);
          },
          (error) => {
            // Expected on sign-out.
            if (isPermissionDeniedError(error)) {
              onError?.(error);
              return;
            }
            console.error(
              "[FeedbackSubscriber] User subscription error:",
              error
            );
            toast.error("Lost connection to your feedback. Please refresh.");
            onError?.(error);
          }
        );
      } catch (error) {
        console.error(
          "[FeedbackSubscriber] Failed to initialize user subscription:",
          error
        );
        toast.error("Failed to connect to your feedback.");
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => {
      unsubscribed = true;
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }

  private mapSnapshotToItems(
    snapshot: QuerySnapshot<DocumentData, DocumentData>
  ): FeedbackItem[] {
    const items: FeedbackItem[] = [];
    snapshot.docs.forEach((docSnap) => {
      try {
        const item = this.mapper.mapDocToFeedbackItem(
          docSnap.id,
          docSnap.data()
        );
        items.push(item);
      } catch (err) {
        console.error(`Failed to map feedback item ${docSnap.id}:`, err);
      }
    });
    return items;
  }
}

// Export singleton instance
export const feedbackSubscriptionService = new FeedbackSubscriptionService();
