/**
 * Messenger
 *
 * Handles sending, fetching, and real-time subscription to messages.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  startAfter,
  getDoc,
  writeBatch,
  increment,
  runTransaction,
  startAt,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  authState,
  getEffectiveUserId,
} from "$lib/shared/auth/state/auth-state.svelte";
import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/is-permission-denied-error";
// Note: Message notifications removed - messages and notifications share same inbox panel
import type {
  Message,
  CreateMessageInput,
  MessageFetchOptions,
  MessagePreview,
  MessageReaction,
  MessageEdit,
} from "../domain/models/message-models";
import {
  buildReplyPreview,
  getMessagePreviewText,
} from "../domain/message-preview";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";

// Typing indicator timeout (3 seconds of inactivity = not typing)
const TYPING_TIMEOUT_MS = 3000;

// Message constraints
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_INTERVAL_MS = 500;

export class Messenger {
  private messageSubscriptions = new Map<string, () => void>();
  private typingSubscriptions = new Map<string, () => void>();
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private lastMessageTime = 0;

  /**
   * Get the current user ID or throw if not authenticated.
   * Uses getEffectiveUserId which handles both preview mode and actual auth.
   */
  private getCurrentUserId(): string {
    const userId = getEffectiveUserId();
    if (!userId) {
      // Provide more context in the error for debugging
      const isInitialized = authState.initialized;
      const isLoading = authState.loading;
      console.error(
        `[Messenger] Auth state: initialized=${isInitialized}, loading=${isLoading}`
      );
      throw new Error(
        isLoading
          ? "Authentication still loading. Please wait and try again."
          : "User must be authenticated to send messages"
      );
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
   * Send a new message in a conversation
   */
  async sendMessage(input: CreateMessageInput): Promise<Message> {
    try {
      const {
        conversationId,
        content,
        attachments,
        replyTo: requestedReply,
      } = input;
      const normalizedContent = content.trim();

      // Rate limiting - prevent spam
      const now = Date.now();
      if (now - this.lastMessageTime < MIN_MESSAGE_INTERVAL_MS) {
        throw new Error("Please wait before sending another message");
      }
      this.lastMessageTime = now;

      // Content validation
      if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
          `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`
        );
      }
      if (attachments && attachments.length > 1) {
        throw new Error("Messages support one attachment at a time");
      }
      if (!normalizedContent && !attachments?.length) {
        throw new Error("Message cannot be empty");
      }
      if (attachments?.some((attachment) => attachment.type === "image")) {
        throw new Error("Image messages must use the private image sender");
      }

      const firestore = await getFirestoreInstance();
      const effectiveUser = this.getEffectiveUserInfo();

      // Validate conversation exists and user is a participant
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        throw new Error("Conversation not found");
      }

      const conversationData = conversationSnap.data();
      const participants = conversationData["participants"] as string[];

      if (!participants.includes(effectiveUser.uid)) {
        throw new Error("User is not a participant in this conversation");
      }

      // Display fields in a quote are not trusted input. Resolve the message in
      // this conversation immediately before sending so edits and attachment
      // context cannot leave a forged or stale reply behind.
      let replyTo: Message["replyTo"];
      if (requestedReply) {
        const replySnapshot = await getDoc(
          doc(
            firestore,
            CONVERSATIONS_COLLECTION,
            conversationId,
            MESSAGES_SUBCOLLECTION,
            requestedReply.messageId
          )
        );
        if (
          !replySnapshot.exists() ||
          replySnapshot.data()["isDeleted"] === true
        ) {
          throw new Error("The original message is no longer available");
        }
        replyTo = buildReplyPreview(
          this.mapDocToMessage(
            replySnapshot.id,
            conversationId,
            replySnapshot.data()
          )
        );
      }

      // Create the message
      const messagesRef = collection(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION
      );

      const messageData = {
        senderId: effectiveUser.uid,
        senderName: effectiveUser.displayName,
        senderAvatar: effectiveUser.photoURL,
        content: normalizedContent,
        createdAt: serverTimestamp(),
        readBy: [effectiveUser.uid], // Sender has read their own message
        attachments: attachments || null,
        isDeleted: false,
        replyTo: replyTo || null,
        reactions: null,
        editHistory: null,
      };

      const messageRef = doc(messagesRef);

      // Update conversation with last message and increment unread count for ALL other participants
      const otherUserIds = participants.filter((p) => p !== effectiveUser.uid);
      const lastMessage: MessagePreview = {
        messageId: messageRef.id,
        content: getMessagePreviewText(normalizedContent, attachments),
        senderId: effectiveUser.uid,
        senderName: effectiveUser.displayName,
        createdAt: new Date(),
        hasAttachment: !!(attachments && attachments.length > 0),
      };

      const batch = writeBatch(firestore);

      const unreadUpdates: Record<string, ReturnType<typeof increment>> = {};
      for (const userId of otherUserIds) {
        unreadUpdates[`unreadCount.${userId}`] = increment(1);
      }

      batch.set(messageRef, messageData);
      batch.update(conversationRef, {
        lastMessage,
        updatedAt: serverTimestamp(),
        ...unreadUpdates,
      });

      await batch.commit();

      // Note: No in-app notification created - messages tab shows unread badge instead

      return {
        id: messageRef.id,
        conversationId,
        senderId: effectiveUser.uid,
        senderName: effectiveUser.displayName,
        senderAvatar: effectiveUser.photoURL || undefined,
        content: normalizedContent,
        createdAt: new Date(),
        readBy: [effectiveUser.uid],
        attachments,
        replyTo,
      };
    } catch (error) {
      console.error("[Messenger] Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      throw error;
    }
  }

  /**
   * Send a message with just content (convenience method)
   */
  async sendTextMessage(
    conversationId: string,
    content: string
  ): Promise<Message> {
    return this.sendMessage({ conversationId, content });
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    options?: MessageFetchOptions
  ): Promise<Message[]> {
    try {
      const firestore = await getFirestoreInstance();
      const maxCount = options?.limit ?? 50;

      const messagesRef = collection(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION
      );

      let q = query(messagesRef, orderBy("createdAt", "desc"), limit(maxCount));

      // Handle cursor-based pagination
      if (options?.beforeId) {
        const beforeDoc = await getDoc(
          doc(
            firestore,
            CONVERSATIONS_COLLECTION,
            conversationId,
            MESSAGES_SUBCOLLECTION,
            options.beforeId
          )
        );
        if (beforeDoc.exists()) {
          q = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            startAfter(beforeDoc),
            limit(maxCount)
          );
        }
      }

      const snapshot = await getDocs(q);

      return snapshot.docs
        .map((docSnap) =>
          this.mapDocToMessage(docSnap.id, conversationId, docSnap.data())
        )
        .reverse(); // Return in chronological order
    } catch (error) {
      console.error("[Messenger] Failed to get messages:", error);
      toast.error("Failed to load messages.");
      return [];
    }
  }

  /**
   * Load a bounded window around one message. Reply navigation uses this when
   * the source is older than the live 100-message subscription.
   */
  async getMessageContext(
    conversationId: string,
    messageId: string,
    radius = 25
  ): Promise<Message[]> {
    try {
      const firestore = await getFirestoreInstance();
      const messagesRef = collection(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION
      );
      const targetRef = doc(messagesRef, messageId);
      const targetSnapshot = await getDoc(targetRef);
      if (!targetSnapshot.exists()) return [];

      const [olderSnapshot, newerSnapshot] = await Promise.all([
        getDocs(
          query(
            messagesRef,
            orderBy("createdAt", "desc"),
            startAt(targetSnapshot),
            limit(radius + 1)
          )
        ),
        getDocs(
          query(
            messagesRef,
            orderBy("createdAt", "asc"),
            startAfter(targetSnapshot),
            limit(radius)
          )
        ),
      ]);

      return [...olderSnapshot.docs.reverse(), ...newerSnapshot.docs].map(
        (snapshot) =>
          this.mapDocToMessage(snapshot.id, conversationId, snapshot.data())
      );
    } catch (error) {
      console.error("[Messenger] Failed to locate reply target:", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time message updates for a conversation
   */
  subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    // Clean up previous subscription for this conversation
    const existingUnsubscribe = this.messageSubscriptions.get(conversationId);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    // Use async IIFE to get firestore instance
    (async () => {
      try {
        const firestore = await getFirestoreInstance();

        const messagesRef = collection(
          firestore,
          CONVERSATIONS_COLLECTION,
          conversationId,
          MESSAGES_SUBCOLLECTION
        );

        const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100));

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const messages = snapshot.docs
              .map((docSnap) =>
                this.mapDocToMessage(docSnap.id, conversationId, docSnap.data())
              )
              .reverse(); // Chronological order
            callback(messages);
          },
          (error) => {
            // Expected when the user signs out - Firestore revokes access and
            // this listener is about to be torn down by the auth listener.
            // Don't alarm the user with a "lost connection" toast.
            if (isPermissionDeniedError(error)) return;
            console.error("[Messenger] Messages subscription error:", error);
            toast.error("Lost connection to messages. Please refresh.");
          }
        );

        this.messageSubscriptions.set(conversationId, unsubscribe);
      } catch (error) {
        console.error(
          "[Messenger] Failed to initialize messages subscription:",
          error
        );
        toast.error("Failed to connect to messages.");
      }
    })();

    // Return a cleanup function that will unsubscribe when ready
    return () => {
      const unsubscribe = this.messageSubscriptions.get(conversationId);
      if (unsubscribe) {
        unsubscribe();
        this.messageSubscriptions.delete(conversationId);
      }
    };
  }

  /**
   * Mark all messages in a conversation as read for the current user
   */
  async markAsRead(conversationId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      // Reset unread count for current user in conversation
      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      await updateDoc(conversationRef, {
        [`unreadCount.${currentUserId}`]: 0,
      });

      // Mark all unread messages as read
      const messagesRef = collection(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION
      );

      const snapshot = await getDocs(messagesRef);
      const batch = writeBatch(firestore);

      const now = serverTimestamp();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const readBy = (data["readBy"] as string[]) || [];
        if (!readBy.includes(currentUserId)) {
          batch.update(docSnap.ref, {
            readBy: [...readBy, currentUserId],
            [`readAt.${currentUserId}`]: now,
          });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error("[Messenger] Failed to mark messages as read:", error);
      // Silent failure - don't interrupt user experience for read status
    }
  }

  /**
   * Mark a specific message as read
   */
  async markMessageAsRead(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      const messageRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION,
        messageId
      );

      const snapshot = await getDoc(messageRef);
      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.data();
      const readBy = (data["readBy"] as string[]) || [];

      if (!readBy.includes(currentUserId)) {
        await updateDoc(messageRef, {
          readBy: [...readBy, currentUserId],
          [`readAt.${currentUserId}`]: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("[Messenger] Failed to mark message as read:", error);
      // Silent failure - don't interrupt user experience for read status
    }
  }

  /**
   * Soft delete a message (sender only)
   */
  async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      const messageRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION,
        messageId
      );

      const snapshot = await getDoc(messageRef);
      if (!snapshot.exists()) {
        throw new Error("Message not found");
      }

      const data = snapshot.data();
      if (data["senderId"] !== currentUserId) {
        throw new Error("Only the sender can delete a message");
      }

      await updateDoc(messageRef, {
        isDeleted: true,
        content: "[Message deleted]",
      });
    } catch (error) {
      console.error("[Messenger] Failed to delete message:", error);
      toast.error("Failed to delete message.");
      throw error;
    }
  }

  /**
   * Edit a message (sender only, preserves edit history)
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    newContent: string
  ): Promise<Message> {
    try {
      const normalizedContent = newContent.trim();
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );
      const messageRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION,
        messageId
      );

      const updatedData = await runTransaction(
        firestore,
        async (transaction) => {
          const [messageSnapshot, conversationSnapshot] = await Promise.all([
            transaction.get(messageRef),
            transaction.get(conversationRef),
          ]);

          if (!messageSnapshot.exists()) {
            throw new Error("Message not found");
          }

          const data = messageSnapshot.data();
          if (data["senderId"] !== currentUserId) {
            throw new Error("Only the sender can edit a message");
          }
          if (data["isDeleted"] === true) {
            throw new Error("Deleted messages cannot be edited");
          }

          const attachments = data["attachments"] as Message["attachments"];
          if (!normalizedContent && !attachments?.length) {
            throw new Error("Message cannot be empty");
          }
          if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
            throw new Error(
              `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`
            );
          }

          const currentContent = data["content"] as string;
          if (normalizedContent === currentContent) {
            return data;
          }

          const editTimestamp = Timestamp.now();
          const existingHistory = Array.isArray(data["editHistory"])
            ? (data["editHistory"] as Array<{
                content: string;
                editedAt: Timestamp | Date;
              }>)
            : [];
          const newHistoryEntry = {
            content: currentContent,
            editedAt: editTimestamp,
          };
          const editHistory = [...existingHistory, newHistoryEntry];

          transaction.update(messageRef, {
            content: normalizedContent,
            editedAt: serverTimestamp(),
            editHistory,
          });

          const lastMessage = conversationSnapshot.data()?.["lastMessage"] as
            | Record<string, unknown>
            | undefined;
          if (lastMessage?.["messageId"] === messageId) {
            transaction.update(conversationRef, {
              "lastMessage.content": getMessagePreviewText(
                normalizedContent,
                attachments
              ),
            });
          }

          return {
            ...data,
            content: normalizedContent,
            editedAt: editTimestamp,
            editHistory,
          };
        }
      );

      return this.mapDocToMessage(messageId, conversationId, updatedData);
    } catch (error) {
      console.error("[Messenger] Failed to edit message:", error);
      throw error;
    }
  }

  /**
   * Map Firestore document to Message
   */
  private mapDocToMessage(
    id: string,
    conversationId: string,
    data: Record<string, unknown>
  ): Message {
    // Map edit history timestamps
    const rawEditHistory = data["editHistory"] as
      | Array<{ content: string; editedAt: Timestamp | Date }>
      | undefined;
    const editHistory: MessageEdit[] | undefined = rawEditHistory?.map(
      (entry) => ({
        content: entry.content,
        editedAt:
          entry.editedAt instanceof Timestamp
            ? entry.editedAt.toDate()
            : entry.editedAt,
      })
    );

    // Map readAt timestamps
    const rawReadAt = data["readAt"] as Record<string, Timestamp> | undefined;
    const readAt: Record<string, Date> | undefined = rawReadAt
      ? Object.fromEntries(
          Object.entries(rawReadAt).map(([userId, timestamp]) => [
            userId,
            timestamp instanceof Timestamp ? timestamp.toDate() : timestamp,
          ])
        )
      : undefined;

    return {
      id,
      conversationId,
      senderId: data["senderId"] as string,
      senderName: data["senderName"] as string,
      senderAvatar: data["senderAvatar"] as string | undefined,
      content: data["content"] as string,
      createdAt: (data["createdAt"] as Timestamp)?.toDate() || new Date(),
      editedAt: (data["editedAt"] as Timestamp)?.toDate(),
      readBy: (data["readBy"] as string[]) || [],
      readAt,
      attachments: data["attachments"] as Message["attachments"],
      isDeleted: data["isDeleted"] as boolean | undefined,
      reactions: data["reactions"] as MessageReaction[] | undefined,
      replyTo: data["replyTo"] as Message["replyTo"],
      editHistory,
    };
  }

  /**
   * Toggle a reaction on a message (add if not present, remove if already reacted)
   */
  async toggleReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      const messageRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId,
        MESSAGES_SUBCOLLECTION,
        messageId
      );

      const snapshot = await getDoc(messageRef);
      if (!snapshot.exists()) {
        throw new Error("Message not found");
      }

      const data = snapshot.data();
      const reactions = (data["reactions"] as MessageReaction[]) || [];

      // Find existing reaction with this emoji
      const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);
      const existingReaction =
        reactionIndex >= 0 ? reactions[reactionIndex] : null;

      if (existingReaction) {
        // Check if user already reacted
        const userIndex = existingReaction.userIds.indexOf(currentUserId);

        if (userIndex >= 0) {
          // Remove user from this reaction
          existingReaction.userIds.splice(userIndex, 1);

          // Remove entire reaction if no users left
          if (existingReaction.userIds.length === 0) {
            reactions.splice(reactionIndex, 1);
          }
        } else {
          // Add user to existing reaction
          existingReaction.userIds.push(currentUserId);
        }
      } else {
        // Create new reaction with this user
        reactions.push({ emoji, userIds: [currentUserId] });
      }

      await updateDoc(messageRef, { reactions });
    } catch (error) {
      console.error("[Messenger] Failed to toggle reaction:", error);
      toast.error("Failed to react to message.");
      throw error;
    }
  }

  /**
   * Set typing status for current user in a conversation
   */
  async setTyping(conversationId: string, isTyping: boolean): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      if (isTyping) {
        // Set typing timestamp
        await updateDoc(conversationRef, {
          [`typing.${currentUserId}`]: serverTimestamp(),
        });

        // Clear any existing timeout
        const existingTimeout = this.typingTimeouts.get(conversationId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set timeout to automatically clear typing status
        const timeout = setTimeout(async () => {
          try {
            await updateDoc(conversationRef, {
              [`typing.${currentUserId}`]: null,
            });
          } catch {
            // Silent failure for cleanup
          }
          this.typingTimeouts.delete(conversationId);
        }, TYPING_TIMEOUT_MS);

        this.typingTimeouts.set(conversationId, timeout);
      } else {
        // Clear typing status immediately
        await updateDoc(conversationRef, {
          [`typing.${currentUserId}`]: null,
        });

        // Clear timeout
        const existingTimeout = this.typingTimeouts.get(conversationId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.typingTimeouts.delete(conversationId);
        }
      }
    } catch (error) {
      // Silent failure for typing indicators - not critical
      console.error("[Messenger] Failed to set typing status:", error);
    }
  }

  /**
   * Subscribe to typing status changes in a conversation
   * Callback receives array of display names of users currently typing
   */
  subscribeToTyping(
    conversationId: string,
    callback: (typingUsers: string[]) => void
  ): () => void {
    // Clean up previous subscription
    const existingUnsubscribe = this.typingSubscriptions.get(conversationId);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const currentUserId = this.getCurrentUserId();

    (async () => {
      try {
        const firestore = await getFirestoreInstance();

        const conversationRef = doc(
          firestore,
          CONVERSATIONS_COLLECTION,
          conversationId
        );

        const unsubscribe = onSnapshot(
          conversationRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              callback([]);
              return;
            }

            const data = snapshot.data();
            const typing = data["typing"] as
              | Record<string, Timestamp>
              | undefined;
            const participantInfo = data["participantInfo"] as Record<
              string,
              { displayName: string }
            >;

            if (!typing) {
              callback([]);
              return;
            }

            const now = Date.now();
            const typingUsers: string[] = [];

            for (const [userId, timestamp] of Object.entries(typing)) {
              // Skip current user and check if typing is recent
              if (userId === currentUserId) continue;
              if (!timestamp) continue;

              const typingTime = timestamp.toMillis();
              const isRecent = now - typingTime < TYPING_TIMEOUT_MS + 1000; // 1s buffer

              if (isRecent) {
                const displayName =
                  participantInfo[userId]?.displayName || "Someone";
                typingUsers.push(displayName);
              }
            }

            callback(typingUsers);
          },
          (error) => {
            console.error("[Messenger] Typing subscription error:", error);
            callback([]);
          }
        );

        this.typingSubscriptions.set(conversationId, unsubscribe);
      } catch (error) {
        console.error("[Messenger] Failed to subscribe to typing:", error);
        callback([]);
      }
    })();

    return () => {
      const unsubscribe = this.typingSubscriptions.get(conversationId);
      if (unsubscribe) {
        unsubscribe();
        this.typingSubscriptions.delete(conversationId);
      }
    };
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    this.messageSubscriptions.forEach((unsubscribe) => unsubscribe());
    this.messageSubscriptions.clear();

    this.typingSubscriptions.forEach((unsubscribe) => unsubscribe());
    this.typingSubscriptions.clear();

    this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }
}

// Export singleton instance
export const messagingService = new Messenger();
