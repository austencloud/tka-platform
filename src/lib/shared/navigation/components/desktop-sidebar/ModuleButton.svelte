<!-- Module Button Component -->
<!-- Button for a module that can expand/collapse to show sections -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { ModuleDefinition } from "../../domain/types";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import NotificationBadge from "../NotificationBadge.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  // 🚀 Performance: Intent-based prefetching
  import { prefetchOnIntent } from "../../utils/module-prefetch";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  let {
    module,
    isActive,
    isExpanded,
    isCollapsed,
    onClick,
    onContextMenu,
    hasSections = false,
    insideGlassContainer = false,
  } = $props<{
    module: ModuleDefinition;
    isActive: boolean;
    isExpanded: boolean;
    isCollapsed: boolean;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    hasSections?: boolean;
    insideGlassContainer?: boolean;
  }>();

  let hapticService: HapticFeedback | undefined;

  // Get unread notification count (for Dashboard badge - shows only notifications, not messages)
  const notificationUnreadCount = $derived(inboxState.unreadNotificationCount);
  // Get total unread count from inbox (notifications + messages) for Inbox badge
  const inboxUnreadCount = $derived(inboxState.totalUnreadCount);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function handleClick() {
    // When expanded, act as a non-interactive header (ignore left clicks)
    if (isExpanded) return;
    hapticService?.trigger("selection");
    onClick();
  }

  // 🚀 Prefetch on hover intent
  function handleMouseEnter() {
    if (!isActive && !isDisabled) {
      prefetchOnIntent(module.id);
    }
  }

  const isDisabled = $derived(module.disabled ?? false);

  // Translated module label (reactive to locale changes)
  const translatedLabel = $derived.by(() => {
    getReactiveLocale();
    return t(module.labelKey);
  });

  // Get effective user info (previewed user takes priority over actual user)
  const effectivePhotoURL = $derived(
    userPreviewState.isActive && userPreviewState.data.profile?.photoURL
      ? userPreviewState.data.profile.photoURL
      : authState.user?.photoURL || null
  );

  const effectiveDisplayName = $derived(
    userPreviewState.isActive && userPreviewState.data.profile?.displayName
      ? userPreviewState.data.profile.displayName
      : authState.user?.displayName || "User"
  );

  // Note: Dashboard module no longer exists - this code is kept for potential future use
  const showProfilePicture = $derived(false);
  const profilePictureUrl = $derived(effectivePhotoURL || "");
  const profileDisplayName = $derived(effectiveDisplayName);
</script>

<button
  class="module-button"
  class:active={isActive}
  class:expanded={isExpanded}
  class:disabled={isDisabled}
  class:sidebar-collapsed={isCollapsed}
  class:has-sections={hasSections}
  class:inside-glass={insideGlassContainer}
  data-tour-module={module.id}
  onclick={handleClick}
  oncontextmenu={onContextMenu}
  onmouseenter={handleMouseEnter}
  onfocus={handleMouseEnter}
  aria-label={translatedLabel}
  aria-expanded={isExpanded}
  aria-controls="module-sections-{module.id}"
  aria-current={isActive ? "page" : undefined}
  aria-disabled={isDisabled}
  disabled={isDisabled}
  style="--module-color: {module.color || 'var(--theme-accent)'};"
>
  <div class="icon-wrapper">
    {#if showProfilePicture}
      <img
        src={profilePictureUrl}
        alt={profileDisplayName}
        class="profile-avatar"
        crossorigin="anonymous"
        referrerpolicy="no-referrer"
      />
    {:else}
      <span class="module-icon">{@html module.icon}</span>
    {/if}

    <!-- Notification Badge for Dashboard (notifications only) or Inbox (all unread) -->
    {#if module.id === "dashboard" && !isExpanded && notificationUnreadCount > 0}
      <NotificationBadge count={notificationUnreadCount} />
    {:else if module.id === "inbox" && !isExpanded && inboxUnreadCount > 0}
      <NotificationBadge count={inboxUnreadCount} />
    {/if}
  </div>
  {#if !isCollapsed}
    <span class="module-label">{translatedLabel}</span>
    {#if isDisabled && module.disabledMessage}
      <span class="disabled-badge">{module.disabledMessage}</span>
    {:else if !isExpanded && hasSections}
      <!-- Only show chevron when collapsed AND has sections to expand -->
      <span class="expand-icon">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </span>
    {/if}
  {/if}
</button>

<style>
  /* ============================================================================
     MODULE BUTTON - Refined Minimal Design
     ============================================================================ */
  .module-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--min-touch-target);
    padding: 12px 14px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .module-button.sidebar-collapsed {
    justify-content: center;
    padding: 12px 8px;
  }

  /* Shimmer effect layer - subtle */
  .module-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      transparent 40%,
      var(--theme-card-bg, var(--theme-card-bg)) 50%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    pointer-events: none;
  }

  .module-button:hover::before {
    opacity: 1;
    animation: shimmer 1.2s ease-in-out;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%) translateY(-100%);
    }
    100% {
      transform: translateX(100%) translateY(100%);
    }
  }

  .module-button:hover {
    color: var(--theme-text);
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    transform: translateX(3px);
  }

  .module-button:active {
    transform: translateX(2px) scale(0.99);
    transition-duration: var(--duration-instant);
  }

  /* Expanded state - blends with surrounding panel, acts as header */
  .module-button.expanded {
    color: var(--theme-text);
    background: transparent;
    border-color: transparent;
    cursor: default;
  }

  .module-button.expanded:hover {
    transform: none;
    background: transparent;
  }

  .module-button.expanded::before {
    display: none; /* No shimmer on non-interactive state */
  }

  /* Active module indicator - glass effect with module color */
  .module-button.active {
    color: var(--theme-text);
    background: color-mix(
      in srgb,
      var(--module-color) 15%,
      rgba(0, 0, 0, 0.25)
    );
    border-color: color-mix(in srgb, var(--module-color) 35%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--module-color) 20%, transparent) inset,
      0 2px 12px color-mix(in srgb, var(--module-color) 18%, transparent);
  }

  /* When inside glass container, remove inner styling (container provides visual feedback) */
  .module-button.active.inside-glass {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  /* When both active AND expanded, blend completely (acts as section header) */
  .module-button.active.expanded {
    background: transparent;
    border-color: transparent;
    cursor: default;
  }

  .module-button.active::after {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 50%;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(
      180deg,
      var(--module-color, var(--theme-accent)),
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      )
    );
  }

  /* Hide accent bar when expanded - no longer looks like a button */
  .module-button.active.expanded::after {
    display: none;
  }

  .module-button.sidebar-collapsed.active::after {
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50%;
    height: 3px;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      ),
      var(--module-color, var(--theme-accent)),
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      )
    );
  }

  /* Icon wrapper - for badge positioning */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .module-icon {
    font-size: var(--font-size-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    transition: all var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Profile Avatar for Dashboard */
  .profile-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(16, 185, 129, 0.4);
    flex-shrink: 0;
    transition: all var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .module-button:hover .profile-avatar {
    transform: scale(1.08);
    border-color: rgba(16, 185, 129, 0.7);
  }

  .module-button.active .profile-avatar {
    border-color: rgba(16, 185, 129, 0.8);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  }

  .module-button:hover .module-icon {
    transform: scale(1.08);
  }

  .module-button.active .module-icon {
    filter: drop-shadow(0 1px 3px rgba(255, 255, 255, 0.15));
  }

  .module-label {
    flex: 1;
    text-align: left;
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

    /* Delayed fade-in animation when sidebar expands (Google Calendar-style) */
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

  @keyframes label-fade-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .expand-icon {
    font-size: var(--font-size-compact);
    opacity: 0.5;
    transition: all var(--duration-normal) ease;
  }

  .module-button.expanded .expand-icon {
    opacity: 0.8;
  }

  .module-button:hover .expand-icon {
    opacity: 1;
    transform: translateX(2px);
  }

  /* Disabled module styles */
  .module-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .module-button.disabled:hover {
    transform: none;
    color: var(--theme-text-dim, var(--theme-text-dim));
    background: var(--theme-card-bg);
    box-shadow: none;
  }

  .module-button.disabled::before {
    display: none;
  }

  .disabled-badge {
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    color: var(--theme-text-dim, var(--theme-text-dim));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    letter-spacing: 0.5px;
  }

  /* Focus styles for keyboard navigation */
  .module-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .module-button,
    .module-button::before,
    .module-icon,
    .expand-icon {
      transition: none !important;
      animation: none !important;
    }
    .module-button:hover {
      transform: none;
    }
  }
</style>
