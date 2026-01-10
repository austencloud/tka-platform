<script lang="ts">
  /**
   * MessagesDrawer
   *
   * Dedicated drawer for viewing and managing conversations.
   * Mobile: Opens from bottom. Desktop: Opens from right.
   * No tabs, no notifications - focused on messages only.
   */

  import { onMount, onDestroy } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import ConversationList from "$lib/shared/inbox/components/messages/ConversationList.svelte";
  import MessageThread from "$lib/shared/inbox/components/messages/MessageThread.svelte";
  import NewMessageSheet from "$lib/shared/inbox/components/messages/NewMessageSheet.svelte";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import { messagingService } from "$lib/shared/messaging/services/implementations/Messenger";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  // Props
  interface Props {
    isOpen?: boolean;
    pendingConversationId?: string;
  }

  let {
    isOpen = $bindable(false),
    pendingConversationId = $bindable(""),
  }: Props = $props();

  // Responsive placement
  let isMobile = $state(false);
  let placement = $derived(isMobile ? "bottom" : "right") as "bottom" | "right";

  // Local view state
  let currentView = $state<"list" | "thread" | "compose">("list");

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  // Media query for responsive behavior
  let mediaQuery: MediaQueryList | null = null;
  function handleMediaChange(e: MediaQueryListEvent) {
    isMobile = e.matches;
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    mediaQuery = window.matchMedia("(max-width: 768px)");
    isMobile = mediaQuery.matches;
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  // Handle opening with pending conversation or resetting to list
  $effect(() => {
    if (isOpen && pendingConversationId) {
      // Set loading state immediately to prevent flash of conversation list
      inboxState.setLoadingMessages(true);
      currentView = "thread";

      // Open directly to thread
      const conversationId = pendingConversationId;
      pendingConversationId = ""; // Clear immediately
      handleConversationSelect(conversationId);
    } else if (!isOpen) {
      // Delay view reset until after drawer closing animation completes (300ms)
      setTimeout(() => {
        currentView = "list";
      }, 300);
    }
  });

  // Get current user ID (respects View As feature)
  const currentUserId = $derived(
    userPreviewState.isActive && userPreviewState.data.profile
      ? userPreviewState.data.profile.uid
      : authState.user?.uid
  );

  function handleClose() {
    hapticService?.trigger("selection");
    isOpen = false;
  }

  async function handleConversationSelect(conversationId: string) {
    try {
      const conversation =
        await conversationService.getConversation(conversationId);
      if (conversation) {
        inboxState.selectConversation(conversation);

        // Set loading state BEFORE changing view to prevent layout shift
        inboxState.setLoadingMessages(true);
        currentView = "thread";

        // Subscribe to messages
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
    currentView = "compose";
  }

  function handleBack() {
    hapticService?.trigger("selection");
    currentView = "list";
    inboxState.backToList();
  }

  function handleCancelCompose() {
    hapticService?.trigger("selection");
    currentView = "list";
    inboxState.cancelCompose();
  }

  // Custom escape handler - navigate back within drawer before closing
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();

      if (currentView === "thread") {
        handleBack();
      } else if (currentView === "compose") {
        handleCancelCompose();
      } else {
        handleClose();
      }
    }
  }

  // Get other participant name for thread header
  const threadParticipantName = $derived(() => {
    if (!inboxState.selectedConversation) return "Conversation";
    const participantInfo = inboxState.selectedConversation.participantInfo;
    const otherKey = Object.keys(participantInfo || {}).find(
      (k) => k !== currentUserId
    );
    return otherKey ? participantInfo[otherKey]?.displayName : "Conversation";
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<Drawer
  bind:isOpen
  {placement}
  showHandle={isMobile}
  closeOnBackdrop={true}
  closeOnEscape={false}
  onclose={handleClose}
  class="messages-drawer {isMobile && currentView !== 'list'
    ? 'messages-expanded'
    : ''}"
  ariaLabel="Messages"
>
  <div
    class="messages-container"
    class:expanded={isMobile && currentView !== "list"}
    role="dialog"
    aria-labelledby="messages-title"
  >
    <!-- Header -->
    <header class="messages-header">
      {#if currentView === "list"}
        <h2 id="messages-title">Messages</h2>
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close messages"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {:else if currentView === "thread"}
        <button
          class="back-button"
          onclick={handleBack}
          aria-label="Back to conversations"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h2 id="messages-title">{threadParticipantName()}</h2>
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close messages"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {:else if currentView === "compose"}
        <button
          class="back-button"
          onclick={handleCancelCompose}
          aria-label="Cancel new message"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h2 id="messages-title">New Message</h2>
        <div class="spacer"></div>
      {/if}
    </header>

    <!-- Content -->
    <section class="messages-content">
      {#if currentView === "list"}
        <ConversationList
          conversations={inboxState.conversations}
          isLoading={inboxState.isLoadingConversations}
          onSelect={handleConversationSelect}
          onNewMessage={handleNewMessage}
        />
      {:else if currentView === "thread"}
        {#if inboxState.selectedConversation}
          <MessageThread
            conversation={inboxState.selectedConversation}
            messages={inboxState.messages}
            isLoading={inboxState.isLoadingMessages}
          />
        {:else}
          <div class="thread-loading">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Loading conversation...</span>
          </div>
        {/if}
      {:else if currentView === "compose"}
        <NewMessageSheet
          recipientId={inboxState.composeRecipientId}
          recipientName={inboxState.composeRecipientName}
          onConversationCreated={handleConversationSelect}
          onCancel={handleCancelCompose}
        />
      {/if}
    </section>
  </div>
</Drawer>

<style>
  .messages-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  .messages-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .messages-header h2 {
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
  .close-button {
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
  .close-button:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .back-button:active,
  .close-button:active {
    transform: scale(0.95);
  }

  .back-button:focus-visible,
  .close-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .spacer {
    width: var(--min-touch-target);
  }

  .messages-content {
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

  :global(.drawer-content.messages-drawer) {
    --sheet-width: min(480px, 95vw);
    width: var(--sheet-width) !important;
  }

  @media (max-width: 768px) {
    :global(.drawer-content.messages-drawer) {
      --sheet-width: 100%;
      width: 100% !important;
    }

    /* When expanded (thread/compose view), fill the viewport */
    :global(.drawer-content.messages-drawer.messages-expanded) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }

    .messages-container.expanded {
      max-height: none;
      height: 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .close-button {
      transition: none !important;
    }
  }
</style>
