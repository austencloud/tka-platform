<script lang="ts">
  /**
   * InboxDrawer
   *
   * Main container for the combined messages + notifications inbox.
   * Uses the existing Drawer component with snap points.
   * Includes bottom navigation on mobile for app navigation.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { inboxState } from "../state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { notificationService } from "$lib/shared/feedback/services/notifier";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { toast } from "../../toast/state/toast-state.svelte";
  import ConversationList from "./messages/ConversationList.svelte";
  import MessageThread from "./messages/MessageThread.svelte";
  import NewMessageSheet from "./messages/NewMessageSheet.svelte";
  import GroupSettingsSheet from "./messages/GroupSettingsSheet.svelte";
  import NotificationList from "./notifications/NotificationList.svelte";
  import { conversationService } from "../../messaging/services/conversation-manager";
  import { messagingService } from "../../messaging/services/messenger";
  import BottomNavigation from "$lib/shared/navigation/components/layouts/BottomNavigation.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import {
    moduleSections,
    handleSectionChange,
    handleModuleChange,
  } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  // Responsive placement
  let isMobile = $state(false);
  let placement = $derived(isMobile ? "bottom" : "right") as "bottom" | "right";

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  // Media query for responsive behavior
  let mediaQuery: MediaQueryList | null = null;
  function handleMediaChange(e: MediaQueryListEvent) {
    isMobile = e.matches;
  }

  // Create a derived value that tracks preview mode (View As feature)
  // Moved up to be available for effects
  const currentUserId = $derived(
    userPreviewState.isActive && userPreviewState.data.profile
      ? userPreviewState.data.profile.uid
      : authState.user?.uid
  );

  onMount(() => {
    hapticService = getHapticFeedback();

    mediaQuery = window.matchMedia("(max-width: 768px)");
    isMobile = mediaQuery.matches;
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  // Handle pending navigation from dashboard widgets
  $effect(() => {
    if (inboxState.isOpen && inboxState.pendingConversationId) {
      const conversationId = inboxState.pendingConversationId;
      inboxState.clearPendingNavigation();
      // Use setTimeout to ensure state is settled before loading
      setTimeout(() => {
        handleConversationSelect(conversationId);
      }, 50);
    }
  });

  $effect(() => {
    if (inboxState.isOpen && inboxState.pendingNotificationId) {
      const notificationId = inboxState.pendingNotificationId;
      inboxState.clearPendingNavigation();
      // Handle notification action
      setTimeout(() => {
        handleNotificationAction(notificationId);
      }, 50);
    }
  });

  // Auto-mark all notifications as read when viewing the notifications tab
  // This provides a clean UX - opening the panel acknowledges all notifications
  $effect(() => {
    if (
      inboxState.isOpen &&
      inboxState.activeTab === "notifications" &&
      inboxState.currentView === "list" &&
      inboxState.unreadNotificationCount > 0
    ) {
      const userId = currentUserId;
      if (userId) {
        // Fire and forget - don't block UI on this
        notificationService.markAllAsRead(userId).catch((error) => {
          console.warn("Failed to mark notifications as read:", error);
        });
      }
    }
  });

  // Handle notification-specific actions (navigate to relevant location)
  async function handleNotificationAction(notificationId: string) {
    const notification = inboxState.notifications.find(
      (n) => n.id === notificationId
    );
    if (!notification) return;

    // Close inbox first for most navigations
    const shouldCloseInbox = ![
      "feedback-resolved",
      "feedback-in-progress",
      "feedback-needs-info",
      "feedback-response",
    ].includes(notification.type);

    switch (notification.type) {
      case "message-received": {
        // Open the conversation directly
        const msgNotification = notification as any;
        if (msgNotification.conversationId) {
          handleConversationSelect(msgNotification.conversationId);
        }
        break;
      }
      case "sequence-liked": {
        // Navigate to browse gallery
        inboxState.close();
        await handleModuleChange("browse" as ModuleId, "gallery");
        break;
      }
      case "user-followed": {
        // Navigate to browse creators
        inboxState.close();
        await handleModuleChange("browse" as ModuleId, "creators");
        break;
      }
      case "achievement-unlocked": {
        // Navigate to collect/achievements
        inboxState.close();
        await handleModuleChange("collect" as ModuleId);
        break;
      }
      case "feedback-resolved":
      case "feedback-in-progress":
      case "feedback-needs-info":
      case "feedback-response": {
        // Navigate to feedback module with the specific feedback item
        inboxState.close();
        await handleModuleChange("feedback" as ModuleId, "my-feedback");
        break;
      }
      default:
        // For unknown types, just stay in notifications list
        break;
    }
  }

  function handleClose() {
    hapticService?.trigger("selection");
    inboxState.close();
  }

  async function handleConversationSelect(conversationId: string) {
    try {
      const conversation =
        await conversationService.getConversation(conversationId);
      if (conversation) {
        inboxState.selectConversation(conversation);

        // Subscribe to messages
        inboxState.setLoadingMessages(true);
        messagingService.subscribeToMessages(conversationId, (messages) => {
          inboxState.setMessages(messages);
          inboxState.setLoadingMessages(false);
        });

        // Mark as read
        await messagingService.markAsRead(conversationId);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      toast.error("Failed to load conversation");
    }
  }

  function handleNewMessage() {
    inboxState.startCompose();
  }

  function handleNewGroup() {
    inboxState.startGroupCompose();
  }

  function handleBack() {
    hapticService?.trigger("selection");
    inboxState.backToList();
  }

  function handleCancelCompose() {
    hapticService?.trigger("selection");
    inboxState.cancelCompose();
  }

  function handleOpenGroupSettings() {
    hapticService?.trigger("selection");
    inboxState.openGroupSettings();
  }

  function handleCloseGroupSettings() {
    hapticService?.trigger("selection");
    inboxState.closeGroupSettings();
  }

  function handleGroupLeft() {
    hapticService?.trigger("success");
    inboxState.backToList();
  }

  // Custom escape handler - navigate back within drawer before closing
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && inboxState.isOpen) {
      event.preventDefault();
      event.stopPropagation();

      if (inboxState.currentView === "thread") {
        handleBack();
      } else if (inboxState.currentView === "compose") {
        inboxState.cancelCompose();
      } else if (inboxState.currentView === "group-settings") {
        inboxState.closeGroupSettings();
      } else {
        handleClose();
      }
    }
  }

  // Get thread header title - group name or participant name
  const threadTitle = $derived(() => {
    if (!inboxState.selectedConversation) return "Conversation";

    // Group conversation - use group name
    if (inboxState.selectedConversation.type === "group") {
      return (
        inboxState.selectedConversation.groupMetadata?.name || "Group Chat"
      );
    }

    // Direct conversation - use other participant's name
    const participantInfo = inboxState.selectedConversation.participantInfo;
    const otherKey = Object.keys(participantInfo || {}).find(
      (k) => k !== currentUserId
    );
    return otherKey ? participantInfo[otherKey]?.displayName : "Conversation";
  });

  // Check if current conversation is a group
  const isGroupConversation = $derived(
    inboxState.selectedConversation?.type === "group"
  );

  // Navigation sections for bottom nav
  const sections = $derived(moduleSections());
  const currentSection = $derived(navigationState.activeTab);
  const isSettingsActive = $derived(
    navigationState.currentModule === "settings"
  );

  function handleNavSectionChange(sectionId: string) {
    handleSectionChange(sectionId);
  }

  function handleModuleSwitcherTap() {
    // Close inbox and go to create module (dashboard was removed)
    inboxState.close();
    handleModuleChange("create" as ModuleId);
  }

  async function handleSettingsTap() {
    inboxState.close();
    if (navigationState.currentModule === "settings") {
      const previousModule = navigationState.previousModule || "create";
      await handleModuleChange(previousModule as ModuleId);
    } else {
      await handleModuleChange("settings" as ModuleId);
    }
  }

  // Copy entire conversation for AI analysis (admin only)
  async function handleCopyConversationForAI() {
    if (!inboxState.selectedConversation) return;
    hapticService?.trigger("selection");

    const conv = inboxState.selectedConversation;
    const lines: string[] = [
      "## Conversation Details",
      "",
      `**Conversation ID:** \`${conv.id}\``,
      `**Type:** ${conv.type || "direct"}`,
      `**Participants:** ${conv.participants.join(", ")}`,
    ];

    if (conv.type === "group" && conv.groupMetadata) {
      lines.push(`**Group Name:** ${conv.groupMetadata.name || "(unnamed)"}`);
      if (conv.groupMetadata.createdBy) {
        lines.push(`**Created By:** ${conv.groupMetadata.createdBy}`);
      }
    }

    // Add participant info
    lines.push("", "### Participants");
    for (const [uid, info] of Object.entries(conv.participantInfo || {})) {
      lines.push(`- **${info.displayName}** (\`${uid}\`)`);
    }

    // Add messages
    lines.push("", "### Messages", "");
    for (const msg of inboxState.messages) {
      const sender = conv.participantInfo[msg.senderId]?.displayName || msg.senderName || "Unknown";
      const timestamp = msg.createdAt?.toLocaleString() || "Unknown";
      const edited = msg.editedAt ? " (edited)" : "";
      const deleted = msg.isDeleted ? " [DELETED]" : "";

      lines.push(`**${sender}** - ${timestamp}${edited}${deleted}`);

      if (msg.replyTo) {
        lines.push(`> Reply to: ${msg.replyTo.senderName}: "${msg.replyTo.content?.slice(0, 50)}..."`);
      }

      lines.push(msg.content || "(empty)");

      if (msg.reactions && msg.reactions.length > 0) {
        const reactionStr = msg.reactions.map(r => `${r.emoji}×${r.userIds.length}`).join(" ");
        lines.push(`Reactions: ${reactionStr}`);
      }

      lines.push("");
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Conversation copied for AI");
    } catch (error) {
      console.error("Failed to copy conversation:", error);
      toast.error("Failed to copy conversation");
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<Drawer
  bind:isOpen={inboxState.isOpen}
  {placement}
  showHandle={isMobile}
  closeOnBackdrop={true}
  closeOnEscape={false}
  onclose={handleClose}
  class="inbox-drawer {isMobile && inboxState.currentView !== 'list'
    ? 'inbox-expanded'
    : ''}"
  ariaLabel="Inbox"
>
  <div
    class="inbox-container"
    class:expanded={isMobile && inboxState.currentView !== "list"}
    role="dialog"
    aria-labelledby="inbox-title"
  >
    <!-- Header -->
    <header class="inbox-header">
      {#if inboxState.currentView === "list"}
        <h2 id="inbox-title">
          {inboxState.activeTab === "notifications" ? "Notifications" : "Messages"}
        </h2>

        <!-- New message and create group buttons -->
        {#if inboxState.activeTab === "messages"}
          <button
            class="header-action-btn primary"
            onclick={handleNewGroup}
            aria-label="Create group"
            title="Create group"
          >
            <i class="fas fa-user-group" aria-hidden="true"></i>
          </button>
          <button
            class="header-action-btn primary"
            onclick={handleNewMessage}
            aria-label="New message"
            title="New message"
          >
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          </button>
        {/if}

        <!-- Notification toggle -->
        <button
          class="header-action-btn notification-toggle"
          class:active={inboxState.activeTab === "notifications"}
          onclick={() => inboxState.setTab(inboxState.activeTab === "notifications" ? "messages" : "notifications")}
          aria-label={inboxState.activeTab === "notifications" ? "Back to messages" : "View notifications"}
          title={inboxState.activeTab === "notifications" ? "Back to messages" : "Notifications"}
        >
          <i class="fas {inboxState.activeTab === 'notifications' ? 'fa-comments' : 'fa-bell'}" aria-hidden="true"></i>
          {#if inboxState.activeTab !== "notifications" && inboxState.unreadNotificationCount > 0}
            <span class="notification-badge" aria-label="{inboxState.unreadNotificationCount} unread">
              {inboxState.unreadNotificationCount > 99 ? "99+" : inboxState.unreadNotificationCount}
            </span>
          {/if}
        </button>

        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close inbox"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {:else if inboxState.currentView === "thread"}
        <button
          class="back-button"
          onclick={handleBack}
          aria-label="Back to conversations"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h2 id="inbox-title">{threadTitle()}</h2>
        {#if isGroupConversation}
          <button
            class="settings-button"
            onclick={handleOpenGroupSettings}
            aria-label="Group settings"
          >
            <i class="fas fa-cog" aria-hidden="true"></i>
          </button>
        {/if}
        {#if authState.isAdmin}
          <button
            class="header-action-btn"
            onclick={handleCopyConversationForAI}
            aria-label="Copy conversation for AI"
            title="Copy for AI"
          >
            <i class="fas fa-robot" aria-hidden="true"></i>
          </button>
        {/if}
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close inbox"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {:else if inboxState.currentView === "compose"}
        <button
          class="back-button"
          onclick={handleCancelCompose}
          aria-label="Cancel new message"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h2 id="inbox-title">{inboxState.composeGroupMode ? "New Group" : "New Message"}</h2>
        <div class="spacer"></div>
      {:else if inboxState.currentView === "group-settings"}
        <!-- GroupSettingsSheet has its own header, just show close -->
        <div class="spacer"></div>
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close inbox"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </header>

    <!-- Content -->
    <section
      class="inbox-content"
      id="{inboxState.activeTab}-panel"
      role="tabpanel"
    >
      {#if inboxState.currentView === "list"}
        {#if inboxState.activeTab === "messages"}
          <ConversationList
            conversations={inboxState.conversations}
            isLoading={inboxState.isLoadingConversations}
            onSelect={handleConversationSelect}
          />
        {:else}
          <NotificationList
            notifications={inboxState.notifications}
            isLoading={inboxState.isLoadingNotifications}
          />
        {/if}
      {:else if inboxState.currentView === "thread"}
        {#if inboxState.selectedConversation}
          <MessageThread
            conversation={inboxState.selectedConversation}
            messages={inboxState.messages}
            isLoading={inboxState.isLoadingMessages}
          />
        {:else}
          <!-- Loading state while conversation loads -->
          <div class="thread-loading">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Loading conversation...</span>
          </div>
        {/if}
      {:else if inboxState.currentView === "compose"}
        <NewMessageSheet
          recipientId={inboxState.composeRecipientId}
          recipientName={inboxState.composeRecipientName}
          groupMode={inboxState.composeGroupMode}
          onConversationCreated={handleConversationSelect}
          onCancel={handleCancelCompose}
        />
      {:else if inboxState.currentView === "group-settings"}
        {#if inboxState.selectedConversation}
          <GroupSettingsSheet
            conversation={inboxState.selectedConversation}
            onClose={handleCloseGroupSettings}
            onGroupLeft={handleGroupLeft}
          />
        {/if}
      {/if}
    </section>
  </div>
</Drawer>

<style>
  .inbox-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  .inbox-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .inbox-header h2 {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .back-button,
  .close-button,
  .settings-button,
  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      transform 0.15s ease;
  }

  .back-button:hover,
  .close-button:hover,
  .settings-button:hover,
  .header-action-btn:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .back-button:active,
  .close-button:active,
  .settings-button:active,
  .header-action-btn:active {
    transform: scale(0.95);
  }

  .back-button:focus-visible,
  .close-button:focus-visible,
  .settings-button:focus-visible,
  .header-action-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Primary action button (new message) */
  .header-action-btn.primary {
    color: var(--theme-accent, var(--semantic-info));
  }

  .header-action-btn.primary:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    color: var(--theme-accent);
  }

  /* Notification toggle */
  .notification-toggle {
    position: relative;
  }

  .notification-toggle.active {
    background: var(--theme-accent, var(--semantic-info));
    color: white;
  }

  .notification-toggle.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 85%, white);
    color: white;
  }

  .notification-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--semantic-error, #ef4444);
    border-radius: 9px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
  }

  .spacer {
    width: var(--min-touch-target);
  }

  .inbox-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .thread-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.875rem;
  }

  .thread-loading i {
    font-size: var(--font-size-2xl);
    color: var(--theme-accent, var(--theme-accent));
  }

  :global(.drawer-content.inbox-drawer) {
    --sheet-width: min(480px, 95vw);
    width: var(--sheet-width) !important;
  }

  @media (max-width: 768px) {
    :global(.drawer-content.inbox-drawer) {
      --sheet-width: 100%;
      width: 100% !important;
      /* Always fill viewport on mobile - list, thread, and compose views */
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }

    .inbox-container.expanded {
      max-height: none;
      height: 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .close-button,
    .settings-button {
      transition: none !important;
    }
  }
</style>
