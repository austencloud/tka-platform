<!-- FeedbackKanbanCard - Compact card for Kanban board -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { FeedbackItem } from "../../domain/models/feedback-models";
  import {
    TYPE_CONFIG,
    PRIORITY_CONFIG,
  } from "../../domain/models/feedback-models";
  import { generateAvatarUrl } from "$lib/shared/foundation/utils/avatar-generator";

  const {
    item,
    isSelected,
    disableDrag = false,
    onDragStart,
    onDragEnd,
    onTouchDrag,
    onTouchEnd,
    onClick,
  } = $props<{
    item: FeedbackItem;
    isSelected: boolean;
    disableDrag?: boolean;
    onDragStart: (item: FeedbackItem) => void;
    onDragEnd: () => void;
    onTouchDrag?: (item: FeedbackItem, x: number, y: number) => void;
    onTouchEnd?: (x: number, y: number) => void;
    onClick: () => void;
  }>();

  const typeConfig = $derived(
    item.type && item.type in TYPE_CONFIG
      ? TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG]
      : null
  );
  const priorityConfig = $derived(
    item.priority && item.priority in PRIORITY_CONFIG
      ? PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG]
      : null
  );

  // Use Google photo if available, fallback to generated avatar
  const avatarUrl = $derived(
    item.userPhotoURL || generateAvatarUrl(item.userDisplayName, 64)
  );

  // Format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  let isDragging = $state(false);
  let cardElement: HTMLButtonElement | null = null;

  // Track if we just finished dragging (to prevent click after drag)
  let justDragged = false;

  // Mount touch listeners with passive: false to allow preventDefault
  // Only set up touch drag listeners if drag is not disabled
  onMount(() => {
    if (!cardElement || disableDrag) return;

    cardElement.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    cardElement.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    cardElement.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });
    cardElement.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });

    return () => {
      if (!cardElement) return;
      cardElement.removeEventListener("touchstart", handleTouchStart);
      cardElement.removeEventListener("touchmove", handleTouchMove);
      cardElement.removeEventListener("touchend", handleTouchEnd);
      cardElement.removeEventListener("touchcancel", handleTouchCancel);
    };
  });

  // Wrapper for click to prevent click after drag
  function handleClick(e: MouseEvent) {
    if (justDragged) {
      e.preventDefault();
      e.stopPropagation();
      justDragged = false;
      return;
    }
    onClick();
  }

  // Desktop drag and drop
  function handleDragStart(e: DragEvent) {
    isDragging = true;
    e.dataTransfer?.setData("text/plain", item.id);
    onDragStart(item);
  }

  function handleDragEnd() {
    isDragging = false;
    onDragEnd();
  }

  // Touch drag and drop for mobile
  let touchStartPos = { x: 0, y: 0 };
  let touchStartTime = 0;
  let isTouchDragging = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let dragGhost: HTMLElement | null = null;
  let cardRect: DOMRect | null = null;

  function createDragGhost(x: number, y: number) {
    if (!cardElement) return;

    // Get card dimensions
    cardRect = cardElement.getBoundingClientRect();

    // Create ghost element
    dragGhost = cardElement.cloneNode(true) as HTMLElement;
    dragGhost.style.cssText = `
      position: fixed;
      left: ${x - cardRect.width / 2}px;
      top: ${y - cardRect.height / 2}px;
      width: ${cardRect.width}px;
      height: ${cardRect.height}px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0.9;
      transform: scale(1.05) rotate(2deg);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 2px ${typeConfig?.color ?? "var(--theme-accent)"};
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    `;
    document.body.appendChild(dragGhost);
  }

  function moveDragGhost(x: number, y: number) {
    if (!dragGhost || !cardRect) return;
    dragGhost.style.left = `${x - cardRect.width / 2}px`;
    dragGhost.style.top = `${y - cardRect.height / 2}px`;
  }

  function removeDragGhost() {
    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
      cardRect = null;
    }
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchStartTime = Date.now();
    const startX = touch.clientX;
    const startY = touch.clientY;

    // Start long press timer (150ms - faster pickup)
    longPressTimer = setTimeout(() => {
      isTouchDragging = true;
      isDragging = true;
      createDragGhost(startX, startY);
      onDragStart(item);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 150);
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // If already dragging, just move the ghost
    if (isTouchDragging) {
      e.preventDefault();
      moveDragGhost(touch.clientX, touch.clientY);
      onTouchDrag?.(item, touch.clientX, touch.clientY);
      return;
    }

    // Not yet dragging - check if this is a scroll gesture
    // Only cancel if VERTICAL movement dominates (user wants to scroll list)
    // Horizontal movement means they're trying to drag to another column
    if (deltaY > 15 && deltaY > deltaX * 1.5) {
      // Vertical scroll detected - cancel long press
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      return;
    }

    // If there's significant horizontal movement, accelerate drag activation
    // (user clearly wants to drag, not scroll)
    if (deltaX > 20 && deltaX > deltaY && longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      isTouchDragging = true;
      isDragging = true;
      createDragGhost(touch.clientX, touch.clientY);
      onDragStart(item);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      e.preventDefault();
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (isTouchDragging) {
      // End drag - prevent the subsequent click event (only if cancelable)
      if (e.cancelable) e.preventDefault();
      justDragged = true;

      // Get the final touch position for drop handling
      const touch = e.changedTouches[0];
      if (touch && onTouchEnd) {
        onTouchEnd(touch.clientX, touch.clientY);
      }

      removeDragGhost();
      isTouchDragging = false;
      isDragging = false;
      onDragEnd();
    }
    // For quick taps, let the natural click event handle it
  }

  function handleTouchCancel() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (isTouchDragging) {
      removeDragGhost();
      isTouchDragging = false;
      isDragging = false;
      onDragEnd();
    }
  }
</script>

<button
  bind:this={cardElement}
  type="button"
  class="kanban-card"
  class:selected={isSelected}
  class:dragging={isDragging}
  class:drag-disabled={disableDrag}
  class:priority-critical={item.priority === "critical"}
  class:priority-high={item.priority === "high"}
  class:priority-medium={item.priority === "medium"}
  class:priority-low={item.priority === "low" || !item.priority}
  style="--type-color: {typeConfig?.color ??
    'var(--theme-accent)'}; --priority-color: {priorityConfig?.color ||
    '#6b7280'}"
  draggable={!disableDrag}
  ondragstart={disableDrag ? undefined : handleDragStart}
  ondragend={disableDrag ? undefined : handleDragEnd}
  onclick={handleClick}
  aria-label="View {item.title}"
>
  <!-- Priority indicator strip (left border) -->
  <div class="priority-strip"></div>

  <div class="card-content">
    <!-- Header: User avatar + Title + Priority badge -->
    <div class="card-header">
      <img
        src={avatarUrl}
        alt={item.userDisplayName}
        class="header-avatar"
        title={item.userDisplayName}
        referrerpolicy="no-referrer"
        crossorigin="anonymous"
      />
      <h4 class="card-title">{item.title}</h4>
      {#if priorityConfig}
        <span class="priority-badge" title="{priorityConfig.label} priority">
          {#if item.priority === "critical"}
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          {:else if item.priority === "high"}
            <i class="fas fa-arrow-up" aria-hidden="true"></i>
          {:else if item.priority === "medium"}
            <i class="fas fa-minus" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-arrow-down" aria-hidden="true"></i>
          {/if}
        </span>
      {/if}
    </div>

    <!-- Description preview -->
    <p class="card-description">{item.description}</p>

    <!-- Screenshot indicator -->
    {#if item.imageUrls && item.imageUrls.length > 0}
      <div class="screenshot-indicator">
        <i class="fas fa-images" aria-hidden="true"></i>
        <span
          >{item.imageUrls.length} screenshot{item.imageUrls.length !== 1
            ? "s"
            : ""}</span
        >
      </div>
    {/if}

    <!-- Footer: User + Time -->
    <div class="card-footer">
      <div class="card-meta">
        <span class="meta-user">
          {item.userDisplayName?.split(" ")[0] || "Unknown"}
        </span>
        <span class="meta-time">{formatRelativeTime(item.createdAt)}</span>
      </div>
    </div>
  </div>

  <!-- Drag handle indicator -->
  <div class="drag-handle" aria-hidden="true">
    <i class="fas fa-grip-vertical" aria-hidden="true"></i>
  </div>
</button>

<style>
  .kanban-card {
    /* ===== FLUID SPACING ===== */
    --kc-space-2xs: clamp(4px, 1cqi, 8px);
    --kc-space-xs: clamp(8px, 2cqi, 12px);
    --kc-space-sm: clamp(12px, 3cqi, 18px);

    /* ===== FLUID TYPOGRAPHY - Accessible minimums ===== */
    --kc-text-2xs: clamp(0.75rem, 2cqi, 0.8125rem); /* min 12px - accessible */
    --kc-text-xs: clamp(0.8125rem, 2.2cqi, 0.875rem); /* min 13px */
    --kc-text-sm: clamp(0.875rem, 2.5cqi, 1rem); /* min 14px */

    /* ===== FLUID RADII ===== */
    --kc-radius-sm: clamp(8px, 2cqi, 12px);
    --kc-radius-md: clamp(12px, 3cqi, 18px);

    --kc-text: var(--theme-text);
    --kc-text-muted: color-mix(in srgb, var(--theme-text) 75%, transparent);
    --kc-text-subtle: var(--theme-text-dim);

    --spring-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

    position: relative;
    display: flex;
    width: 100%;
    padding: 0;
    /* Prevent flex container from shrinking card below content size */
    flex-shrink: 0;
    min-height: fit-content;
    /* Colorful gradient background using type color */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--type-color) 8%, rgba(30, 30, 40, 0.95)) 0%,
      color-mix(in srgb, var(--type-color) 3%, rgba(25, 25, 35, 0.98)) 100%
    );
    border: 1px solid
      color-mix(in srgb, var(--type-color) 20%, rgba(255, 255, 255, 0.08));
    border-radius: var(--kc-radius-md);
    cursor: grab;
    text-align: left;
    overflow: hidden;
    transition: all var(--duration-normal) var(--spring-smooth);
    box-shadow:
      0 2px 8px var(--theme-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .kanban-card:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--type-color) 15%, rgba(35, 35, 45, 0.95)) 0%,
      color-mix(in srgb, var(--type-color) 8%, rgba(30, 30, 40, 0.98)) 100%
    );
    border-color: color-mix(
      in srgb,
      var(--type-color) 40%,
      var(--theme-stroke)
    );
    transform: translateY(-2px) scale(1.01);
    box-shadow:
      0 8px 20px var(--theme-shadow),
      0 0 20px color-mix(in srgb, var(--type-color) 15%, transparent),
      inset 0 1px 0 var(--theme-card-bg);
  }

  .kanban-card:active {
    cursor: grabbing;
    transform: scale(0.98);
  }

  .kanban-card.drag-disabled {
    cursor: default;
  }

  .kanban-card.drag-disabled:active {
    cursor: default;
    transform: none;
  }

  .kanban-card.selected {
    border-color: var(--type-color);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--type-color) 30%, transparent),
      0 4px 16px color-mix(in srgb, var(--type-color) 20%, transparent);
  }

  .kanban-card.dragging {
    opacity: 0.4;
    transform: scale(0.95);
  }

  /* Priority indicator strip on left */
  .priority-strip {
    width: clamp(4px, 1cqi, 6px);
    flex-shrink: 0;
    background: linear-gradient(
      180deg,
      var(--priority-color) 0%,
      color-mix(in srgb, var(--priority-color) 70%, transparent) 100%
    );
    box-shadow: 2px 0 8px
      color-mix(in srgb, var(--priority-color) 30%, transparent);
  }

  /* Priority-specific card styling */
  .kanban-card.priority-critical {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-error) 12%, rgba(30, 30, 40, 0.95)) 0%,
      color-mix(in srgb, var(--semantic-error) 5%, rgba(25, 25, 35, 0.98)) 100%
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error) 30%,
      rgba(255, 255, 255, 0.08)
    );
  }

  .kanban-card.priority-high {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #f97316 10%, rgba(30, 30, 40, 0.95)) 0%,
      color-mix(in srgb, #f97316 4%, rgba(25, 25, 35, 0.98)) 100%
    );
    border-color: color-mix(in srgb, #f97316 25%, rgba(255, 255, 255, 0.08));
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--kc-space-sm);
    padding: var(--kc-space-sm);
    min-width: 0;
    min-height: min-content;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: flex-start;
    gap: var(--kc-space-xs);
  }

  .header-avatar {
    width: clamp(24px, 5cqi, 30px);
    height: clamp(24px, 5cqi, 30px);
    flex-shrink: 0;
    border-radius: var(--kc-radius-sm);
    object-fit: cover;
    box-shadow: 0 2px 6px var(--theme-shadow);
  }

  .card-title {
    margin: 0;
    flex: 1;
    font-size: var(--kc-text-sm);
    font-weight: 600;
    color: var(--kc-text);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Description */
  .card-description {
    margin: 0;
    font-size: var(--kc-text-xs);
    color: var(--kc-text-muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex-shrink: 0;
    /* Ensure space for 3 lines based on fluid font size */
    min-height: 3.6em; /* 3 lines * 1.5 line-height = 4.5em, but using em units for proper scaling */
  }

  /* Screenshot indicator */
  .screenshot-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: var(--kc-text-2xs);
    color: var(--kc-text-subtle);
  }

  .screenshot-indicator i {
    font-size: var(--font-size-compact);
    color: var(--type-color);
  }

  /* Footer */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kc-space-xs);
    margin-top: auto;
    padding-top: var(--kc-space-xs);
    border-top: 1px solid
      color-mix(in srgb, var(--type-color) 10%, rgba(255, 255, 255, 0.05));
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: var(--kc-space-sm);
    font-size: var(--kc-text-2xs);
    color: var(--kc-text-subtle);
  }

  .meta-user,
  .meta-time {
    display: flex;
    align-items: center;
    gap: clamp(2px, 0.5cqi, 4px);
  }

  /* Priority badge in header */
  .priority-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(18px, 3.5cqi, 22px);
    height: clamp(18px, 3.5cqi, 22px);
    flex-shrink: 0;
    background: color-mix(in srgb, var(--priority-color) 20%, transparent);
    border-radius: clamp(4px, 0.8cqi, 6px);
    color: var(--priority-color);
    font-size: clamp(8px, 1.6cqi, 10px);
  }

  .kanban-card.priority-critical .priority-badge {
    background: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    color: var(--semantic-error);
    animation: pulse-critical 2s ease-in-out infinite;
  }

  @keyframes pulse-critical {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Drag handle */
  .drag-handle {
    position: absolute;
    top: 50%;
    right: var(--kc-space-xs);
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(14px, 3cqi, 18px);
    height: clamp(28px, 6cqi, 36px);
    color: var(--kc-text-subtle);
    font-size: clamp(9px, 1.8cqi, 11px);
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .kanban-card:hover .drag-handle {
    opacity: 0.5;
  }

  /* Hide drag handle when drag is disabled */
  .kanban-card.drag-disabled .drag-handle {
    display: none;
  }

  /* Focus state */
  .kanban-card:focus-visible {
    outline: none;
    border-color: var(--semantic-success, var(--semantic-success));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 20%,
        transparent
      );
  }

  /* ===== Mobile optimizations ===== */
  @container kanban (max-width: 652px) {
    .kanban-card {
      /* Remove hover transform on mobile - feels janky */
      transform: none !important;
    }

    .kanban-card:hover {
      transform: none;
    }

    .kanban-card:active {
      transform: scale(0.98);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--type-color) 18%, rgba(35, 35, 45, 0.95)) 0%,
        color-mix(in srgb, var(--type-color) 10%, rgba(30, 30, 40, 0.98)) 100%
      );
    }

    /* Hide drag handle on mobile - use touch drag instead */
    .drag-handle {
      display: none;
    }

    /* Slightly larger touch targets */
    .card-content {
      padding: var(--kc-space-sm) var(--kc-space-sm);
    }
  }

  /* ===== Reduced Motion ===== */
  @media (prefers-reduced-motion: reduce) {
    .kanban-card {
      transition: none;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .priority-badge {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="pulse-critical"] {
      animation: none;
    }
  }
</style>
