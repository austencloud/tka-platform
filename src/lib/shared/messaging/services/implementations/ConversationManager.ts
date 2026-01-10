/**
 * ConversationManager
 *
 * Manages conversations between users with real-time Firestore subscriptions.
 */

import type { Timestamp } from "firebase/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type {
  Conversation,
  ConversationPreview,
  ConversationFetchOptions,
  GetOrCreateConversationResult,
  ParticipantInfo,
} from "../../domain/models/conversation-models";
import type { IConversationManager } from "../contracts/IConversationManager";

const CONVERSATIONS_COLLECTION = "conversations";

export class ConversationManager implements IConversationManager {
  private conversationsUnsubscribe: (() => void) | null = null;
  private unreadCountUnsubscribe: (() => void) | null = null;

  /**
   * Get the current user ID or throw if not authenticated.
   * Supports both preview mode (View As) and legacy impersonation.
   */
  private getCurrentUserId(): string {
    // Check preview mode first (View As feature)
    if (userPreviewState.isActive && userPreviewState.data.profile) {
      return userPreviewState.data.profile.uid;
    }
    // Fall back to authState (handles legacy impersonation too)
    const userId = authState.user?.uid;
    if (!userId) {
      console.error("[ConversationManager] No authenticated user found", {
        previewActive: userPreviewState.isActive,
        hasAuthUser: !!authState.user,
      });
      throw new Error("User must be authenticated to access conversations");
    }
    return userId;
  }

  /**
   * Get effective user info (supports preview mode and legacy impersonation).
   * Returns preview user info when in View As mode, otherwise actual user.
   */
  private getEffectiveUserInfo(): {
    uid: string;
    displayName: string;
    photoURL: string | null;
  } {
    // Check preview mode first (View As feature)
    if (userPreviewState.isActive && userPreviewState.data.profile) {
      const profile = userPreviewState.data.profile;
      return {
        uid: profile.uid,
        displayName: profile.displayName || "Unknown User",
        photoURL: profile.photoURL || null,
      };
    }
    // Fall back to actual auth user
    const user = authState.user;
    if (!user) {
      throw new Error("User must be authenticated");
    }
    return {
      uid: user.uid,
      displayName: user.displayName || "Unknown User",
      photoURL: user.photoURL,
    };
  }

  /**
   * Fetch basic user info from Firestore
   */
  private async fetchUserInfo(
    userId: string
  ): Promise<{ displayName: string; photoURL?: string }> {
    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, "users", userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          displayName:
            data["displayName"] || data["username"] || "Unknown User",
          photoURL: data["photoURL"] || undefined,
        };
      }
    } catch (error) {
      console.error("[ConversationManager] Failed to fetch user info:", error);
    }
    return { displayName: "Unknown User" };
  }

  /**
   * Generate a deterministic conversation ID from two user IDs
   */
  private generateConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Get or create a conversation between current user and another user
   */
  async getOrCreateConversation(
    otherUserId: string
  ): Promise<GetOrCreateConversationResult> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationId = this.generateConversationId(
        currentUserId,
        otherUserId
      );

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      const existingDoc = await getDoc(conversationRef);

      if (existingDoc.exists()) {
        return {
          conversation: this.mapDocToConversation(
            existingDoc.id,
            existingDoc.data()
          ),
          isNew: false,
        };
      }

      // Create new conversation
      const effectiveUser = this.getEffectiveUserInfo();
      const otherUserInfo = await this.fetchUserInfo(otherUserId);
      const now = new Date();
      const participants = [currentUserId, otherUserId].sort();

      const participantInfo: Record<string, ParticipantInfo> = {
        [currentUserId]: {
          userId: currentUserId,
          displayName: effectiveUser.displayName,
          ...(effectiveUser.photoURL && { avatar: effectiveUser.photoURL }),
          joinedAt: now,
        },
        [otherUserId]: {
          userId: otherUserId,
          displayName: otherUserInfo.displayName,
          ...(otherUserInfo.photoURL && { avatar: otherUserInfo.photoURL }),
          joinedAt: now,
        },
      };

      const newConversation: Omit<Conversation, "id"> = {
        participants,
        participantInfo,
        unreadCount: { [currentUserId]: 0, [otherUserId]: 0 },
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(conversationRef, {
        ...newConversation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        conversation: { id: conversationId, ...newConversation },
        isNew: true,
      };
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to get or create conversation:",
        error
      );
      toast.error("Failed to start conversation.");
      throw error;
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const firestore = await getFirestoreInstance();
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      const snapshot = await getDoc(conversationRef);

      if (!snapshot.exists()) {
        return null;
      }

      return this.mapDocToConversation(snapshot.id, snapshot.data());
    } catch (error) {
      console.error("[ConversationManager] Failed to get conversation:", error);
      toast.error("Failed to load conversation.");
      return null;
    }
  }

  /**
   * Get current user's conversations (inbox list)
   */
  async getConversations(
    options?: ConversationFetchOptions
  ): Promise<ConversationPreview[]> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const maxCount = options?.limit ?? 50;

      const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
      const q = query(
        conversationsRef,
        where("participants", "array-contains", currentUserId),
        orderBy("updatedAt", "desc"),
        limit(maxCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((docSnap) =>
          this.mapDocToPreview(docSnap.id, docSnap.data(), currentUserId)
        )
        .filter((preview): preview is ConversationPreview => preview !== null);
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to get conversations:",
        error
      );
      toast.error("Failed to load conversations.");
      return [];
    }
  }

  /**
   * Subscribe to real-time updates of user's conversation list
   */
  subscribeToConversations(
    callback: (conversations: ConversationPreview[]) => void
  ): () => void {
    // Clean up previous subscription
    if (this.conversationsUnsubscribe) {
      this.conversationsUnsubscribe();
    }

    const currentUserId = this.getCurrentUserId();

    // Use async IIFE to get firestore instance
    (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const conversationsRef = collection(
          firestore,
          CONVERSATIONS_COLLECTION
        );
        const q = query(
          conversationsRef,
          where("participants", "array-contains", currentUserId),
          orderBy("updatedAt", "desc"),
          limit(50)
        );

        this.conversationsUnsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const conversations = snapshot.docs
              .map((docSnap) =>
                this.mapDocToPreview(docSnap.id, docSnap.data(), currentUserId)
              )
              .filter(
                (preview): preview is ConversationPreview => preview !== null
              );
            callback(conversations);
          },
          (error) => {
            console.error(
              "[ConversationManager] Conversations subscription error:",
              error
            );
            toast.error("Lost connection to messages. Please refresh.");
          }
        );
      } catch (error) {
        console.error(
          "[ConversationManager] Failed to initialize conversations subscription:",
          error
        );
        toast.error("Failed to connect to messages.");
      }
    })();

    return () => {
      if (this.conversationsUnsubscribe) {
        this.conversationsUnsubscribe();
        this.conversationsUnsubscribe = null;
      }
    };
  }

  /**
   * Get total unread message count across all conversations
   */
  async getTotalUnreadCount(): Promise<number> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
      const q = query(
        conversationsRef,
        where("participants", "array-contains", currentUserId)
      );

      const snapshot = await getDocs(q);
      let total = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const unreadCount = data["unreadCount"] as
          | Record<string, number>
          | undefined;
        if (unreadCount?.[currentUserId]) {
          total += unreadCount[currentUserId];
        }
      });

      return total;
    } catch (error) {
      console.error("[ConversationManager] Failed to get unread count:", error);
      return 0;
    }
  }

  /**
   * Subscribe to total unread count changes
   */
  subscribeToUnreadCount(callback: (count: number) => void): () => void {
    // Clean up previous subscription
    if (this.unreadCountUnsubscribe) {
      this.unreadCountUnsubscribe();
    }

    const currentUserId = this.getCurrentUserId();

    // Use async IIFE to get firestore instance
    (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const conversationsRef = collection(
          firestore,
          CONVERSATIONS_COLLECTION
        );
        const q = query(
          conversationsRef,
          where("participants", "array-contains", currentUserId)
        );

        this.unreadCountUnsubscribe = onSnapshot(
          q,
          (snapshot) => {
            let total = 0;
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const unreadCount = data["unreadCount"] as
                | Record<string, number>
                | undefined;
              if (unreadCount?.[currentUserId]) {
                total += unreadCount[currentUserId];
              }
            });
            callback(total);
          },
          (error) => {
            console.error(
              "[ConversationManager] Unread count subscription error:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "[ConversationManager] Failed to initialize unread count subscription:",
          error
        );
      }
    })();

    return () => {
      if (this.unreadCountUnsubscribe) {
        this.unreadCountUnsubscribe();
        this.unreadCountUnsubscribe = null;
      }
    };
  }

  /**
   * Check if a conversation exists between current user and another user
   */
  async conversationExists(otherUserId: string): Promise<string | null> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationId = this.generateConversationId(
        currentUserId,
        otherUserId
      );
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      const snapshot = await getDoc(conversationRef);
      return snapshot.exists() ? conversationId : null;
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to check conversation exists:",
        error
      );
      return null;
    }
  }

  /**
   * Archive a conversation (future implementation)
   */
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      await updateDoc(conversationRef, {
        [`archived.${currentUserId}`]: true,
      });
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to archive conversation:",
        error
      );
      toast.error("Failed to archive conversation.");
      throw error;
    }
  }

  /**
   * Unarchive a conversation (future implementation)
   */
  async unarchiveConversation(conversationId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      await updateDoc(conversationRef, {
        [`archived.${currentUserId}`]: false,
      });
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to unarchive conversation:",
        error
      );
      toast.error("Failed to unarchive conversation.");
      throw error;
    }
  }

  /**
   * Mark all conversations as read for current user
   */
  async markAllAsRead(): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
      const q = query(
        conversationsRef,
        where("participants", "array-contains", currentUserId)
      );

      const snapshot = await getDocs(q);
      const updates = snapshot.docs
        .filter((docSnap) => {
          const data = docSnap.data();
          const unreadCount =
            (data["unreadCount"] as Record<string, number>) || {};
          return (unreadCount[currentUserId] || 0) > 0;
        })
        .map((docSnap) =>
          updateDoc(docSnap.ref, {
            [`unreadCount.${currentUserId}`]: 0,
          })
        );

      await Promise.all(updates);
    } catch (error) {
      console.error("[ConversationManager] Failed to mark all as read:", error);
      toast.error("Failed to mark messages as read.");
      throw error;
    }
  }

  /**
   * Map Firestore document to Conversation
   */
  private mapDocToConversation(
    id: string,
    data: Record<string, unknown>
  ): Conversation {
    // Convert lastMessage.createdAt from Timestamp to Date
    const rawLastMessage = data["lastMessage"] as
      | Record<string, unknown>
      | undefined;
    const lastMessage = rawLastMessage
      ? {
          content: rawLastMessage["content"] as string,
          senderId: rawLastMessage["senderId"] as string,
          senderName: rawLastMessage["senderName"] as string,
          createdAt:
            (rawLastMessage["createdAt"] as Timestamp)?.toDate() || new Date(),
          hasAttachment: rawLastMessage["hasAttachment"] as boolean | undefined,
        }
      : undefined;

    return {
      id,
      participants: data["participants"] as string[],
      participantInfo: data["participantInfo"] as Record<
        string,
        ParticipantInfo
      >,
      lastMessage,
      unreadCount: (data["unreadCount"] as Record<string, number>) || {},
      createdAt: (data["createdAt"] as Timestamp)?.toDate() || new Date(),
      updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
    };
  }

  /**
   * Map Firestore document to ConversationPreview
   */
  private mapDocToPreview(
    id: string,
    data: Record<string, unknown>,
    currentUserId: string
  ): ConversationPreview | null {
    const participants = data["participants"] as string[];
    const otherUserId = participants.find((p) => p !== currentUserId) || "";
    const participantInfo = data["participantInfo"] as Record<
      string,
      ParticipantInfo
    >;
    const unreadCount = (data["unreadCount"] as Record<string, number>) || {};

    // Filter out self-conversations (user messaging themselves)
    if (!otherUserId || otherUserId === currentUserId) {
      return null;
    }

    const otherParticipant = participantInfo[otherUserId] || {
      userId: otherUserId,
      displayName: "Unknown User",
      joinedAt: new Date(),
    };

    // If displayName is "Loading...", trigger a background update
    if (otherParticipant.displayName === "Loading...") {
      this.refreshParticipantInfo(id, otherUserId);
    }

    // Convert lastMessage.createdAt from Timestamp to Date
    const rawLastMessage = data["lastMessage"] as
      | Record<string, unknown>
      | undefined;
    const lastMessage = rawLastMessage
      ? {
          content: rawLastMessage["content"] as string,
          senderId: rawLastMessage["senderId"] as string,
          senderName: rawLastMessage["senderName"] as string,
          createdAt:
            (rawLastMessage["createdAt"] as Timestamp)?.toDate() || new Date(),
          hasAttachment: rawLastMessage["hasAttachment"] as boolean | undefined,
        }
      : undefined;

    return {
      id,
      otherParticipant,
      lastMessage,
      unreadCount: unreadCount[currentUserId] || 0,
      updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
    };
  }

  /**
   * Refresh participant info for a conversation (background update)
   */
  private async refreshParticipantInfo(
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userInfo = await this.fetchUserInfo(userId);
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      await updateDoc(conversationRef, {
        [`participantInfo.${userId}.displayName`]: userInfo.displayName,
        ...(userInfo.photoURL && {
          [`participantInfo.${userId}.avatar`]: userInfo.photoURL,
        }),
      });
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to refresh participant info:",
        error
      );
    }
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    if (this.conversationsUnsubscribe) {
      this.conversationsUnsubscribe();
      this.conversationsUnsubscribe = null;
    }
    if (this.unreadCountUnsubscribe) {
      this.unreadCountUnsubscribe();
      this.unreadCountUnsubscribe = null;
    }
  }
}

// Export singleton instance
export const conversationService = new ConversationManager();
