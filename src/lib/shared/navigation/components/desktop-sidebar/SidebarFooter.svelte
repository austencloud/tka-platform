<!-- Sidebar Footer Component -->
<!-- Footer with settings, inbox, network status, and version badge -->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { whatsNewState } from "../../../settings/state/whats-new-state.svelte";
  import { inboxState } from "../../../inbox/state/inbox-state.svelte";
  import { featureFlagService } from "../../../auth/services/FeatureFlagService.svelte";
  import NetworkStatusIndicator from "../../../offline/components/NetworkStatusIndicator.svelte";
  import ModuleQuickToggle from "./ModuleQuickToggle.svelte";

  let { isCollapsed, onSettingsClick, isInSettings = false } = $props<{
    isCollapsed: boolean;
    onSettingsClick?: () => void;
    isInSettings?: boolean;
  }>();

  const isAdmin = $derived(featureFlagService.isAdmin);

  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const badgeCount = $derived(
    inboxState.totalUnreadCount > 99
      ? "99+"
      : String(inboxState.totalUnreadCount)
  );

  function handleSettingsClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    onSettingsClick?.();
  }

  function handleInboxClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    inboxState.open();
  }

  function handleVersionClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    // Open the What's New modal in manual mode
    void whatsNewState.openManual();
  }
</script>

<!-- Footer with settings, inbox (hidden when in settings mode) -->
<div
  class="sidebar-footer"
  class:collapsed={isCollapsed}
  style="--button-accent-color: #64748b;"
>
  {#if !isInSettings}
    <!-- Settings Button -->
    <button
      class="footer-button settings-button"
      class:collapsed={isCollapsed}
      onclick={handleSettingsClick}
      aria-label="Open settings"
    >
      <div class="button-icon">
        <i class="fas fa-cog" aria-hidden="true"></i>
      </div>
      {#if !isCollapsed}
        <span class="button-label">Settings</span>
      {/if}
    </button>

    <!-- Inbox Button -->
    <button
      class="footer-button inbox-button"
      class:collapsed={isCollapsed}
      class:has-unread={hasUnread}
      onclick={handleInboxClick}
      aria-label="Open inbox{hasUnread ? `, ${inboxState.totalUnreadCount} unread` : ''}"
    >
      <div class="button-icon">
        <i class="fas fa-inbox" aria-hidden="true"></i>
        {#if hasUnread}
          <span class="unread-badge" aria-hidden="true">{badgeCount}</span>
        {/if}
      </div>
      {#if !isCollapsed}
        <span class="button-label">Inbox</span>
      {/if}
    </button>

    <!-- Network Status Indicator -->
    <NetworkStatusIndicator variant="desktop" />

    <!-- Module Quick Toggle (admin only) -->
    {#if isAdmin}
      <ModuleQuickToggle {isCollapsed} />
    {/if}
  {/if}

  <!-- Version Number (below inbox) -->
  <button
    class="version-badge"
    class:collapsed={isCollapsed}
    onclick={handleVersionClick}
    aria-label="View Release Notes"
  >
    {#if isCollapsed}
      <span class="version-number">v{__APP_VERSION__}</span>
    {:else}
      <span class="version-label">Version {__APP_VERSION__}</span>
    {/if}
  </button>
</div>

<style>
  /* ============================================================================
     SIDEBAR FOOTER - Inbox button + version badge
     ============================================================================ */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    border-top: 1px solid var(--theme-stroke);
  }

  .sidebar-footer.collapsed {
    padding: 12px 8px;
    align-items: center;
    gap: 12px;
  }

  /* ============================================================================
     FOOTER BUTTONS (shared styles for settings + inbox)
     ============================================================================ */
  .footer-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .footer-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .footer-button.collapsed {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    justify-content: center;
    border-radius: 12px;
  }

  .footer-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* ============================================================================
     INBOX BUTTON
     ============================================================================ */
  .inbox-button.has-unread {
    border-color: color-mix(in srgb, var(--semantic-info) 40%, var(--theme-accent));
  }

  .button-icon {
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base);
    border-radius: 8px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    transition: all var(--duration-normal) ease;
  }

  .inbox-button.collapsed .button-icon {
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 12px;
  }

  .inbox-button:hover .button-icon {
    background: var(--theme-card-hover-bg);
  }

  .button-label {
    flex: 1;
    text-align: left;
    font-weight: 500;

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

  /* ============================================================================
     UNREAD BADGE
     ============================================================================ */
  .unread-badge {
    position: absolute;
    top: -6px;
    right: -6px;
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

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .sidebar-footer,
    .footer-button,
    .button-icon {
      transition: none !important;
    }

    .unread-badge {
      animation: none;
    }
  }

  /* ============================================================================
     VERSION BADGE
     ============================================================================ */
  .version-badge {
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 4px 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
    letter-spacing: 0.3px;
    opacity: 0.7;
    transition: all var(--duration-normal) ease;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    width: 100%;
  }

  .version-badge:hover {
    opacity: 1;
    color: var(--theme-accent);
    background: var(--theme-card-bg);
  }

  .version-badge:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .version-badge.collapsed {
    padding: 4px 0;
    font-size: var(--font-size-compact);
  }

  .version-number,
  .version-label {
    white-space: nowrap;
  }

  .version-label {
    /* Delayed fade-in animation when sidebar expands (Google Calendar-style) */
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }
</style>
