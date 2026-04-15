/**
 * ConversationManager
 *
 * Manages conversations between users with real-time Firestore subscriptions.
 * Supports both direct (1:1) and group conversations.
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
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/isPermissionDeniedError";
import type {
  Conversation,
  ConversationPreview,
  ConversationFetchOptions,
  GetOrCreateConversationResult,
  ParticipantInfo,
  CreateGroupInput,
  CreateGroupResult,
  GroupMetadata,
  ConversationType,
} from "../../domain/models/conversation-models";
import type { IConversationManager } from "../contracts/IConversationManager";

const CONVERSATIONS_COLLECTION = "conversations";
const MAX_GROUP_PARTICIPANTS = 50;

export class ConversationManager implements IConversationManager {
  private conversationsUnsubscribe: (() => void) | null = null;
  private unreadCountUnsubscribe: (() => void) | null = null;

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Get the current user ID or throw if not authenticated.
   * Supports both preview mode (View As) and legacy impersonation.
   */
  private getCurrentUserId(): string {
    if (userPreviewState.isActive && userPreviewState.data.profile) {
      return userPreviewState.data.profile.uid;
    }
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
   * Get effective user info (supports preview mode).
   */
  private getEffectiveUserInfo(): {
    uid: string;
    displayName: string;
    photoURL: string | null;
  } {
    if (userPreviewState.isActive && userPreviewState.data.profile) {
      const profile = userPreviewState.data.profile;
      return {
        uid: profile.uid,
        displayName: profile.displayName || "Unknown User",
        photoURL: profile.photoURL || null,
      };
    }
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
   * Generate a deterministic conversation ID for 1:1 conversations
   */
  private generateDirectConversationId(
    userId1: string,
    userId2: string
  ): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Generate a random ID for group conversations
   */
  private generateGroupId(): string {
    return crypto.randomUUID();
  }

  /**
   * Check if a user is an admin in a group conversation
   */
  private isGroupAdmin(conversation: Conversation, userId: string): boolean {
    return conversation.groupMetadata?.adminIds.includes(userId) ?? false;
  }

  /**
   * Get the conversation type, defaulting to "direct" for backward compatibility
   */
  private getConversationType(
    data: Record<string, unknown>
  ): ConversationType {
    return (data["type"] as ConversationType) || "direct";
  }

  // ============================================================================
  // DIRECT CONVERSATIONS (1:1)
  // ============================================================================

  /**
   * Get or create a direct conversation between current user and another user
   * @param otherUserId - The user ID to start/get conversation with
   * @param options - Optional settings (silent: suppress error toasts for background operations)
   */
  async getOrCreateConversation(
    otherUserId: string,
    options?: { silent?: boolean }
  ): Promise<GetOrCreateConversationResult> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationId = this.generateDirectConversationId(
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

      // Create new direct conversation
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
        type: "direct",
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
      // Only show toast if not silent (silent mode for background operations)
      if (!options?.silent) {
        toast.error("Failed to start conversation.");
      }
      throw error;
    }
  }

  /**
   * Check if a direct conversation exists between current user and another user
   */
  async conversationExists(otherUserId: string): Promise<string | null> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversationId = this.generateDirectConversationId(
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

  // ============================================================================
  // GROUP CONVERSATIONS
  // ============================================================================

  /**
   * Create a new group conversation
   */
  async createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const effectiveUser = this.getEffectiveUserInfo();
      const conversationId = this.generateGroupId();
      const now = new Date();

      // Validate participant count
      const allParticipantIds = [
        currentUserId,
        ...input.participantIds.filter((id) => id !== currentUserId),
      ];
      if (allParticipantIds.length > MAX_GROUP_PARTICIPANTS) {
        throw new Error(`Groups cannot exceed ${MAX_GROUP_PARTICIPANTS} members`);
      }
      if (allParticipantIds.length < 2) {
        throw new Error("Groups require at least 2 participants");
      }

      // Fetch participant info for all users
      const participantInfo: Record<string, ParticipantInfo> = {
        [currentUserId]: {
          userId: currentUserId,
          displayName: effectiveUser.displayName,
          ...(effectiveUser.photoURL && { avatar: effectiveUser.photoURL }),
          joinedAt: now,
        },
      };

      const failedInvites: string[] = [];
      for (const userId of input.participantIds) {
        if (userId === currentUserId) continue;
        try {
          const userInfo = await this.fetchUserInfo(userId);
          if (userInfo.displayName === "Unknown User") {
            failedInvites.push(userId);
            continue;
          }
          participantInfo[userId] = {
            userId,
            displayName: userInfo.displayName,
            ...(userInfo.photoURL && { avatar: userInfo.photoURL }),
            joinedAt: now,
          };
        } catch {
          failedInvites.push(userId);
        }
      }

      // Filter out failed invites from participants
      const validParticipants = allParticipantIds.filter(
        (id) => !failedInvites.includes(id)
      );

      if (validParticipants.length < 2) {
        throw new Error("Not enough valid participants to create group");
      }

      // Initialize unread count for all participants
      const unreadCount: Record<string, number> = {};
      for (const userId of validParticipants) {
        unreadCount[userId] = 0;
      }

      const groupMetadata: GroupMetadata = {
        name: input.name,
        ...(input.description !== undefined && { description: input.description }),
        adminIds: [currentUserId],
        createdBy: currentUserId,
      };

      const newConversation: Omit<Conversation, "id"> = {
        type: "group",
        participants: validParticipants.sort(),
        participantInfo,
        unreadCount,
        createdAt: now,
        updatedAt: now,
        groupMetadata,
      };

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      await setDoc(conversationRef, {
        ...newConversation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        conversation: { id: conversationId, ...newConversation },
        failedInvites: failedInvites.length > 0 ? failedInvites : undefined,
      };
    } catch (error) {
      console.error("[ConversationManager] Failed to create group:", error);
      toast.error("Failed to create group.");
      throw error;
    }
  }

  /**
   * Get or create a group conversation with specific participants
   * Checks if a group with the exact same participants exists first
   */
  async getOrCreateGroupConversation(
    participantIds: string[],
    groupName?: string
  ): Promise<GetOrCreateConversationResult> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();

      // Build the full participant list including current user
      const allParticipantIds = [
        currentUserId,
        ...participantIds.filter((id) => id !== currentUserId),
      ].sort();

      // Query for groups where current user is a participant
      const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
      const q = query(
        conversationsRef,
        where("type", "==", "group"),
        where("participants", "array-contains", currentUserId)
      );

      const snapshot = await getDocs(q);

      // Check if any existing group has the exact same participants
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const existingParticipants = (data.participants as string[]).sort();

        // Check for exact match
        if (
          existingParticipants.length === allParticipantIds.length &&
          existingParticipants.every((id, i) => id === allParticipantIds[i])
        ) {
          // Found existing group with same participants
          return {
            conversation: this.mapDocToConversation(docSnap.id, data),
            isNew: false,
          };
        }
      }

      // No existing group found, create a new one
      // Generate default name from participant names if none provided
      let finalGroupName = groupName?.trim();
      if (!finalGroupName) {
        const names: string[] = [];
        for (const userId of participantIds) {
          const userInfo = await this.fetchUserInfo(userId);
          const firstName = userInfo.displayName?.split(" ")[0] ?? "User";
          names.push(firstName);
        }
        finalGroupName = names.join(", ");
      }

      const result = await this.createGroup({
        name: finalGroupName,
        participantIds,
      });

      return {
        conversation: result.conversation,
        isNew: true,
      };
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to get or create group:",
        error
      );
      toast.error("Failed to start group conversation.");
      throw error;
    }
  }

  /**
   * Add a member to a group (admin only)
   */
  async addGroupMember(conversationId: string, userId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.type !== "group") {
        throw new Error("Cannot add members to a direct conversation");
      }
      if (!this.isGroupAdmin(conversation, currentUserId)) {
        throw new Error("Only admins can add members");
      }
      if (conversation.participants.includes(userId)) {
        throw new Error("User is already a member");
      }
      if (conversation.participants.length >= MAX_GROUP_PARTICIPANTS) {
        throw new Error(`Group is at maximum capacity (${MAX_GROUP_PARTICIPANTS})`);
      }

      const userInfo = await this.fetchUserInfo(userId);
      const now = new Date();

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      await updateDoc(conversationRef, {
        participants: arrayUnion(userId),
        [`participantInfo.${userId}`]: {
          userId,
          displayName: userInfo.displayName,
          ...(userInfo.photoURL && { avatar: userInfo.photoURL }),
          joinedAt: now,
        },
        [`unreadCount.${userId}`]: 0,
        updatedAt: serverTimestamp(),
      });

      toast.success(`Added ${userInfo.displayName} to the group`);
    } catch (error) {
      console.error("[ConversationManager] Failed to add group member:", error);
      toast.error("Failed to add member to group.");
      throw error;
    }
  }

  /**
   * Remove a member from a group (admin only)
   */
  async removeGroupMember(
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.type !== "group") {
        throw new Error("Cannot remove members from a direct conversation");
      }
      if (!this.isGroupAdmin(conversation, currentUserId)) {
        throw new Error("Only admins can remove members");
      }
      if (!conversation.participants.includes(userId)) {
        throw new Error("User is not a member");
      }
      if (conversation.groupMetadata?.createdBy === userId) {
        throw new Error("Cannot remove the group creator");
      }

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      // Also remove from adminIds if they're an admin
      const updates: Record<string, unknown> = {
        participants: arrayRemove(userId),
        updatedAt: serverTimestamp(),
      };

      if (conversation.groupMetadata?.adminIds.includes(userId)) {
        updates["groupMetadata.adminIds"] = arrayRemove(userId);
      }

      await updateDoc(conversationRef, updates);
      toast.success("Removed member from group");
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to remove group member:",
        error
      );
      toast.error("Failed to remove member from group.");
      throw error;
    }
  }

  /**
   * Leave a group conversation
   */
  async leaveGroup(conversationId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.type !== "group") {
        throw new Error("Cannot leave a direct conversation");
      }
      if (!conversation.participants.includes(currentUserId)) {
        throw new Error("You are not a member of this group");
      }

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      const updates: Record<string, unknown> = {
        participants: arrayRemove(currentUserId),
        updatedAt: serverTimestamp(),
      };

      // Handle admin transfer if leaving user is an admin
      if (conversation.groupMetadata?.adminIds.includes(currentUserId)) {
        updates["groupMetadata.adminIds"] = arrayRemove(currentUserId);

        // If last admin, promote oldest remaining member
        const remainingAdmins = conversation.groupMetadata.adminIds.filter(
          (id) => id !== currentUserId
        );
        if (remainingAdmins.length === 0) {
          const remainingMembers = conversation.participants.filter(
            (id) => id !== currentUserId
          );
          if (remainingMembers.length > 0) {
            // Promote first remaining member (sorted, so oldest join time effectively)
            updates["groupMetadata.adminIds"] = arrayUnion(remainingMembers[0]);
          }
        }
      }

      await updateDoc(conversationRef, updates);
      toast.success("You left the group");
    } catch (error) {
      console.error("[ConversationManager] Failed to leave group:", error);
      toast.error("Failed to leave group.");
      throw error;
    }
  }

  /**
   * Update group metadata (admin only)
   */
  async updateGroupMetadata(
    conversationId: string,
    updates: Partial<Pick<GroupMetadata, "name" | "description" | "avatarUrl">>
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.type !== "group") {
        throw new Error("Cannot update metadata for a direct conversation");
      }
      if (!this.isGroupAdmin(conversation, currentUserId)) {
        throw new Error("Only admins can update group metadata");
      }

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      const firestoreUpdates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (updates.name !== undefined) {
        firestoreUpdates["groupMetadata.name"] = updates.name;
      }
      if (updates.description !== undefined) {
        firestoreUpdates["groupMetadata.description"] = updates.description;
      }
      if (updates.avatarUrl !== undefined) {
        firestoreUpdates["groupMetadata.avatarUrl"] = updates.avatarUrl;
      }

      await updateDoc(conversationRef, firestoreUpdates);
      toast.success("Group updated");
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to update group metadata:",
        error
      );
      toast.error("Failed to update group.");
      throw error;
    }
  }

  /**
   * Promote or demote admin status (admin only)
   */
  async setAdminStatus(
    conversationId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const currentUserId = this.getCurrentUserId();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.type !== "group") {
        throw new Error("Cannot set admin status for a direct conversation");
      }
      if (!this.isGroupAdmin(conversation, currentUserId)) {
        throw new Error("Only admins can change admin status");
      }
      if (!conversation.participants.includes(userId)) {
        throw new Error("User is not a member of this group");
      }

      const conversationRef = doc(
        firestore,
        CONVERSATIONS_COLLECTION,
        conversationId
      );

      await updateDoc(conversationRef, {
        "groupMetadata.adminIds": isAdmin
          ? arrayUnion(userId)
          : arrayRemove(userId),
        updatedAt: serverTimestamp(),
      });

      const userInfo = conversation.participantInfo[userId];
      toast.success(
        isAdmin
          ? `${userInfo?.displayName || "User"} is now an admin`
          : `${userInfo?.displayName || "User"} is no longer an admin`
      );
    } catch (error) {
      console.error(
        "[ConversationManager] Failed to set admin status:",
        error
      );
      toast.error("Failed to update admin status.");
      throw error;
    }
  }

  // ============================================================================
  // COMMON OPERATIONS
  // ============================================================================

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
    if (this.conversationsUnsubscribe) {
      this.conversationsUnsubscribe();
    }

    const currentUserId = this.getCurrentUserId();

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
            // Expected on sign-out — Firestore rules reject the query once the
            // user's auth token goes away. The onAuthStateChanged handler will
            // tear this listener down shortly.
            if (isPermissionDeniedError(error)) return;
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
    if (this.unreadCountUnsubscribe) {
      this.unreadCountUnsubscribe();
    }

    const currentUserId = this.getCurrentUserId();

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
   * Archive a conversation
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
   * Unarchive a conversation
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

  // ============================================================================
  // PRIVATE MAPPERS
  // ============================================================================

  /**
   * Map Firestore document to Conversation
   */
  private mapDocToConversation(
    id: string,
    data: Record<string, unknown>
  ): Conversation {
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

    const rawGroupMetadata = data["groupMetadata"] as
      | Record<string, unknown>
      | undefined;
    const groupMetadata = rawGroupMetadata
      ? {
          name: rawGroupMetadata["name"] as string,
          description: rawGroupMetadata["description"] as string | undefined,
          avatarUrl: rawGroupMetadata["avatarUrl"] as string | undefined,
          adminIds: rawGroupMetadata["adminIds"] as string[],
          createdBy: rawGroupMetadata["createdBy"] as string,
        }
      : undefined;

    return {
      id,
      type: this.getConversationType(data),
      participants: data["participants"] as string[],
      participantInfo: data["participantInfo"] as Record<
        string,
        ParticipantInfo
      >,
      lastMessage,
      unreadCount: (data["unreadCount"] as Record<string, number>) || {},
      createdAt: (data["createdAt"] as Timestamp)?.toDate() || new Date(),
      updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
      groupMetadata,
    };
  }

  /**
   * Map Firestore document to ConversationPreview
   * Handles both direct and group conversations
   */
  private mapDocToPreview(
    id: string,
    data: Record<string, unknown>,
    currentUserId: string
  ): ConversationPreview | null {
    const type = this.getConversationType(data);
    const participants = data["participants"] as string[];
    const participantInfo = data["participantInfo"] as Record<
      string,
      ParticipantInfo
    >;
    const unreadCount = (data["unreadCount"] as Record<string, number>) || {};

    // Convert lastMessage
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

    if (type === "group") {
      // Group conversation preview
      const rawGroupMetadata = data["groupMetadata"] as
        | Record<string, unknown>
        | undefined;

      // Get first few participants for avatar stack (exclude current user)
      const otherParticipantIds = participants.filter(
        (p) => p !== currentUserId
      );
      const participantPreviews = otherParticipantIds
        .slice(0, 4)
        .map((id) => participantInfo[id])
        .filter((p): p is ParticipantInfo => p !== undefined);

      return {
        id,
        type: "group",
        groupName: rawGroupMetadata?.["name"] as string,
        groupAvatar: rawGroupMetadata?.["avatarUrl"] as string | undefined,
        participantCount: participants.length,
        participantPreviews,
        lastMessage,
        unreadCount: unreadCount[currentUserId] || 0,
        updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
      };
    }

    // Direct (1:1) conversation preview
    const otherUserId = participants.find((p) => p !== currentUserId) || "";

    // Filter out self-conversations
    if (!otherUserId || otherUserId === currentUserId) {
      return null;
    }

    const otherParticipant = participantInfo[otherUserId] || {
      userId: otherUserId,
      displayName: "Unknown User",
      joinedAt: new Date(),
    };

    // Trigger background update for stale participant info
    if (otherParticipant.displayName === "Loading...") {
      this.refreshParticipantInfo(id, otherUserId);
    }

    return {
      id,
      type: "direct",
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
}

// Export singleton instance
export const conversationService = new ConversationManager();
