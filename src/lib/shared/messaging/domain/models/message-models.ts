/**
 * Message domain models for the peer-to-peer messaging system
 */

/**
 * Attachment types that can be included in messages
 */
export type MessageAttachmentType = "image" | "sequence" | "link" | "feedback";

/**
 * Feedback-specific metadata for message attachments
 */
export interface FeedbackAttachmentMetadata {
  feedbackId: string;
  feedbackTitle: string;
  feedbackType: "bug" | "feature" | "general";
  feedbackStatus: string;
  feedbackDescription?: string;
}

/**
 * An attachment on a message (images, sequence links, feedback, etc.)
 */
export interface MessageAttachment {
  type: MessageAttachmentType;
  url: string;
  thumbnailUrl?: string;
  /** Display name for the attachment (e.g., filename, sequence word) */
  name?: string;
  metadata?: {
    title?: string;
    description?: string;
    width?: number;
    height?: number;
    // Sequence-specific fields
    sequenceId?: string;
    sequenceWord?: string;
    sequenceName?: string;
    sequenceThumbnail?: string;
    sequenceAuthor?: string;
    sequenceStepCount?: number;
    // Feedback-specific fields
    feedbackId?: string;
    feedbackTitle?: string;
    feedbackType?: "bug" | "feature" | "general";
    feedbackStatus?: string;
    feedbackDescription?: string;
  };
}

/**
 * A reaction on a message (emoji + list of users who reacted)
 */
export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

/**
 * Preview of a replied-to message
 */
export interface ReplyPreview {
  messageId: string;
  senderName: string;
  content: string; // Truncated to ~100 chars
}

/**
 * A historical edit of a message (for abuse prevention)
 */
export interface MessageEdit {
  content: string;
  editedAt: Date;
}

/**
 * A single message in a conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  readBy: string[]; // User IDs who have read this message
  readAt?: Record<string, Date>; // Timestamps when each user read the message
  attachments?: MessageAttachment[];
  isDeleted?: boolean; // Soft delete flag
  reactions?: MessageReaction[]; // Emoji reactions on this message
  replyTo?: ReplyPreview; // Message this is replying to
  editHistory?: MessageEdit[]; // Previous versions for abuse prevention
}

/**
 * Input for creating a new message
 */
export interface CreateMessageInput {
  conversationId: string;
  content: string;
  attachments?: MessageAttachment[];
  replyTo?: ReplyPreview; // Optional reply to another message
}

/**
 * Preview of a message for display in conversation list
 */
export interface MessagePreview {
  content: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
  hasAttachment?: boolean;
}

/**
 * Options for fetching messages with pagination
 */
export interface MessageFetchOptions {
  limit?: number;
  beforeId?: string; // For cursor-based pagination
  afterId?: string;
}
