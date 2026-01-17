<script lang="ts">
  /**
   * InboxWidget - Mini inbox with tab switching
   * Shows messages or alerts based on selected tab
   * Clicking items opens the full drawer
   */

  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";

  // Local tab state for widget view
  let activeTab = $state<"messages" | "alerts">("alerts");

  // Derived state from inbox
  const conversations = $derived(inboxState.conversations.slice(0, 5));
  const notifications = $derived(inboxState.notifications.slice(0, 5));
  const unreadMessages = $derived(inboxState.unreadMessageCount);
  const unreadNotifications = $derived(inboxState.unreadNotificationCount);

  // Check if there's any content to show
  const hasContent = $derived(
    activeTab === "messages"
      ? conversations.length > 0
      : notifications.length > 0
  );

  function openDrawerToMessages() {
    inboxState.open("messages");
  }

  function openDrawerToNotifications() {
    inboxState.open("notifications");
  }

  function formatTimeAgo(date: Date | string): string {
    const now = new Date();
    const then = date instanceof Date ? date : new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  }
</script>

<div class="inbox-widget">
  <!-- Tab buttons -->
  <div class="tab-buttons">
    <button
      class="tab-btn"
      class:active={activeTab === "messages"}
      onclick={() => (activeTab = "messages")}
    >
      <i class="fas fa-envelope" aria-hidden="true"></i>
      <span>Messages</span>
      {#if unreadMessages > 0}
        <span class="tab-count-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span
        >
      {/if}
    </button>

    <button
      class="tab-btn"
      class:active={activeTab === "alerts"}
      onclick={() => (activeTab = "alerts")}
    >
      <i class="fas fa-bell" aria-hidden="true"></i>
      <span>Alerts</span>
      {#if unreadNotifications > 0}
        <span class="tab-count-badge"
          >{unreadNotifications > 99 ? "99+" : unreadNotifications}</span
        >
      {/if}
    </button>
  </div>

  <!-- Content area -->
  <div class="content-area">
    {#if !authState.isAuthenticated}
      <div class="empty-state">
        <i class="fas fa-user-circle" aria-hidden="true"></i>
        <p>Sign in to see your inbox</p>
      </div>
    {:else if !hasContent}
      <div class="empty-state">
        <i
          class="fas {activeTab === 'messages' ? 'fa-envelope' : 'fa-bell'}"
          aria-hidden="true"
        ></i>
        <p>No {activeTab === "messages" ? "messages" : "alerts"} yet</p>
      </div>
    {:else if activeTab === "messages"}
      <!-- Messages list -->
      <div class="item-list">
        {#each conversations as conversation}
          {@const isGroup = conversation.type === "group"}
          {@const displayName = isGroup
            ? conversation.groupName || "Group"
            : conversation.otherParticipant?.displayName || "Unknown"}
          {@const avatarSrc = isGroup
            ? conversation.groupAvatar
            : conversation.otherParticipant?.avatar}
          <button
            class="list-item"
            class:unread={conversation.unreadCount > 0}
            onclick={openDrawerToMessages}
          >
            <RobustAvatar
              src={avatarSrc}
              name={displayName}
              size="sm"
              alt={displayName}
            />
            <div class="item-content">
              <div class="item-header">
                <span class="item-name">
                  {#if isGroup}
                    <i
                      class="fas fa-users"
                      style="font-size: 10px; margin-right: 4px;"
                      aria-hidden="true"
                    ></i>
                  {/if}
                  {displayName}
                </span>
                <span class="item-time"
                  >{formatTimeAgo(conversation.updatedAt)}</span
                >
              </div>
              <span class="item-preview">
                {conversation.lastMessage?.content || "No messages yet"}
              </span>
            </div>
            {#if conversation.unreadCount > 0}
              <span class="unread-dot"></span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <!-- Alerts list -->
      <div class="item-list">
        {#each notifications as notification}
          <button
            class="list-item"
            class:unread={!notification.read}
            onclick={openDrawerToNotifications}
          >
            <div class="item-icon">
              {#if notification.type === "message-received"}
                <i class="fas fa-envelope" aria-hidden="true"></i>
              {:else if notification.type.startsWith("feedback-")}
                <i class="fas fa-comment-dots" aria-hidden="true"></i>
              {:else if notification.type === "achievement-unlocked"}
                <i class="fas fa-trophy" aria-hidden="true"></i>
              {:else if notification.type === "sequence-liked"}
                <i class="fas fa-heart" aria-hidden="true"></i>
              {:else if notification.type === "user-followed"}
                <i class="fas fa-user-plus" aria-hidden="true"></i>
              {:else}
                <i class="fas fa-bell" aria-hidden="true"></i>
              {/if}
            </div>
            <div class="item-content">
              <span class="item-preview">{notification.message}</span>
              <span class="item-time"
                >{formatTimeAgo(notification.createdAt)}</span
              >
            </div>
            {#if !notification.read}
              <span class="unread-dot"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .inbox-widget {
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

  /* ========================================
     TAB BUTTONS
     ======================================== */
  .tab-buttons {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .tab-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .tab-btn.active {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 20%,
      var(--theme-card-bg)
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 40%,
      transparent
    );
    color: var(--theme-text);
  }

  .tab-btn i {
    font-size: var(--font-size-sm);
  }

  .tab-count-badge {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--semantic-error, var(--semantic-error));
    border-radius: 9px;
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ========================================
     CONTENT AREA
     ======================================== */
  .content-area {
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
    gap: 8px;
    text-align: center;
    padding: 24px 16px;
    flex: 1;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: var(--theme-text-dim);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* ========================================
     ITEM LIST
     ======================================== */
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--theme-card-bg);
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .list-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke, var(--theme-stroke));
  }

  .list-item.unread {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      var(--theme-card-bg)
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 30%,
      transparent
    );
  }

  /* Icon for alerts */
  .item-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 25%,
      var(--theme-card-bg)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--semantic-info, var(--semantic-info));
    font-size: var(--font-size-compact);
  }

  .item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .item-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-preview {
    font-size: 0.75rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-time {
    font-size: 0.6875rem;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .unread-dot {
    width: 8px;
    height: 8px;
    background: var(--semantic-info, var(--semantic-info));
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ========================================
     RESPONSIVE
     ======================================== */
  @media (max-width: 768px) {
    .inbox-widget {
      padding: 14px;
      border-radius: 16px;
    }

    .tab-btn {
      padding: 10px 12px;
      font-size: 0.8125rem;
    }

    .tab-btn i {
      font-size: var(--font-size-compact);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-btn,
    .list-item {
      transition: none;
    }
  }
</style>
