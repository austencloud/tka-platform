<!--
  MessageActions.svelte

  Facebook Messenger-style reaction bar with modern action menu.
  - Long-press (mobile) or hover (desktop) shows floating emoji bar
  - Small "more" button opens action menu (Reply, Copy, Copy for AI, Edit, Delete)
  - Prevents native context menu for seamless experience
  - Pointer/tail connects bar to message bubble
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, type Snippet } from "svelte";
  import type { Message } from "$lib/shared/messaging/domain/models/message-models";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { messagingService } from "$lib/shared/messaging/services/messenger";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";

  const LONG_PRESS_MS = 400;
  const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "👎"];

  let {
    message,
    isOwn,
    children,
  } = $props<{
    message: Message;
    isOwn: boolean;
    children: Snippet;
  }>();

  let showReactions = $state(false);
  let showMoreMenu = $state(false);
  let showDeleteConfirm = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let wrapperEl: HTMLDivElement | undefined = $state();

  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();
    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    };
  });

  // Direct DOM click listener - bypasses Svelte 5 event delegation
  // which doesn't reliably fire inside <dialog> elements opened with .show()
  $effect(() => {
    if (!wrapperEl) return;
    const handler = (e: MouseEvent) => {
      handleClick(e);
    };
    wrapperEl.addEventListener("click", handler);
    return () => {
      wrapperEl?.removeEventListener("click", handler);
    };
  });

  const isMobile = $derived(!layoutState.isSideBySideLayout);
  const isAuthenticated = $derived(authState.isAuthenticated && !authState.loading);
  const canEdit = $derived(isOwn && !message.isDeleted);
  const canDelete = $derived(isOwn && !message.isDeleted);

  // Long-press for mobile
  function handleTouchStart() {
    if (!isMobile) return;

    longPressTimer = setTimeout(() => {
      hapticService?.trigger("selection");
      showReactions = true;
    }, LONG_PRESS_MS);
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // Click to toggle reactions on desktop (supplements hover)
  function handleClick(event: MouseEvent) {
    if (isMobile) return;
    // Don't toggle if clicking inside the reaction bar itself
    const target = event.target as HTMLElement;
    if (target.closest(".reaction-bar")) return;

    showReactions = !showReactions;
    if (!showReactions) showMoreMenu = false;
  }

  // Prevent native context menu (right-click / long-press)
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    hapticService?.trigger("selection");
    showReactions = true;
  }

  // Copy message text to clipboard
  async function handleCopyText() {
    showReactions = false;
    showMoreMenu = false;
    hapticService?.trigger("selection");

    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Message copied");
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy message");
    }
  }

  // Copy message with full metadata for AI analysis
  async function handleCopyForAI() {
    showReactions = false;
    showMoreMenu = false;
    hapticService?.trigger("selection");

    try {
      const formattedMessage = formatMessageForAI(message);
      await navigator.clipboard.writeText(formattedMessage);
      toast.success("Copied for AI");
    } catch (error) {
      console.error("Failed to copy for AI:", error);
      toast.error("Failed to copy message");
    }
  }

  // Format message with all metadata for debugging/AI
  function formatMessageForAI(msg: Message): string {
    const lines: string[] = [
      "## Message Details",
      "",
      `**Message ID:** \`${msg.id}\``,
      `**Conversation ID:** \`${msg.conversationId}\``,
      `**Sender ID:** \`${msg.senderId}\``,
      `**Sender Name:** ${msg.senderName || "Unknown"}`,
      `**Sent:** ${msg.createdAt?.toLocaleString() || "Unknown"}`,
    ];

    if (msg.editedAt) {
      lines.push(`**Edited:** ${msg.editedAt.toLocaleString()}`);
    }

    if (msg.isDeleted) {
      lines.push(`**Status:** Deleted`);
    }

    lines.push("", "### Content", "", msg.content || "(empty)");

    if (msg.replyTo) {
      lines.push(
        "",
        "### Reply To",
        `**Original Message ID:** \`${msg.replyTo.messageId}\``,
        `**Original Sender:** ${msg.replyTo.senderName}`,
        `**Preview:** ${msg.replyTo.content?.slice(0, 100) || "(empty)"}${(msg.replyTo.content?.length || 0) > 100 ? "..." : ""}`
      );
    }

    if (msg.reactions && msg.reactions.length > 0) {
      lines.push(
        "",
        "### Reactions",
        ...msg.reactions.map(
          (r) => `- ${r.emoji}: ${r.userIds.length} user(s)`
        )
      );
    }

    if (msg.attachments && msg.attachments.length > 0) {
      lines.push(
        "",
        "### Attachments",
        ...msg.attachments.map(
          (a) => `- ${a.type}: ${a.name || a.url}`
        )
      );
    }

    return lines.join("\n");
  }

  function handlePointerDownOutside(event: PointerEvent) {
    if (wrapperEl && !wrapperEl.contains(event.target as Node)) {
      showReactions = false;
      showMoreMenu = false;
    }
  }

  $effect(() => {
    if (showReactions || showMoreMenu) {
      const addListenerTimer = setTimeout(() => {
        document.addEventListener("pointerdown", handlePointerDownOutside);
      }, 10);
      return () => {
        clearTimeout(addListenerTimer);
        document.removeEventListener("pointerdown", handlePointerDownOutside);
      };
    }
    return undefined;
  });

  // Actions
  async function handleReaction(emoji: string) {
    showReactions = false;
    hapticService?.trigger("selection");

    // Guard: ensure authenticated before attempting reaction
    if (!isAuthenticated) {
      toast.error(
        authState.loading
          ? "Please wait, authentication loading..."
          : "Please sign in to react"
      );
      return;
    }

    try {
      await messagingService.toggleReaction(message.conversationId, message.id, emoji);
    } catch (error) {
      console.error("Failed to add reaction:", error);
      toast.error("Failed to add reaction");
    }
  }

  function handleMoreClick() {
    showMoreMenu = !showMoreMenu;
  }

  function handleReply() {
    showReactions = false;
    showMoreMenu = false;
    inboxState.setReplyTo(message);
    hapticService?.trigger("selection");
  }

  function handleEdit() {
    showReactions = false;
    showMoreMenu = false;
    inboxState.setEditingMessage(message);
    hapticService?.trigger("selection");
  }

  function handleDeleteRequest() {
    showReactions = false;
    showMoreMenu = false;
    showDeleteConfirm = true;
  }

  async function handleDeleteConfirm() {
    hapticService?.trigger("warning");

    try {
      await messagingService.deleteMessage(message.conversationId, message.id);
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="message-wrapper"
  bind:this={wrapperEl}
  onmouseenter={() => !isMobile && (showReactions = true)}
  onmouseleave={() => {
    if (!isMobile) {
      showReactions = false;
      showMoreMenu = false;
    }
  }}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchmove={handleTouchMove}
  ontouchcancel={handleTouchEnd}
  oncontextmenu={handleContextMenu}
>
  <!-- The message bubble -->
  {@render children()}

  <!-- Floating reaction bar (Facebook Messenger style) -->
  {#if showReactions && !message.isDeleted}
    <div class="reaction-bar" class:own={isOwn}>
      <!-- Emoji reactions with staggered animation -->
      {#each REACTIONS as emoji, i}
        <button
          type="button"
          class="emoji-btn"
          style="--delay: {i * 30}ms"
          onclick={() => handleReaction(emoji)}
          aria-label="React with {emoji}"
        >
          {emoji}
        </button>
      {/each}

      <!-- More button -->
      <button
        type="button"
        class="more-btn"
        class:active={showMoreMenu}
        onclick={handleMoreClick}
        aria-label="More options"
      >
        <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
      </button>

      <!-- Pointer/tail -->
      <div class="pointer"></div>

      <!-- More menu dropdown -->
      {#if showMoreMenu}
        <div class="more-menu">
          <button type="button" class="menu-item" onclick={handleReply}>
            <i class="fa-solid fa-reply" aria-hidden="true"></i>
            Reply
          </button>
          <button type="button" class="menu-item" onclick={handleCopyText}>
            <i class="fa-solid fa-copy" aria-hidden="true"></i>
            Copy
          </button>
          {#if authState.isAdmin}
            <button type="button" class="menu-item" onclick={handleCopyForAI}>
              <i class="fa-solid fa-robot" aria-hidden="true"></i>
              Copy for AI
            </button>
          {/if}
          {#if canEdit}
            <button type="button" class="menu-item" onclick={handleEdit}>
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
              Edit
            </button>
          {/if}
          {#if canDelete}
            <button type="button" class="menu-item danger" onclick={handleDeleteRequest}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
              Delete
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete confirmation -->
<ConfirmDialog
  bind:isOpen={showDeleteConfirm}
  title="Delete Message"
  message="This message will be deleted for everyone. This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  variant="danger"
  onConfirm={handleDeleteConfirm}
  onCancel={() => (showDeleteConfirm = false)}
/>

<style>
  .message-wrapper {
    position: relative;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Floating reaction bar */
  .reaction-bar {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    background: var(--theme-panel-bg, rgba(30, 30, 40, 0.98));
    border-radius: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    z-index: 100;
    animation: bar-pop var(--duration-normal) cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .reaction-bar.own {
    left: auto;
    right: 0;
  }

  /* Pointer/tail connecting to message */
  .pointer {
    position: absolute;
    bottom: -6px;
    left: 20px;
    width: 12px;
    height: 12px;
    background: var(--theme-panel-bg, rgba(30, 30, 40, 0.98));
    transform: rotate(45deg);
    border-radius: 2px;
  }

  .reaction-bar.own .pointer {
    left: auto;
    right: 20px;
  }

  @keyframes bar-pop {
    0% {
      opacity: 0;
      transform: scale(0.8) translateY(8px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Emoji buttons */
  .emoji-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 1.25rem;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 50%;
    transition: transform var(--duration-fast) ease;
    padding: 0;
    opacity: 0;
    animation: emoji-pop var(--duration-normal) cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    animation-delay: var(--delay);
  }

  @keyframes emoji-pop {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .emoji-btn:hover {
    transform: scale(1.3);
    background: rgba(255, 255, 255, 0.1);
  }

  .emoji-btn:active {
    transform: scale(1.5);
  }

  /* More button (ellipsis) */
  .more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: 4px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--duration-fast) ease;
    font-size: var(--font-size-sm, 14px);
    padding: 0;
  }

  .more-btn:hover,
  .more-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: var(--theme-text, #ffffff);
  }

  /* More menu dropdown */
  .more-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 140px;
    padding: 6px;
    background: var(--theme-panel-bg, rgba(30, 30, 40, 0.98));
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    animation: menu-slide var(--duration-fast) ease-out;
    z-index: 101;
  }

  .reaction-bar.own .more-menu {
    right: auto;
    left: 0;
  }

  @keyframes menu-slide {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.12s ease;
    text-align: left;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .menu-item i {
    width: 16px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .menu-item.danger {
    color: var(--semantic-error);
  }

  .menu-item.danger i {
    color: var(--semantic-error);
  }

  /* Mobile: larger touch targets */
  @media (max-width: 768px) {
    .emoji-btn {
      width: 40px;
      height: 40px;
      font-size: 1.4rem;
    }

    .more-btn {
      width: 36px;
      height: 36px;
    }

    .reaction-bar {
      padding: 8px 10px;
    }

    .menu-item {
      padding: 12px 14px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .reaction-bar,
    .emoji-btn,
    .more-menu {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .emoji-btn:hover,
    .emoji-btn:active {
      transform: none;
    }
  }
</style>
