/**
 * Contract for the conversation service
 * Handles conversation CRUD and real-time subscriptions
 * Supports both direct (1:1) and group conversations
 */

import type {
  Conversation,
  ConversationPreview,
  ConversationFetchOptions,
  GetOrCreateConversationResult,
  CreateGroupInput,
  CreateGroupResult,
  GroupMetadata,
} from "../../domain/models/conversation-models";

export interface IConversationManager {
  // ============================================================================
  // DIRECT CONVERSATIONS (1:1)
  // ============================================================================

  /**
   * Get or create a direct conversation between two users
   * Returns existing conversation if one exists, otherwise creates new
   */
  getOrCreateConversation(
    otherUserId: string
  ): Promise<GetOrCreateConversationResult>;

  /**
   * Check if a direct conversation exists between current user and another user
   * Returns conversation ID if exists, null otherwise
   */
  conversationExists(otherUserId: string): Promise<string | null>;

  // ============================================================================
  // GROUP CONVERSATIONS
  // ============================================================================

  /**
   * Create a new group conversation
   * Current user becomes creator and admin
   */
  createGroup(input: CreateGroupInput): Promise<CreateGroupResult>;

  /**
   * Get or create a group conversation with specific participants
   * If a group with the exact same participants exists, returns that group
   * Otherwise creates a new group
   */
  getOrCreateGroupConversation(
    participantIds: string[],
    groupName?: string
  ): Promise<GetOrCreateConversationResult>;

  /**
   * Add a member to a group (admin only)
   */
  addGroupMember(conversationId: string, userId: string): Promise<void>;

  /**
   * Remove a member from a group (admin only)
   */
  removeGroupMember(conversationId: string, userId: string): Promise<void>;

  /**
   * Leave a group conversation
   * If last admin leaves, oldest remaining member becomes admin
   */
  leaveGroup(conversationId: string): Promise<void>;

  /**
   * Update group metadata (admin only)
   * Can update name, description, avatarUrl
   */
  updateGroupMetadata(
    conversationId: string,
    updates: Partial<Pick<GroupMetadata, "name" | "description" | "avatarUrl">>
  ): Promise<void>;

  /**
   * Promote or demote admin status for a user (admin only)
   */
  setAdminStatus(
    conversationId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void>;

  // ============================================================================
  // COMMON OPERATIONS
  // ============================================================================

  /**
   * Get a specific conversation by ID
   */
  getConversation(conversationId: string): Promise<Conversation | null>;

  /**
   * Get current user's conversations (inbox list)
   */
  getConversations(
    options?: ConversationFetchOptions
  ): Promise<ConversationPreview[]>;

  /**
   * Subscribe to real-time updates of user's conversation list
   * Returns unsubscribe function
   */
  subscribeToConversations(
    callback: (conversations: ConversationPreview[]) => void
  ): () => void;

  /**
   * Get total unread message count across all conversations
   */
  getTotalUnreadCount(): Promise<number>;

  /**
   * Subscribe to total unread count changes
   * Returns unsubscribe function
   */
  subscribeToUnreadCount(callback: (count: number) => void): () => void;

  /**
   * Archive a conversation (hides from inbox but preserves messages)
   */
  archiveConversation(conversationId: string): Promise<void>;

  /**
   * Unarchive a conversation
   */
  unarchiveConversation(conversationId: string): Promise<void>;

  /**
   * Mark all conversations as read for current user
   */
  markAllAsRead(): Promise<void>;

  /**
   * Clean up all subscriptions
   */
  cleanup(): void;
}
