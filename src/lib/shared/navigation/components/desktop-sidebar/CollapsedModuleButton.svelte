<!-- Collapsed Module Button Component -->
<!-- Icon-only module button for collapsed sidebar activity bar (VS Code style) -->
<script lang="ts">
  import type { ModuleDefinition } from "../../domain/types";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import NotificationBadge from "../NotificationBadge.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  let {
    module,
    isActive,
    onClick,
    onContextMenu,
    moduleColor,
    hasTabs = false,
  } = $props<{
    module: ModuleDefinition;
    isActive: boolean;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    moduleColor?: string;
    hasTabs?: boolean;
  }>();

  const isDisabled = $derived(module.disabled ?? false);

  // Translated module label (reactive to locale changes)
  const translatedLabel = $derived.by(() => {
    getReactiveLocale();
    return t(module.labelKey);
  });

  // Get total unread count from inbox (notifications + messages)
  const inboxUnreadCount = $derived(inboxState.totalUnreadCount);

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
  class="collapsed-module-button"
  class:active={isActive}
  class:disabled={isDisabled}
  class:has-tabs={hasTabs}
  onclick={onClick}
  oncontextmenu={onContextMenu}
  disabled={isDisabled}
  aria-label={translatedLabel}
  aria-current={isActive ? "page" : undefined}
  style="--module-color: {moduleColor || '#a855f7'};"
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

    <!-- Notification Badge for Inbox Module -->
    {#if module.id === "inbox" && inboxUnreadCount > 0}
      <NotificationBadge count={inboxUnreadCount} />
    {/if}
  </div>

  <!-- Hover Label -->
  <span class="hover-label">{translatedLabel}</span>
</button>

<style>
  /* ============================================================================
     COLLAPSED MODULE BUTTON - VS CODE ACTIVITY BAR STYLE
     ============================================================================ */
  .collapsed-module-button {
    width: var(--min-touch-target); /* Larger than tabs for visual hierarchy */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin-bottom: 0; /* No margin - controlled by context group */
    /* Subtle border for differentiation */
    box-shadow: inset 0 0 0 1px var(--theme-stroke);
  }

  .collapsed-module-button:hover:not(.disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
    box-shadow: inset 0 0 0 1px var(--theme-stroke-strong);
  }

  .collapsed-module-button.active {
    color: var(--theme-text);
    background: var(--theme-card-hover-bg, var(--theme-card-hover-bg));
    box-shadow: inset 0 0 0 1px var(--theme-stroke-strong);
  }

  /* Ghost the button when tabs are showing - tabs become the focus */
  .collapsed-module-button.active.has-tabs {
    background: transparent;
    box-shadow: none;
  }

  .collapsed-module-button.active.has-tabs .module-icon {
    opacity: 0.3; /* Ghosted icon */
  }

  .collapsed-module-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Icon wrapper - for badge positioning */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .module-icon {
    font-size: var(--font-size-xl); /* Slightly larger icon */
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform var(--duration-normal) ease;
  }

  /* Profile Avatar for Dashboard */
  .profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(16, 185, 129, 0.4);
    transition: all var(--duration-normal) ease;
  }

  .collapsed-module-button:hover:not(.disabled) .profile-avatar {
    transform: scale(1.08);
    border-color: rgba(16, 185, 129, 0.7);
  }

  .collapsed-module-button.active .profile-avatar {
    border-color: rgba(16, 185, 129, 0.8);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
  }

  .collapsed-module-button:hover:not(.disabled) .module-icon {
    transform: scale(1.08);
  }

  .collapsed-module-button.active .module-icon {
    transform: scale(1.05);
  }

  /* Hover Label - slides in from right */
  .hover-label {
    position: absolute;
    left: 60px;
    padding: 6px 12px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translateX(-8px);
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--theme-shadow, 0 4px 12px rgba(0, 0, 0, 0.4));
    z-index: 200;
  }

  .collapsed-module-button:hover .hover-label {
    opacity: 1;
    transform: translateX(0);
  }

  /* Focus styles for keyboard navigation */
  .collapsed-module-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-contrast: high) {
    .collapsed-module-button.active {
      background: var(--theme-card-hover-bg);
      outline: 2px solid white;
    }
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
