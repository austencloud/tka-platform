/**
 * TikaSessionRepository - Firebase Implementation
 *
 * Handles CRUD operations for Tika conversation sessions in Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { UIMessage } from "ai";
import type { ITikaSessionRepository } from "../contracts/ITikaSessionRepository";
import {
  createTikaSession,
  sanitizeForFirestore,
  type TikaSession,
  type TikaSessionPreview,
  type TikaSessionQueryOptions,
  type ReviewQueueQueryOptions,
  type ReviewResult,
  type ReviewStatus,
  type ReviewMetadata,
} from "../../domain/models/tika-conversation-models";
import {
  getUserTikaConversationsPath,
  getUserTikaConversationPath,
  TIKA_LIMITS,
} from "../../data/firestore-paths";

/**
 * Error class for Tika session operations
 */
export class TikaSessionError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAUTHORIZED" | "NETWORK"
  ) {
    super(message);
    this.name = "TikaSessionError";
  }
}

export class TikaSessionRepository implements ITikaSessionRepository {
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new TikaSessionError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  private toDate(timestamp: unknown): Date {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  private mapDocToSession(data: DocumentData, id: string): TikaSession {
    return {
      id,
      userId: data.userId || "",
      title: data.title || "Untitled",
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      messageCount: data.messageCount || 0,
      lastUserMessage: data.lastUserMessage || "",
      messages: data.messages || [],
      flaggedForReview: data.flaggedForReview || false,
      flaggedAt: data.flaggedAt ? this.toDate(data.flaggedAt) : undefined,
      reviewStatus: data.reviewStatus,
      reviewMetadata: data.reviewMetadata
        ? this.mapReviewMetadata(data.reviewMetadata)
        : undefined,
    };
  }

  private mapReviewMetadata(data: DocumentData): ReviewMetadata {
    return {
      claimedAt: data.claimedAt ? this.toDate(data.claimedAt) : undefined,
      claimedBy: data.claimedBy,
      grade: data.grade,
      confidence: data.confidence,
      notes: data.notes,
      aiNotes: data.aiNotes,
      correctedResponse: data.correctedResponse,
      reviewedAt: data.reviewedAt ? this.toDate(data.reviewedAt) : undefined,
    };
  }

  private mapDocToPreview(data: DocumentData, id: string): TikaSessionPreview {
    return {
      id,
      title: data.title || "Untitled",
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      messageCount: data.messageCount || 0,
      lastUserMessage: data.lastUserMessage || "",
      flaggedForReview: data.flaggedForReview || false,
      flaggedAt: data.flaggedAt ? this.toDate(data.flaggedAt) : undefined,
      reviewStatus: data.reviewStatus,
      reviewMetadata: data.reviewMetadata
        ? this.mapReviewMetadata(data.reviewMetadata)
        : undefined,
    };
  }

  async saveSession(
    sessionId: string | undefined,
    messages: UIMessage[]
  ): Promise<TikaSession> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const session = createTikaSession(userId, messages, sessionId);
    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, session.id)
    );

    let createdAt = serverTimestamp();
    if (sessionId) {
      try {
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          createdAt = existingDoc.data().createdAt || serverTimestamp();
        }
      } catch {
        // Fall back to current time if we can't read existing doc
      }
    }

    try {
      await trackWrite(
        () =>
          setDoc(
            docRef,
            sanitizeForFirestore({
              ...session,
              createdAt,
              updatedAt: serverTimestamp(),
            })
          ),
        "tika"
      );

      return session;
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to save session:", error);
      throw new TikaSessionError("Failed to save conversation", "NETWORK");
    }
  }

  async getSession(sessionId: string): Promise<TikaSession | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return null;
      }
      return this.mapDocToSession(docSnap.data(), sessionId);
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to get session:", error);
      throw new TikaSessionError("Failed to load conversation", "NETWORK");
    }
  }

  async listSessions(
    options?: TikaSessionQueryOptions
  ): Promise<TikaSessionPreview[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserTikaConversationsPath(userId)
    );

    const sortDir = options?.sortDirection ?? "desc";
    const limitCount = options?.limit ?? TIKA_LIMITS.DEFAULT_QUERY_LIMIT;

    const q = query(
      collectionRef,
      orderBy("updatedAt", sortDir),
      firestoreLimit(limitCount)
    );

    try {
      const snapshot = await getDocs(q);
      const previews: TikaSessionPreview[] = [];

      snapshot.forEach((docSnap) => {
        previews.push(this.mapDocToPreview(docSnap.data(), docSnap.id));
      });

      return previews;
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to list sessions:", error);
      throw new TikaSessionError(
        "Failed to load conversation history",
        "NETWORK"
      );
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      await trackWrite(() => deleteDoc(docRef), "tika");
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to delete session:", error);
      throw new TikaSessionError("Failed to delete conversation", "NETWORK");
    }
  }

  subscribeToSessions(
    callback: (sessions: TikaSessionPreview[]) => void,
    options?: TikaSessionQueryOptions,
    onError?: (error: Error) => void
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    const sortDir = options?.sortDirection ?? "desc";
    const limitCount = options?.limit ?? TIKA_LIMITS.DEFAULT_QUERY_LIMIT;

    getFirestoreInstance()
      .then((firestore) => {
        const collectionRef = collection(
          firestore,
          getUserTikaConversationsPath(userId)
        );

        const q = query(
          collectionRef,
          orderBy("updatedAt", sortDir),
          firestoreLimit(limitCount)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const previews: TikaSessionPreview[] = [];
            snapshot.forEach((docSnap) => {
              previews.push(this.mapDocToPreview(docSnap.data(), docSnap.id));
            });
            callback(previews);
          },
          (error) => {
            console.error("[TikaSessionRepository] Subscription error:", error);
            onError?.(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        );
      })
      .catch((error) => {
        console.error(
          "[TikaSessionRepository] Failed to initialize subscription:",
          error
        );
        onError?.(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  async flagForReview(sessionId: string, flagged: boolean): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      if (flagged) {
        await trackWrite(
          () =>
            updateDoc(docRef, {
              flaggedForReview: true,
              flaggedAt: serverTimestamp(),
              reviewStatus: "pending",
              reviewMetadata: null,
            }),
          "tika"
        );
      } else {
        await trackWrite(
          () =>
            updateDoc(docRef, {
              flaggedForReview: false,
              flaggedAt: null,
              reviewStatus: null,
              reviewMetadata: null,
            }),
          "tika"
        );
      }
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to flag session:", error);
      throw new TikaSessionError(
        "Failed to flag conversation for review",
        "NETWORK"
      );
    }
  }

  async getFlaggedSessions(): Promise<TikaSession[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserTikaConversationsPath(userId)
    );

    const q = query(
      collectionRef,
      where("flaggedForReview", "==", true),
      orderBy("flaggedAt", "desc")
    );

    try {
      const snapshot = await getDocs(q);
      const sessions: TikaSession[] = [];

      snapshot.forEach((docSnap) => {
        sessions.push(this.mapDocToSession(docSnap.data(), docSnap.id));
      });

      return sessions;
    } catch (error) {
      console.error(
        "[TikaSessionRepository] Failed to get flagged sessions:",
        error
      );
      throw new TikaSessionError(
        "Failed to load flagged conversations",
        "NETWORK"
      );
    }
  }

  async getReviewQueue(
    options?: ReviewQueueQueryOptions
  ): Promise<TikaSession[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserTikaConversationsPath(userId)
    );

    const constraints = [];

    if (options?.status) {
      const statuses = Array.isArray(options.status)
        ? options.status
        : [options.status];
      if (statuses.length === 1) {
        constraints.push(where("reviewStatus", "==", statuses[0]));
      } else {
        constraints.push(where("reviewStatus", "in", statuses));
      }
    } else {
      // Default: get all items that have a review status (i.e., flagged items)
      constraints.push(where("flaggedForReview", "==", true));
    }

    constraints.push(orderBy("flaggedAt", "desc"));

    if (options?.limit) {
      constraints.push(firestoreLimit(options.limit));
    }

    const q = query(collectionRef, ...constraints);

    try {
      const snapshot = await getDocs(q);
      const sessions: TikaSession[] = [];

      snapshot.forEach((docSnap) => {
        sessions.push(this.mapDocToSession(docSnap.data(), docSnap.id));
      });

      return sessions;
    } catch (error) {
      console.error(
        "[TikaSessionRepository] Failed to get review queue:",
        error
      );
      throw new TikaSessionError("Failed to load review queue", "NETWORK");
    }
  }

  async claimForReview(
    sessionId: string,
    claimedBy: string
  ): Promise<TikaSession | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      // Use transaction for atomic claim
      const result = await runTransaction(firestore, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          throw new TikaSessionError("Session not found", "NOT_FOUND");
        }

        const data = docSnap.data();

        // Check if already claimed by someone else
        if (
          data.reviewStatus === "claimed" &&
          data.reviewMetadata?.claimedBy !== claimedBy
        ) {
          return null;
        }

        const reviewMetadata = {
          ...data.reviewMetadata,
          claimedAt: serverTimestamp(),
          claimedBy,
        };

        transaction.update(docRef, {
          reviewStatus: "claimed",
          reviewMetadata: sanitizeForFirestore(reviewMetadata),
        });

        return this.mapDocToSession(
          {
            ...data,
            reviewStatus: "claimed",
            reviewMetadata: { ...reviewMetadata, claimedAt: new Date() },
          },
          sessionId
        );
      });

      return result;
    } catch (error) {
      if (error instanceof TikaSessionError) throw error;
      console.error("[TikaSessionRepository] Failed to claim session:", error);
      throw new TikaSessionError(
        "Failed to claim session for review",
        "NETWORK"
      );
    }
  }

  async submitReview(
    sessionId: string,
    result: ReviewResult
  ): Promise<TikaSession> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new TikaSessionError("Session not found", "NOT_FOUND");
      }

      const data = docSnap.data();
      const existingMetadata = data.reviewMetadata || {};

      let newStatus: ReviewStatus;
      if (result.autoApprove) {
        newStatus = "approved";
      } else if (result.correctedResponse) {
        newStatus = "needs-correction";
      } else {
        newStatus = "in-review"; // Needs human review
      }

      const updatedMetadata: ReviewMetadata = {
        ...existingMetadata,
        grade: result.grade,
        confidence: result.confidence,
        aiNotes: result.notes,
        correctedResponse: result.correctedResponse,
        reviewedAt: new Date(),
      };

      await trackWrite(
        () =>
          updateDoc(docRef, {
            reviewStatus: newStatus,
            reviewMetadata: sanitizeForFirestore(updatedMetadata),
          }),
        "tika"
      );

      return this.mapDocToSession(
        {
          ...data,
          reviewStatus: newStatus,
          reviewMetadata: updatedMetadata,
        },
        sessionId
      );
    } catch (error) {
      if (error instanceof TikaSessionError) throw error;
      console.error("[TikaSessionRepository] Failed to submit review:", error);
      throw new TikaSessionError("Failed to submit review", "NETWORK");
    }
  }

  async addReviewNotes(sessionId: string, notes: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new TikaSessionError("Session not found", "NOT_FOUND");
      }

      const data = docSnap.data();
      const existingMetadata = data.reviewMetadata || {};

      await updateDoc(docRef, {
        reviewMetadata: sanitizeForFirestore({
          ...existingMetadata,
          notes,
        }),
      });
    } catch (error) {
      if (error instanceof TikaSessionError) throw error;
      console.error(
        "[TikaSessionRepository] Failed to add review notes:",
        error
      );
      throw new TikaSessionError("Failed to add review notes", "NETWORK");
    }
  }

  async updateReviewStatus(
    sessionId: string,
    status: ReviewStatus
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      await updateDoc(docRef, {
        reviewStatus: status,
      });
    } catch (error) {
      console.error(
        "[TikaSessionRepository] Failed to update review status:",
        error
      );
      throw new TikaSessionError("Failed to update review status", "NETWORK");
    }
  }

  async archiveReview(sessionId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, sessionId)
    );

    try {
      await updateDoc(docRef, {
        reviewStatus: "archived",
        flaggedForReview: false,
      });
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to archive review:", error);
      throw new TikaSessionError("Failed to archive review", "NETWORK");
    }
  }
}
