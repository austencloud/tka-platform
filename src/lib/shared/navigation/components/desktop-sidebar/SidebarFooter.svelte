<!-- Sidebar Footer Component -->
<!-- Footer with account, inbox, network status, and voice mic -->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { inboxState } from "../../../inbox/state/inbox-state.svelte";
  import { featureFlagService } from "../../../auth/services/PostHogFeatureFlagService.svelte";
  import NetworkStatusIndicator from "../../../offline/components/NetworkStatusIndicator.svelte";
  import ModuleQuickToggle from "./ModuleQuickToggle.svelte";
  import { voiceControlState } from "../../../voice-control/state/voice-control-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import AccountRow from "../account/AccountRow.svelte";
  import AccountPopover from "../account/AccountPopover.svelte";

  let { isCollapsed, onSettingsClick, isInSettings = false } = $props<{
    isCollapsed: boolean;
    onSettingsClick?: () => void;
    isInSettings?: boolean;
  }>();

  const isAdmin = $derived(featureFlagService.isAdmin);

  // Voice control is opt-in via Settings > Preferences
  const voiceControlOptIn = $derived(getSettings()?.voiceControlEnabled === true);
  const voiceSupported = $derived(voiceControlOptIn && voiceControlState.supported);
  const voiceEnabled = $derived(voiceControlState.enabled);
  const inCommandMode = $derived(voiceControlState.commandMode);
  const hasVoiceError = $derived(voiceControlState.detectorState === "error");

  // Account popover state
  let popoverOpen = $state(false);
  let accountSectionEl = $state<HTMLElement | null>(null);

  function togglePopover() {
    popoverOpen = !popoverOpen;
  }

  function closePopover() {
    popoverOpen = false;
  }

  function handleMicClick() {
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    if (!voiceEnabled) {
      // First activation: start detector, then enter command mode.
      // This is when the browser microphone permission prompt appears.
      voiceControlState.startListening();
      voiceControlState.enterCommandMode();
      return;
    }

    if (inCommandMode) {
      voiceControlState.exitCommandMode();
    } else {
      voiceControlState.enterCommandMode();
    }
  }

  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const badgeCount = $derived(
    inboxState.totalUnreadCount > 99
      ? "99+"
      : String(inboxState.totalUnreadCount)
  );

  function handleSettingsClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    onSettingsClick?.();
  }

  function handleInboxClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    inboxState.open();
  }
</script>

<!-- Footer with account, inbox (hidden when in settings mode) -->
<div
  class="sidebar-footer"
  class:collapsed={isCollapsed}
  style="--button-accent-color: #64748b;"
>
  {#if !isInSettings}
    <!-- Account Row + Popover (replaces Settings button) -->
    <div class="account-section" bind:this={accountSectionEl} style="position: relative;">
      <AccountRow
        variant={isCollapsed ? "collapsed" : "expanded"}
        onclick={togglePopover}
      />
      <AccountPopover
        isOpen={popoverOpen}
        onClose={closePopover}
        onSettingsClick={handleSettingsClick}
        anchorElement={accountSectionEl}
      />
    </div>

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

  <!-- Voice mic -->
  {#if voiceSupported}
    <button
      class="mic-button"
      class:inactive={!voiceEnabled}
      class:command-mode={inCommandMode}
      class:error={hasVoiceError}
      onclick={handleMicClick}
      aria-label={!voiceEnabled ? "Enable voice control" : inCommandMode ? "Stop voice command mode" : "Start voice command mode"}
    >
      <i class="fas fa-microphone" aria-hidden="true"></i>
      {#if inCommandMode}
        <div class="mic-glow-ring"></div>
      {/if}
    </button>
  {/if}
</div>

<style>
  /* ============================================================================
     SIDEBAR FOOTER - Inbox button + account row
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
     ACCOUNT SECTION
     ============================================================================ */
  .account-section {
    position: relative;
  }

  /* ============================================================================
     FOOTER BUTTONS (shared styles for inbox)
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
     MIC BUTTON
     ============================================================================ */
  .mic-button {
    position: relative;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.25);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mic-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
  }

  .mic-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* Inactive: dimmer, indicates voice is available but not yet activated */
  .mic-button.inactive {
    background: rgba(255, 255, 255, 0.02);
    color: rgba(255, 255, 255, 0.15);
  }

  .mic-button.inactive:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.4);
  }

  /* Command mode: glowing green */
  .mic-button.command-mode {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.3);
  }

  .mic-button.command-mode:hover {
    background: rgba(34, 197, 94, 0.25);
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.4);
  }

  .mic-glow-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid rgba(34, 197, 94, 0.4);
    animation: mic-glow-pulse 2s ease-out infinite;
  }

  @keyframes mic-glow-pulse {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* Error state */
  .mic-button.error {
    background: rgba(239, 68, 68, 0.1);
    color: rgba(239, 68, 68, 0.6);
  }

  @media (prefers-reduced-motion: reduce) {
    .mic-glow-ring {
      animation: none;
      opacity: 0.3;
    }

    .mic-button {
      transition: none;
    }
  }
</style>
