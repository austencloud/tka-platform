/**
 * Inbox State Management
 *
 * Svelte 5 runes-based state for the combined messages + notifications inbox.
 */

import type {
  ConversationPreview,
  Conversation,
} from "$lib/shared/messaging/domain/models/conversation-models";
import type { Message } from "$lib/shared/messaging/domain/models/message-models";
import type { UserNotification } from "$lib/shared/notifications/domain/models/notification-models";
import type { SequenceSharePayload } from "../domain/models/sequence-share-payload";

// Inbox tab types
export type InboxTab = "messages" | "notifications";

// Inbox view state
export type InboxView =
  | "list"
  | "thread"
  | "compose"
  | "group-settings"
  | "send-sequence";

/**
 * Reactive inbox state using Svelte 5 runes
 */
class InboxState {
  // Drawer state
  isOpen = $state(false);
  activeTab = $state<InboxTab>("messages");
  currentView = $state<InboxView>("list");

  // Message state
  conversations = $state<ConversationPreview[]>([]);
  selectedConversation = $state<Conversation | null>(null);
  messages = $state<Message[]>([]);

  // Notification state
  notifications = $state<UserNotification[]>([]);

  // Derived unread counts from actual data - using arrow functions for reactivity
  unreadMessageCount = $derived.by(() => {
    return this.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  });

  unreadNotificationCount = $derived.by(() => {
    return this.notifications.filter((n) => !n.read).length;
  });

  // Loading states
  isLoadingConversations = $state(false);
  isLoadingMessages = $state(false);
  isLoadingNotifications = $state(false);

  // Compose state (for new message)
  composeRecipientId = $state<string | null>(null);
  composeRecipientName = $state<string | null>(null);
  composeGroupMode = $state(false);

  // Sequence sharing state
  shareSequencePayload = $state<SequenceSharePayload | null>(null);

  // Reply state - message being replied to
  replyToMessage = $state<Message | null>(null);

  // Edit state - message being edited
  editingMessage = $state<Message | null>(null);

  // Typing indicator state - display names of users currently typing
  typingUsers = $state<string[]>([]);

  // Pending navigation - allows dashboard widgets to request direct navigation
  // The InboxDrawer will pick this up and handle the actual loading
  pendingConversationId = $state<string | null>(null);
  pendingNotificationId = $state<string | null>(null);

  // Derived state - using $derived.by for proper reactivity
  totalUnreadCount = $derived.by(() => {
    return this.unreadMessageCount + this.unreadNotificationCount;
  });

  hasUnread = $derived.by(() => {
    return this.totalUnreadCount > 0;
  });

  // Actions
  open(tab?: InboxTab) {
    this.isOpen = true;
    if (tab) {
      this.activeTab = tab;
    }
    this.currentView = "list";
    this.shareSequencePayload = null;
  }

  close() {
    this.isOpen = false;
    this.selectedConversation = null;
    this.messages = [];
    this.currentView = "list";
    this.composeRecipientId = null;
    this.composeRecipientName = null;
    this.composeGroupMode = false;
    this.shareSequencePayload = null;
    this.replyToMessage = null;
    this.editingMessage = null;
    this.typingUsers = [];
    this.pendingConversationId = null;
    this.pendingNotificationId = null;
  }

  setTab(tab: InboxTab) {
    this.activeTab = tab;
    this.currentView = "list";
    this.selectedConversation = null;
    this.messages = [];
    this.replyToMessage = null;
    this.editingMessage = null;
    this.typingUsers = [];
    this.shareSequencePayload = null;
  }

  selectConversation(conversation: Conversation) {
    this.shareSequencePayload = null;
    this.selectedConversation = conversation;
    this.currentView = "thread";
  }

  /**
   * Open inbox directly to a specific conversation
   * Used from dashboard widgets for one-click access
   */
  openToConversation(conversation: Conversation) {
    this.isOpen = true;
    this.activeTab = "messages";
    this.shareSequencePayload = null;
    this.selectedConversation = conversation;
    this.currentView = "thread";
  }

  /**
   * Open inbox directly to a specific conversation by ID
   * Opens directly to thread view (shows loading state while conversation loads)
   */
  openToConversationById(conversationId: string) {
    this.pendingConversationId = conversationId;
    this.isOpen = true;
    this.activeTab = "messages";
    this.shareSequencePayload = null;
    this.currentView = "thread"; // Go directly to thread view
    this.isLoadingMessages = true; // Show loading state
    // InboxDrawer will detect pendingConversationId and load the conversation
  }

  /**
   * Open inbox to handle a specific notification
   * Sets pendingNotificationId so InboxDrawer can handle the action
   */
  openToNotification(notificationId: string) {
    this.pendingNotificationId = notificationId;
    this.isOpen = true;
    this.activeTab = "notifications";
    this.shareSequencePayload = null;
    // InboxDrawer will detect pendingNotificationId and handle the action
  }

  /**
   * Clear pending navigation after it's been handled
   */
  clearPendingNavigation() {
    this.pendingConversationId = null;
    this.pendingNotificationId = null;
  }

  backToList() {
    this.shareSequencePayload = null;
    this.selectedConversation = null;
    this.messages = [];
    this.currentView = "list";
    this.replyToMessage = null;
    this.editingMessage = null;
    this.typingUsers = [];
  }

  startCompose(recipientId?: string, recipientName?: string) {
    this.shareSequencePayload = null;
    this.composeRecipientId = recipientId || null;
    this.composeRecipientName = recipientName || null;
    this.composeGroupMode = false;
    this.currentView = "compose";
  }

  startGroupCompose() {
    this.shareSequencePayload = null;
    this.composeGroupMode = true;
    this.composeRecipientId = null;
    this.composeRecipientName = null;
    this.currentView = "compose";
  }

  cancelCompose() {
    this.composeRecipientId = null;
    this.composeRecipientName = null;
    this.composeGroupMode = false;
    this.currentView = "list";
  }

  openSequenceShare(payload: SequenceSharePayload) {
    this.isOpen = true;
    this.activeTab = "messages";
    this.currentView = "send-sequence";
    this.shareSequencePayload = payload;
    this.pendingConversationId = null;
    this.pendingNotificationId = null;
    this.selectedConversation = null;
    this.messages = [];
    this.composeRecipientId = null;
    this.composeRecipientName = null;
    this.composeGroupMode = false;
    this.replyToMessage = null;
    this.editingMessage = null;
    this.typingUsers = [];
  }

  completeSequenceShare(conversationId: string) {
    this.shareSequencePayload = null;
    this.openToConversationById(conversationId);
  }

  cancelSequenceShare() {
    this.close();
  }

  openGroupSettings() {
    if (this.selectedConversation?.type === "group") {
      this.currentView = "group-settings";
    }
  }

  closeGroupSettings() {
    this.currentView = "thread";
  }

  // Update methods for subscriptions
  setConversations(conversations: ConversationPreview[]) {
    this.conversations = conversations;
  }

  setMessages(messages: Message[]) {
    this.messages = messages;
  }

  setNotifications(notifications: UserNotification[]) {
    this.notifications = notifications;
  }

  setLoadingConversations(loading: boolean) {
    this.isLoadingConversations = loading;
  }

  setLoadingMessages(loading: boolean) {
    this.isLoadingMessages = loading;
  }

  setLoadingNotifications(loading: boolean) {
    this.isLoadingNotifications = loading;
  }

  // Reply actions
  setReplyTo(message: Message) {
    this.replyToMessage = message;
    // Clear edit mode if replying
    this.editingMessage = null;
  }

  clearReplyTo() {
    this.replyToMessage = null;
  }

  // Edit actions
  setEditingMessage(message: Message) {
    this.editingMessage = message;
    // Clear reply mode if editing
    this.replyToMessage = null;
  }

  clearEditingMessage() {
    this.editingMessage = null;
  }

  // Typing indicator actions
  setTypingUsers(users: string[]) {
    this.typingUsers = users;
  }

  // Derived state for composer mode
  isReplying = $derived.by(() => {
    return this.replyToMessage !== null;
  });

  isEditing = $derived.by(() => {
    return this.editingMessage !== null;
  });
}

// Export singleton instance
export const inboxState = new InboxState();
