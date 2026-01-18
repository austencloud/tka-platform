/**
 * TIKASessionRepository - Firebase Implementation
 *
 * Handles CRUD operations for TIKA conversation sessions in Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import type { UIMessage } from "ai";
import type { ITIKASessionRepository } from "../contracts/ITIKASessionRepository";
import type {
  TIKASession,
  TIKASessionPreview,
  TIKASessionQueryOptions,
} from "../../domain/models/tika-conversation-models";
import { createTIKASession } from "../../domain/models/tika-conversation-models";
import {
  getUserTIKAConversationsPath,
  getUserTIKAConversationPath,
  TIKA_LIMITS,
} from "../../data/firestore-paths";

/**
 * Error class for TIKA session operations
 */
export class TIKASessionError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAUTHORIZED" | "NETWORK"
  ) {
    super(message);
    this.name = "TIKASessionError";
  }
}

export class TIKASessionRepository implements ITIKASessionRepository {
  /**
   * Get the current user ID or throw if not authenticated
   */
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new TIKASessionError("User not authenticated", "UNAUTHORIZED");
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
   * Map Firestore document to TIKASession
   */
  private mapDocToSession(data: DocumentData, id: string): TIKASession {
    return {
      id,
      userId: data.userId || "",
      title: data.title || "Untitled",
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      messageCount: data.messageCount || 0,
      lastUserMessage: data.lastUserMessage || "",
      messages: data.messages || [],
    };
  }

  /**
   * Map Firestore document to TIKASessionPreview (excludes messages)
   */
  private mapDocToPreview(data: DocumentData, id: string): TIKASessionPreview {
    return {
      id,
      title: data.title || "Untitled",
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      messageCount: data.messageCount || 0,
      lastUserMessage: data.lastUserMessage || "",
    };
  }

  async saveSession(
    sessionId: string | undefined,
    messages: UIMessage[]
  ): Promise<TIKASession> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    // Create or update session data
    const session = createTIKASession(userId, messages, sessionId);
    const docRef = doc(
      firestore,
      getUserTIKAConversationPath(userId, session.id)
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
      await setDoc(docRef, {
        ...session,
        createdAt,
        updatedAt: serverTimestamp(),
      });

      return session;
    } catch (error) {
      console.error("[TIKASessionRepository] Failed to save session:", error);
      throw new TIKASessionError("Failed to save conversation", "NETWORK");
    }
  }

  async getSession(sessionId: string): Promise<TIKASession | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTIKAConversationPath(userId, sessionId)
    );

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return null;
      }
      return this.mapDocToSession(docSnap.data(), sessionId);
    } catch (error) {
      console.error("[TIKASessionRepository] Failed to get session:", error);
      throw new TIKASessionError("Failed to load conversation", "NETWORK");
    }
  }

  async listSessions(
    options?: TIKASessionQueryOptions
  ): Promise<TIKASessionPreview[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const collectionRef = collection(
      firestore,
      getUserTIKAConversationsPath(userId)
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
      const previews: TIKASessionPreview[] = [];

      snapshot.forEach((docSnap) => {
        previews.push(this.mapDocToPreview(docSnap.data(), docSnap.id));
      });

      return previews;
    } catch (error) {
      console.error("[TIKASessionRepository] Failed to list sessions:", error);
      throw new TIKASessionError("Failed to load conversation history", "NETWORK");
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    const docRef = doc(
      firestore,
      getUserTIKAConversationPath(userId, sessionId)
    );

    try {
      await deleteDoc(docRef);
    } catch (error) {
      console.error("[TIKASessionRepository] Failed to delete session:", error);
      throw new TIKASessionError("Failed to delete conversation", "NETWORK");
    }
  }

  subscribeToSessions(
    callback: (sessions: TIKASessionPreview[]) => void,
    options?: TIKASessionQueryOptions
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
          getUserTIKAConversationsPath(userId)
        );

        const q = query(
          collectionRef,
          orderBy("updatedAt", sortDir),
          firestoreLimit(limitCount)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const previews: TIKASessionPreview[] = [];
            snapshot.forEach((docSnap) => {
              previews.push(this.mapDocToPreview(docSnap.data(), docSnap.id));
            });
            callback(previews);
          },
          (error) => {
            console.error(
              "[TIKASessionRepository] Subscription error:",
              error
            );
          }
        );
      })
      .catch((error) => {
        console.error(
          "[TIKASessionRepository] Failed to initialize subscription:",
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
}
