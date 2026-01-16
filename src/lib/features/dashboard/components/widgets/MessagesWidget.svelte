<script lang="ts">
  /**
   * MessagesWidget - Direct messages from the community
   * Shows recent conversations with one-click access to threads
   */

  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { messagingService } from "$lib/shared/messaging/services/implementations/Messenger";
  import type { ConversationPreview } from "$lib/shared/messaging/domain/models/conversation-models";

  // Props
  let { onOpenMessages, onOpenConversation } = $props<{
    onOpenMessages?: () => void;
    onOpenConversation?: (conversationId: string) => void;
  }>();

  // Derived state from inbox
  const conversations = $derived(inboxState.conversations.slice(0, 4));
  const unreadCount = $derived(inboxState.unreadMessageCount);

  async function handleMarkAllAsRead() {
    try {
      // Mark each conversation with unread messages as read
      const unreadConversations = inboxState.conversations.filter(
        (c) => c.unreadCount > 0
      );
      await Promise.all(
        unreadConversations.map((c) => messagingService.markAsRead(c.id))
      );
    } catch (error) {
      console.error("[MessagesWidget] Failed to mark messages as read:", error);
    }
  }

  function openConversation(conversation: ConversationPreview) {
    // Use prop if provided, otherwise use default behavior
    if (onOpenConversation) {
      onOpenConversation(conversation.id);
    } else {
      inboxState.openToConversationById(conversation.id);
    }
  }

  function openAllMessages() {
    // Use prop if provided, otherwise use default behavior
    if (onOpenMessages) {
      onOpenMessages();
    } else {
      inboxState.open("messages");
    }
  }

  function formatTimeAgo(date: Date | string): string {
    const now = new Date();
    const then = date instanceof Date ? date : new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return then.toLocaleDateString();
  }
</script>

<div class="messages-widget">
  <div class="widget-header">
    <div class="header-left">
      <div class="header-icon">
        <i class="fas fa-envelope" aria-hidden="true"></i>
      </div>
      <h3>Messages</h3>
    </div>
    {#if unreadCount > 0}
      <button
        class="mark-read-btn"
        onclick={handleMarkAllAsRead}
        aria-label="Mark all messages as read"
      >
        Mark All Read
      </button>
    {/if}
  </div>

  <div class="widget-content">
    {#if !authState.isAuthenticated}
      <div class="empty-state">
        <i class="fas fa-user-circle" aria-hidden="true"></i>
        <p>Sign in to see messages</p>
      </div>
    {:else if conversations.length === 0}
      <div class="empty-state">
        <i class="fas fa-envelope-open" aria-hidden="true"></i>
        <p>No messages yet</p>
        <span class="empty-hint">Start a conversation!</span>
      </div>
    {:else}
      <div class="conversation-list">
        {#each conversations as conversation}
          {@const isGroup = conversation.type === "group"}
          {@const displayName = isGroup
            ? conversation.groupName || "Group"
            : conversation.otherParticipant?.displayName || "Unknown"}
          {@const avatarSrc = isGroup
            ? conversation.groupAvatar
            : conversation.otherParticipant?.avatar}
          <button
            class="conversation-item"
            class:unread={conversation.unreadCount > 0}
            onclick={() => openConversation(conversation)}
          >
            <RobustAvatar
              src={avatarSrc}
              name={displayName}
              size="sm"
              alt={displayName}
            />
            <div class="conversation-content">
              <div class="conversation-header">
                <span class="conversation-name">
                  {#if isGroup}
                    <i
                      class="fas fa-users"
                      style="font-size: 10px; margin-right: 4px;"
                      aria-hidden="true"
                    ></i>
                  {/if}
                  {displayName}
                </span>
                <span class="conversation-time"
                  >{formatTimeAgo(conversation.updatedAt)}</span
                >
              </div>
              <span class="conversation-preview">
                {conversation.lastMessage?.content || "No messages yet"}
              </span>
            </div>
            {#if conversation.unreadCount > 0}
              <span class="unread-dot"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <button class="view-all-btn" onclick={openAllMessages}>
    <span>All Messages</span>
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .messages-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: 16px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--theme-accent-strong)) 25%,
      var(--theme-card-bg, var(--theme-shadow))
    );
    border-radius: 10px;
    color: var(--semantic-info, var(--theme-accent-strong));
    font-size: var(--font-size-sm);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .mark-read-btn {
    padding: 4px 10px;
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.6875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .mark-read-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
    border-color: var(--theme-stroke);
  }

  .widget-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    padding: 16px;
    flex: 1;
  }

  .empty-state i {
    font-size: var(--font-size-2xl);
    color: var(--theme-text-dim);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty-hint {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .conversation-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--theme-card-bg);
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .conversation-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke, var(--theme-stroke));
  }

  .conversation-item.unread {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--theme-accent-strong)) 12%,
      var(--theme-card-bg, var(--theme-shadow))
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--theme-accent-strong)) 25%,
      transparent
    );
  }

  .conversation-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .conversation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .conversation-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conversation-time {
    font-size: 0.6875rem;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .conversation-preview {
    font-size: 0.75rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unread-dot {
    width: 8px;
    height: 8px;
    background: var(--semantic-info, var(--theme-accent-strong));
    border-radius: 50%;
    flex-shrink: 0;
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 10px 16px;
    margin-top: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    color: var(--theme-text, var(--theme-text));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .view-all-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke, var(--theme-stroke-strong));
  }

  .view-all-btn i {
    font-size: var(--font-size-compact);
  }

  @media (max-width: 768px) {
    .messages-widget {
      padding: 14px;
      border-radius: 16px;
    }

    .header-icon {
      width: 32px;
      height: 32px;
      font-size: var(--font-size-compact);
    }

    .widget-header h3 {
      font-size: 0.9375rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .conversation-item,
    .view-all-btn,
    .mark-read-btn {
      transition: none;
    }
  }
</style>
