<!-- InboxNavButton - Circular inbox button for bottom navigation -->
<script lang="ts">
  import NavButton from "./NavButton.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";

  let {
    onLongPress = undefined,
    longPressMs = 500,
  } = $props<{
    onLongPress?: () => void;
    longPressMs?: number;
  }>();

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressNextClick = false;

  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const badgeCount = $derived(
    inboxState.totalUnreadCount > 99
      ? "99+"
      : String(inboxState.totalUnreadCount)
  );

  function handleClick(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    inboxState.open();
  }

  function handleTouchStart(event: TouchEvent) {
    // Prevent Android context menu and gesture navigation from triggering
    event.stopPropagation();

    // Start long press timer on touch devices
    if (onLongPress) {
      clearLongPress();
      longPressTimer = setTimeout(() => {
        suppressNextClick = true;
        onLongPress?.();
      }, longPressMs);
    }
  }

  function handleTouchMove(event: TouchEvent) {
    // If user moves finger, cancel long press
    clearLongPress();
  }

  function handleTouchEnd(event: TouchEvent) {
    // Prevent browser from triggering native share sheet or context menus
    event.preventDefault();
    event.stopPropagation();

    clearLongPress();

    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    handleClick(event);
  }

  function handleTouchCancel() {
    clearLongPress();
    suppressNextClick = false;
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleWrapperClick(event: MouseEvent) {
    // Only handle mouse clicks - touch is handled by touchend
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    handleClick(event);
  }
</script>

<div
  class="inbox-nav-button-wrapper"
  onclick={handleWrapperClick}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchCancel}
  oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
  onkeydown={(e) =>
    e.key === "Enter" && handleClick(e as unknown as MouseEvent)}
  role="button"
  tabindex="0"
>
  <div class="inbox-button-container" class:has-unread={hasUnread}>
    <NavButton
      icon="<i class='fas fa-inbox'></i>"
      label="Inbox"
      type="special"
      color="rgba(255, 255, 255, 1)"
      gradient="rgba(255, 255, 255, 1)"
      ariaLabel="Open inbox{hasUnread ? `, ${inboxState.totalUnreadCount} unread` : ''}"
      active={false}
    />
    {#if hasUnread}
      <span class="unread-badge" aria-hidden="true">
        {badgeCount}
      </span>
    {/if}
  </div>
</div>

<style>
  .inbox-nav-button-wrapper {
    display: contents;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .inbox-button-container {
    position: relative;
    display: inline-flex;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--semantic-error, #ef4444);
    border-radius: 9px;
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    box-shadow: 0 2px 4px hsl(0 0% 0% / 0.3);
    pointer-events: none;
    animation: badgePop var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 1;
  }

  @keyframes badgePop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Subtle glow effect when there are unread items */
  .inbox-button-container.has-unread :global(.nav-button.special) {
    border-color: color-mix(in srgb, var(--semantic-info) 40%, var(--theme-accent));
  }

  @media (prefers-reduced-motion: reduce) {
    .unread-badge {
      animation: none;
    }
  }
</style>
