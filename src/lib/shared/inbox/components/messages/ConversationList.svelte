<script lang="ts">
  /**
   * ConversationList
   *
   * List of conversations with enhanced interactions and error handling
   */

  import { onMount } from "svelte";
  import type { ConversationPreview } from "$lib/shared/messaging/domain/models/conversation-models";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import { toast } from "../../../toast/state/toast-state.svelte";
  import ConversationItem from "./ConversationItem.svelte";
  import ConversationSkeleton from "../skeletons/ConversationSkeleton.svelte";
  import EmptyConversations from "../empty-states/EmptyConversations.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    conversations: ConversationPreview[];
    isLoading: boolean;
    onSelect: (conversationId: string) => void;
    onNewMessage: () => void;
    onNewGroup?: () => void;
  }

  let { conversations, isLoading, onSelect, onNewMessage, onNewGroup }: Props =
    $props();

  let isMarkingRead = $state(false);

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Check if there are any unread messages
  const hasUnread = $derived(conversations.some((c) => c.unreadCount > 0));

  function handleNewMessageClick() {
    hapticService?.trigger("selection");
    onNewMessage();
  }

  function handleNewGroupClick() {
    if (onNewGroup) {
      hapticService?.trigger("selection");
      onNewGroup();
    }
  }

  async function handleMarkAllRead() {
    if (isMarkingRead) return;
    hapticService?.trigger("selection");

    isMarkingRead = true;
    try {
      await conversationService.markAllAsRead();
      toast.success("All messages marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark messages as read");
    } finally {
      isMarkingRead = false;
    }
  }
</script>

<div class="conversation-list" role="region" aria-label="Conversations">
  <!-- Header with New Message, New Group, and Mark All Read -->
  <div class="header-actions">
    <button
      class="new-message-btn"
      onclick={handleNewMessageClick}
      aria-label="Start new conversation"
    >
      <i class="fas fa-pen-to-square" aria-hidden="true"></i>
      <span>New</span>
    </button>
    {#if onNewGroup}
      <button
        class="new-group-btn"
        onclick={handleNewGroupClick}
        aria-label="Create new group"
      >
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>Group</span>
      </button>
    {/if}
    {#if conversations.length > 0 && hasUnread}
      <button
        class="mark-all-read"
        onclick={handleMarkAllRead}
        disabled={isMarkingRead}
        aria-label="Mark all conversations as read"
      >
        {#if isMarkingRead}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-check-double" aria-hidden="true"></i>
        {/if}
        <span>Mark all read</span>
      </button>
    {/if}
  </div>

  {#if isLoading}
    <ConversationSkeleton count={5} />
  {:else if conversations.length === 0}
    <EmptyConversations />
  {:else}
    <div class="conversations" role="list" aria-label="Conversation list">
      {#each conversations as conversation, index (conversation.id)}
        <div
          class="conversation-wrapper"
          style="--stagger-index: {Math.min(index, 10)}"
          role="listitem"
        >
          <ConversationItem
            {conversation}
            onclick={() => onSelect(conversation.id)}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .conversation-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .new-message-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 20px;
    background: var(--theme-accent, var(--semantic-info));
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.15s ease,
      box-shadow 0.2s ease;
  }

  .new-message-btn:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 85%,
      white
    );
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .new-message-btn:active {
    transform: scale(0.97);
  }

  .new-message-btn:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--theme-accent) 40%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .new-group-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.15s ease;
  }

  .new-group-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .new-group-btn:active {
    transform: scale(0.97);
  }

  .new-group-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .mark-all-read {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-accent, var(--semantic-info));
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition:
      background 0.2s ease,
      opacity 0.2s ease;
  }

  .mark-all-read:hover:not(:disabled) {
    background: var(--theme-card-bg);
  }

  .mark-all-read:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mark-all-read:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .conversations {
    flex: 1;
    overflow-y: auto;
  }

  .conversation-wrapper {
    animation: slideInStagger 0.3s ease-out backwards;
    animation-delay: calc(var(--stagger-index) * 30ms);
  }

  @keyframes slideInStagger {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .new-message-btn,
    .new-group-btn,
    .mark-all-read,
    .conversation-wrapper {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
