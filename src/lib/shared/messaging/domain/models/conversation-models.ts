/**
 * Conversation domain models for the messaging system
 * Supports both direct (1:1) and group conversations
 */

import type { MessagePreview } from "./message-models";

/**
 * Conversation type discriminator
 * - "direct": 1:1 conversation between two users
 * - "group": Multi-user conversation (2-50 participants)
 */
export type ConversationType = "direct" | "group";

/**
 * Information about a participant in a conversation
 */
export interface ParticipantInfo {
  userId: string;
  displayName: string;
  /** Unique public handle. Null means the profile has no handle. */
  username?: string | null;
  avatar?: string;
  joinedAt: Date;
}

/**
 * Group-specific metadata (only present on group conversations)
 */
export interface GroupMetadata {
  name: string;
  description?: string;
  avatarUrl?: string;
  adminIds: string[]; // Users who can add/remove members
  createdBy: string; // Original creator
}

/**
 * A conversation between two or more users
 * For backward compatibility, existing conversations without `type` are treated as "direct"
 */
export interface Conversation {
  id: string;
  type?: ConversationType; // Defaults to "direct" for backward compatibility
  participants: string[]; // Sorted user IDs for consistent querying
  participantInfo: Record<string, ParticipantInfo>;
  lastMessage?: MessagePreview;
  unreadCount: Record<string, number>; // Per-user unread counts
  createdAt: Date;
  updatedAt: Date;
  // Group-only metadata (undefined for direct conversations)
  groupMetadata?: GroupMetadata;
  // Future: muted, archived, pinned flags per user
}

/**
 * Simplified conversation view for inbox list
 * Supports both direct and group conversations
 */
export interface ConversationPreview {
  id: string;
  type: ConversationType; // Normalized (defaults applied)
  // For direct conversations
  otherParticipant?: ParticipantInfo;
  // For group conversations
  groupName?: string;
  groupAvatar?: string;
  participantCount?: number;
  participantPreviews?: ParticipantInfo[]; // First few participants for avatar stack
  // Common fields
  lastMessage?: MessagePreview;
  unreadCount: number;
  updatedAt: Date;
}

/**
 * Options for fetching conversations
 */
export interface ConversationFetchOptions {
  limit?: number;
  includeArchived?: boolean;
}

/**
 * Result from getting or creating a conversation
 */
export interface GetOrCreateConversationResult {
  conversation: Conversation;
  isNew: boolean;
}

/**
 * Input for creating a new group conversation
 */
export interface CreateGroupInput {
  name: string;
  participantIds: string[]; // Other users to add (creator is auto-added)
  description?: string;
}

/**
 * Result from creating a group
 */
export interface CreateGroupResult {
  conversation: Conversation;
  failedInvites?: string[]; // Users who couldn't be added (not found, etc.)
}

/**
 * Input for group member operations
 */
export interface GroupMemberOperation {
  conversationId: string;
  userId: string;
  action: "add" | "remove" | "promote" | "demote";
}
