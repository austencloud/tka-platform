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
  collectionGroup,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import type { UIMessage } from "ai";
import type { ITikaSessionRepository } from "../contracts/ITikaSessionRepository";
import {
  createTikaSession,
  sanitizeForFirestore,
  type TikaSession,
  type TikaSessionPreview,
  type TikaSessionQueryOptions,
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
  /**
   * Get the current user ID or throw if not authenticated
   */
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new TikaSessionError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Convert Firestore timestamp to Date
   */
  private toDate(timestamp: unknown): Date {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  /**
   * Map Firestore document to TikaSession
   */
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
    };
  }

  /**
   * Map Firestore document to TikaSessionPreview (excludes messages)
   */
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
    };
  }

  async saveSession(
    sessionId: string | undefined,
    messages: UIMessage[]
  ): Promise<TikaSession> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    // Create or update session data
    const session = createTikaSession(userId, messages, sessionId);
    const docRef = doc(
      firestore,
      getUserTikaConversationPath(userId, session.id)
    );

    // Check if this is an update (preserve original createdAt)
    let createdAt = serverTimestamp();
    if (sessionId) {
      try {
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          createdAt = existingDoc.data().createdAt || serverTimestamp();
        }
      } catch {
        // If we can't read the existing doc, use current time
      }
    }

    try {
      await setDoc(
        docRef,
        sanitizeForFirestore({
          ...session,
          createdAt,
          updatedAt: serverTimestamp(),
        })
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
      throw new TikaSessionError("Failed to load conversation history", "NETWORK");
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
      await deleteDoc(docRef);
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to delete session:", error);
      throw new TikaSessionError("Failed to delete conversation", "NETWORK");
    }
  }

  subscribeToSessions(
    callback: (sessions: TikaSessionPreview[]) => void,
    options?: TikaSessionQueryOptions
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    const sortDir = options?.sortDirection ?? "desc";
    const limitCount = options?.limit ?? TIKA_LIMITS.DEFAULT_QUERY_LIMIT;

    // Initialize subscription asynchronously
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
            console.error(
              "[TikaSessionRepository] Subscription error:",
              error
            );
          }
        );
      })
      .catch((error) => {
        console.error(
          "[TikaSessionRepository] Failed to initialize subscription:",
          error
        );
      });

    // Return cleanup function
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
        await updateDoc(docRef, {
          flaggedForReview: true,
          flaggedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, {
          flaggedForReview: false,
          flaggedAt: null,
        });
      }
    } catch (error) {
      console.error("[TikaSessionRepository] Failed to flag session:", error);
      throw new TikaSessionError("Failed to flag conversation for review", "NETWORK");
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
      console.error("[TikaSessionRepository] Failed to get flagged sessions:", error);
      throw new TikaSessionError("Failed to load flagged conversations", "NETWORK");
    }
  }
}
