<!--
  MessageActions.svelte

  Message reactions and actions.
  - Hovering or focusing a message reveals an ellipsis beside its bubble
  - Long-press keeps the action menu available on touch devices
  - Clicking a message or long-pressing it opens the reaction bar
  - Right-click remains available away from selectable message text
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
  const REPLY_SWIPE_THRESHOLD = 56;
  const REPLY_SWIPE_MAX = 88;
  const SWIPE_INTENT_DISTANCE = 10;
  const REPLY_SWIPE_VELOCITY = 0.45;
  const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "👎"];

  let { message, isOwn, children } = $props<{
    message: Message;
    isOwn: boolean;
    children: Snippet;
  }>();

  let showReactions = $state(false);
  let showMoreMenu = $state(false);
  let showDeleteConfirm = $state(false);
  let menuOpensAbove = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let wrapperEl: HTMLDivElement | undefined = $state();
  let moreButtonEl: HTMLButtonElement | undefined = $state();
  let actionMenuAnchorEl: HTMLDivElement | undefined = $state();
  let moreMenuEl: HTMLDivElement | undefined = $state();
  let actionTriggerLeft = $state(0);
  let actionTriggerTop = $state(0);
  let actionTriggerReady = $state(false);
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let swipeDistance = $state(0);
  let swipeCueX = $state(8);
  let swipeIntent: "pending" | "horizontal" | "vertical" | null = null;
  let isSwiping = $state(false);
  let replyThresholdCrossed = false;
  let suppressNextClick = false;

  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();
    let positionFrame = requestAnimationFrame(updateActionTriggerPosition);
    const messageBubble = wrapperEl?.querySelector<HTMLElement>(
      '[data-message-action-anchor="true"]'
    );
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(updateActionTriggerPosition);
    });

    if (wrapperEl) resizeObserver.observe(wrapperEl);
    if (messageBubble) resizeObserver.observe(messageBubble);
    if (moreButtonEl) resizeObserver.observe(moreButtonEl);

    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      cancelAnimationFrame(positionFrame);
      resizeObserver.disconnect();
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
  const isAuthenticated = $derived(
    authState.isAuthenticated && !authState.loading
  );
  const canEdit = $derived(isOwn && !message.isDeleted);
  const canDelete = $derived(isOwn && !message.isDeleted);
  const messageActionLabel = $derived(
    isOwn
      ? "Actions for your message"
      : `Actions for message from ${message.senderName || "this sender"}`
  );
  const swipeProgress = $derived(
    Math.min(1, swipeDistance / REPLY_SWIPE_THRESHOLD)
  );
  const swipeVisualOffset = $derived(
    Math.min(32, Math.max(0, swipeDistance) * 0.48)
  );

  // Long-press for mobile
  function handleTouchStart(event: TouchEvent) {
    if (!isMobile) return;
    if (isSelectableTarget(event.target)) {
      clearLongPress();
      resetSwipe();
      return;
    }
    const touch = event.touches[0];
    if (!touch || message.isDeleted) return;

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    swipeIntent = "pending";
    swipeDistance = 0;
    replyThresholdCrossed = false;

    const messageElement =
      wrapperEl?.querySelector<HTMLElement>('[role="article"]');
    if (wrapperEl && messageElement) {
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      swipeCueX = Math.max(42, messageRect.left - wrapperRect.left + 42);
    }

    longPressTimer = setTimeout(() => {
      hapticService?.trigger("selection");
      showReactions = true;
      showMoreMenu = true;
      swipeIntent = null;
    }, LONG_PRESS_MS);
  }

  function clearLongPress(): void {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function resetSwipe(): void {
    swipeDistance = 0;
    swipeIntent = null;
    isSwiping = false;
    replyThresholdCrossed = false;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isMobile || !swipeIntent) return;
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (swipeIntent === "pending") {
      if (
        Math.abs(deltaX) < SWIPE_INTENT_DISTANCE &&
        Math.abs(deltaY) < SWIPE_INTENT_DISTANCE
      ) {
        return;
      }

      clearLongPress();
      swipeIntent =
        deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY)
          ? "horizontal"
          : "vertical";
    }

    if (swipeIntent !== "horizontal") return;

    isSwiping = true;
    const positiveDistance = Math.max(0, deltaX);
    swipeDistance =
      positiveDistance <= REPLY_SWIPE_MAX
        ? positiveDistance
        : REPLY_SWIPE_MAX + Math.sqrt(positiveDistance - REPLY_SWIPE_MAX) * 3;

    if (swipeDistance >= REPLY_SWIPE_THRESHOLD && !replyThresholdCrossed) {
      replyThresholdCrossed = true;
      hapticService?.trigger("selection");
    }
  }

  function handleTouchEnd() {
    clearLongPress();

    if (swipeIntent !== "horizontal") {
      resetSwipe();
      return;
    }

    const elapsed = Math.max(1, Date.now() - touchStartTime);
    const velocity = swipeDistance / elapsed;
    const shouldReply =
      swipeDistance >= REPLY_SWIPE_THRESHOLD ||
      (swipeDistance >= 24 && velocity >= REPLY_SWIPE_VELOCITY);

    suppressNextClick = true;
    resetSwipe();
    if (shouldReply) startReply(false);
  }

  function handleTouchCancel(): void {
    clearLongPress();
    resetSwipe();
  }

  // Click to toggle reactions on desktop (supplements hover)
  function handleClick(event: MouseEvent) {
    if (isMobile) {
      suppressNextClick = false;
      return;
    }
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }
    // Don't toggle if clicking inside the reaction bar itself
    const target = event.target as HTMLElement;
    if (target.closest(".reaction-bar")) return;
    if (target.closest("[data-message-link='true']")) return;
    if (isSelectableTarget(target) && !window.getSelection()?.isCollapsed) {
      return;
    }

    showReactions = !showReactions;
    if (!showReactions) showMoreMenu = false;
  }

  // Prevent native context menu (right-click / long-press)
  function handleContextMenu(event: MouseEvent) {
    if (isSelectableTarget(event.target)) return;
    event.preventDefault();
    hapticService?.trigger("selection");
    showReactions = true;
    showMoreMenu = true;
  }

  function isSelectableTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      Boolean(target.closest("[data-message-selectable='true']"))
    );
  }

  function updateActionTriggerPosition(): void {
    const messageBubble = wrapperEl?.querySelector<HTMLElement>(
      '[data-message-action-anchor="true"]'
    );
    if (!wrapperEl || !messageBubble) return;

    const bubbleOffset = getOffsetWithin(messageBubble, wrapperEl);
    const messageRight = bubbleOffset.left + messageBubble.offsetWidth;
    const triggerWidth = moreButtonEl?.offsetWidth || 44;
    // The 44px hit area overlaps the bubble by 2px, while the inset 32px
    // surface remains 4px away. The control reads as part of the message
    // without sacrificing its touch target.
    const triggerGap = -2;
    const desiredLeft = isOwn
      ? bubbleOffset.left - triggerWidth - triggerGap
      : messageRight + triggerGap;

    actionTriggerLeft = Math.max(
      0,
      Math.min(wrapperEl.clientWidth - triggerWidth, desiredLeft)
    );
    actionTriggerTop = bubbleOffset.top + messageBubble.offsetHeight / 2;
    actionTriggerReady = true;
  }

  function getOffsetWithin(
    element: HTMLElement,
    ancestor: HTMLElement
  ): { left: number; top: number } {
    let left = 0;
    let top = 0;
    let current: HTMLElement | null = element;

    while (current && current !== ancestor) {
      left += current.offsetLeft;
      top += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }

    if (current === ancestor) return { left, top };

    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    return {
      left: elementRect.left - ancestorRect.left,
      top: elementRect.top - ancestorRect.top,
    };
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
        ...msg.reactions.map((r) => `- ${r.emoji}: ${r.userIds.length} user(s)`)
      );
    }

    if (msg.attachments && msg.attachments.length > 0) {
      lines.push(
        "",
        "### Attachments",
        ...msg.attachments.map((a) => `- ${a.type}: ${a.name || a.url}`)
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

  function getVerticalCollisionBounds(element: HTMLElement): {
    top: number;
    bottom: number;
  } {
    let ancestor = element.parentElement;

    while (ancestor) {
      const styles = getComputedStyle(ancestor);
      const clipsVertically = [styles.overflow, styles.overflowY].some(
        (value) => /auto|scroll|hidden|clip/.test(value)
      );

      if (clipsVertically) {
        const rect = ancestor.getBoundingClientRect();
        return {
          top: Math.max(0, rect.top),
          bottom: Math.min(window.innerHeight, rect.bottom),
        };
      }

      ancestor = ancestor.parentElement;
    }

    return { top: 0, bottom: window.innerHeight };
  }

  function updateMenuPlacement(
    actionAnchor: HTMLDivElement,
    menu: HTMLDivElement
  ): void {
    const anchorRect = actionAnchor.getBoundingClientRect();
    // offsetHeight is layout-sized and unaffected by the menu's animation.
    // getBoundingClientRect() would measure the transient scale and can choose
    // the wrong side while the menu is opening.
    const menuHeight = menu.offsetHeight;
    const bounds = getVerticalCollisionBounds(actionAnchor);
    const requiredSpace = menuHeight + 8;
    const spaceAbove = anchorRect.top - bounds.top;
    const spaceBelow = bounds.bottom - anchorRect.bottom;

    menuOpensAbove = spaceBelow < requiredSpace && spaceAbove >= requiredSpace;
  }

  $effect(() => {
    const actionAnchor = actionMenuAnchorEl;
    const menu = moreMenuEl;

    if (!showMoreMenu || !actionAnchor || !menu) {
      menuOpensAbove = false;
      return;
    }

    let placementFrame = requestAnimationFrame(() =>
      updateMenuPlacement(actionAnchor, menu)
    );
    menu
      .querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
    const handleLayoutChange = () => {
      cancelAnimationFrame(placementFrame);
      placementFrame = requestAnimationFrame(() =>
        updateMenuPlacement(actionAnchor, menu)
      );
    };

    window.addEventListener("resize", handleLayoutChange);
    document.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      cancelAnimationFrame(placementFrame);
      window.removeEventListener("resize", handleLayoutChange);
      document.removeEventListener("scroll", handleLayoutChange, true);
    };
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
      await messagingService.toggleReaction(
        message.conversationId,
        message.id,
        emoji
      );
    } catch (error) {
      console.error("Failed to add reaction:", error);
      toast.error("Failed to add reaction");
    }
  }

  function handleMoreClick(event: MouseEvent) {
    event.stopPropagation();
    updateActionTriggerPosition();
    hapticService?.trigger("selection");
    showMoreMenu = !showMoreMenu;
  }

  function handleMenuKeydown(event: KeyboardEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
    const activeIndex = items.indexOf(
      document.activeElement as HTMLButtonElement
    );
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") {
      nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
    } else if (event.key === "ArrowUp") {
      nextIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      showMoreMenu = false;
      requestAnimationFrame(() => moreButtonEl?.focus({ preventScroll: true }));
      return;
    } else {
      return;
    }

    event.preventDefault();
    if (nextIndex !== undefined) {
      items[nextIndex]?.focus({ preventScroll: true });
    }
  }

  function handleMenuFocusout(event: FocusEvent): void {
    const menu = event.currentTarget as HTMLElement;
    if (!menu.contains(event.relatedTarget as Node | null)) {
      showMoreMenu = false;
    }
  }

  function startReply(withHaptic: boolean): void {
    showReactions = false;
    showMoreMenu = false;
    inboxState.setReplyTo(message);
    if (withHaptic) hapticService?.trigger("selection");
  }

  function handleReply(): void {
    startReply(true);
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
  class:own={isOwn}
  bind:this={wrapperEl}
  onmouseenter={updateActionTriggerPosition}
  onfocusin={updateActionTriggerPosition}
  onmouseleave={() => {
    if (!isMobile) {
      showReactions = false;
      showMoreMenu = false;
    }
  }}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchmove={handleTouchMove}
  ontouchcancel={handleTouchCancel}
  oncontextmenu={handleContextMenu}
>
  <span
    class="reply-swipe-cue"
    class:armed={swipeProgress >= 1}
    style:left="{swipeCueX}px"
    style:opacity={swipeProgress}
    aria-hidden="true"
  >
    <i class="fa-solid fa-reply"></i>
  </span>

  <!-- The message bubble -->
  <div
    class="swipe-content"
    class:swiping={isSwiping}
    style:transform="translate3d({swipeVisualOffset}px, 0, 0)"
  >
    {@render children()}
  </div>

  {#if !message.isDeleted}
    <div
      class="action-menu-anchor"
      class:own={isOwn}
      class:open={showMoreMenu}
      class:ready={actionTriggerReady}
      style:left="{actionTriggerLeft}px"
      style:top="{actionTriggerTop}px"
      bind:this={actionMenuAnchorEl}
    >
      <button
        type="button"
        class="message-action-trigger"
        class:active={showMoreMenu}
        bind:this={moreButtonEl}
        onclick={handleMoreClick}
        aria-label={messageActionLabel}
        aria-haspopup="menu"
        aria-expanded={showMoreMenu}
        title="Message actions"
      >
        <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
      </button>

      {#if showMoreMenu}
        <div
          class="more-menu"
          class:above={menuOpensAbove}
          bind:this={moreMenuEl}
          role="menu"
          tabindex="-1"
          aria-label="Message actions"
          onkeydown={handleMenuKeydown}
          onfocusout={handleMenuFocusout}
        >
          <button
            type="button"
            class="menu-item"
            role="menuitem"
            onclick={handleReply}
          >
            <i class="fa-solid fa-reply" aria-hidden="true"></i>
            Reply
          </button>
          <button
            type="button"
            class="menu-item"
            role="menuitem"
            onclick={handleCopyText}
          >
            <i class="fa-solid fa-copy" aria-hidden="true"></i>
            Copy
          </button>
          {#if authState.isAdmin}
            <button
              type="button"
              class="menu-item"
              role="menuitem"
              onclick={handleCopyForAI}
            >
              <i class="fa-solid fa-robot" aria-hidden="true"></i>
              Copy for AI
            </button>
          {/if}
          {#if canEdit}
            <button
              type="button"
              class="menu-item"
              role="menuitem"
              onclick={handleEdit}
            >
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
              Edit
            </button>
          {/if}
          {#if canDelete}
            <button
              type="button"
              class="menu-item danger"
              role="menuitem"
              onclick={handleDeleteRequest}
            >
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
              Delete
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

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

      <button
        type="button"
        class="reply-btn"
        onclick={() => handleReply()}
        aria-label="Reply to message from {message.senderName}"
      >
        <i class="fa-solid fa-reply" aria-hidden="true"></i>
      </button>

      <!-- Pointer/tail -->
      <div class="pointer"></div>
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
    touch-action: pan-y pinch-zoom;
  }

  .message-wrapper :global([data-message-selectable="true"]) {
    -webkit-touch-callout: default;
    -webkit-user-select: text;
    user-select: text;
  }

  .swipe-content {
    position: relative;
    z-index: 1;
    width: 100%;
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .swipe-content.swiping {
    transition: none;
  }

  .action-menu-anchor {
    position: absolute;
    z-index: 102;
    transform: translateY(-50%);
  }

  .action-menu-anchor.open {
    z-index: 200;
  }

  .message-action-trigger {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--touch-target-min, 44px);
    height: var(--touch-target-min, 44px);
    padding: 0;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    background: transparent;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast, 120ms) ease;
  }

  .message-action-trigger::before {
    content: "";
    position: absolute;
    inset: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transform: scale(0.88);
    transition:
      transform var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease,
      border-color var(--duration-fast, 120ms) ease;
  }

  .message-action-trigger i {
    position: relative;
    z-index: 1;
    font-size: var(--font-size-compact, 12px);
  }

  .message-action-trigger:focus,
  .message-action-trigger.active {
    opacity: 1;
    pointer-events: auto;
  }

  .message-action-trigger:hover,
  .message-action-trigger:focus,
  .message-action-trigger.active {
    color: var(--theme-text, #ffffff);
  }

  .message-action-trigger:hover::before,
  .message-action-trigger:focus::before,
  .message-action-trigger.active::before {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.14));
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 42%,
      var(--theme-stroke, rgba(255, 255, 255, 0.12))
    );
    transform: scale(1);
  }

  .message-action-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .message-wrapper:hover .action-menu-anchor.ready .message-action-trigger {
      opacity: 0.82;
      pointer-events: auto;
    }

    .message-wrapper:hover .message-action-trigger::before {
      transform: scale(1);
    }

    .message-wrapper:hover .message-action-trigger:hover,
    .message-wrapper:hover .message-action-trigger:focus,
    .message-wrapper:hover .message-action-trigger.active {
      opacity: 1;
    }
  }

  .reply-swipe-cue {
    position: absolute;
    top: 50%;
    z-index: 0;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-accent, #6366f1);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    transform: translate(-100%, -50%) scale(0.82);
    transition:
      transform var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease;
    pointer-events: none;
  }

  .reply-swipe-cue.armed {
    color: white;
    background: var(--theme-accent, #6366f1);
    transform: translate(-100%, -50%) scale(1);
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
    animation: bar-pop var(--duration-normal)
      cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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
    animation: emoji-pop var(--duration-normal)
      cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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

  .reply-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
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

  .reply-btn {
    margin-left: 4px;
  }

  .reply-btn:hover,
  .reply-btn:focus-visible {
    background: rgba(255, 255, 255, 0.15);
    color: var(--theme-text, #ffffff);
  }

  /* More menu dropdown */
  .more-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 140px;
    padding: 6px;
    background:
      linear-gradient(
        var(--theme-panel-bg, rgba(30, 30, 40, 0.98)),
        var(--theme-panel-bg, rgba(30, 30, 40, 0.98))
      ),
      #121218;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    animation: menu-slide var(--duration-fast) ease-out;
    z-index: 101;
  }

  .more-menu.above {
    top: auto;
    bottom: calc(100% + 8px);
    animation-name: menu-slide-up;
  }

  .action-menu-anchor.own .more-menu {
    right: 0;
    left: auto;
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

  @keyframes menu-slide-up {
    from {
      opacity: 0;
      transform: translateY(4px);
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

    .reaction-bar {
      padding: 8px 10px;
    }

    .menu-item {
      padding: 12px 14px;
    }
  }

  @media (hover: none), (pointer: coarse) {
    .reply-btn {
      display: none;
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

    .swipe-content,
    .reply-swipe-cue,
    .message-action-trigger {
      transition: none;
    }

    .emoji-btn:hover,
    .emoji-btn:active {
      transform: none;
    }
  }
</style>
