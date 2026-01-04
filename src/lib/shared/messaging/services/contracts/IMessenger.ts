/**
 * Contract for the messaging service
 * Handles sending, fetching, and real-time subscription to messages
 */

import type {
  Message,
  CreateMessageInput,
  MessageFetchOptions,
  MessageAttachment,
} from "../../domain/models/message-models";

export interface IMessenger {
  /**
   * Send a new message in a conversation
   */
  sendMessage(input: CreateMessageInput): Promise<Message>;

  /**
   * Send a message with just content (convenience method)
   */
  sendTextMessage(conversationId: string, content: string): Promise<Message>;

  /**
   * Get messages for a conversation with pagination
   */
  getMessages(
    conversationId: string,
    options?: MessageFetchOptions
  ): Promise<Message[]>;

  /**
   * Subscribe to real-time message updates for a conversation
   * Returns unsubscribe function
   */
  subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void;

  /**
   * Mark all messages in a conversation as read for the current user
   */
  markAsRead(conversationId: string): Promise<void>;

  /**
   * Mark a specific message as read
   */
  markMessageAsRead(conversationId: string, messageId: string): Promise<void>;

  /**
   * Soft delete a message (sender only)
   */
  deleteMessage(conversationId: string, messageId: string): Promise<void>;

  /**
   * Edit a message (sender only, preserves edit history)
   */
  editMessage(
    conversationId: string,
    messageId: string,
    newContent: string
  ): Promise<Message>;

  /**
   * Toggle a reaction on a message (add if not present, remove if already reacted)
   */
  toggleReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<void>;

  /**
   * Set typing status for current user in a conversation
   */
  setTyping(conversationId: string, isTyping: boolean): Promise<void>;

  /**
   * Subscribe to typing status changes in a conversation
   * Callback receives array of display names of users currently typing
   * Returns unsubscribe function
   */
  subscribeToTyping(
    conversationId: string,
    callback: (typingUsers: string[]) => void
  ): () => void;
}
