<!-- Sidebar Footer Component -->
<!-- Footer with settings, network status, inbox, account, and voice mic -->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import NetworkStatusIndicator from "../../../offline/components/NetworkStatusIndicator.svelte";
  import { voiceControlState } from "../../../voice-control/state/voice-control-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import { inboxState } from "../../../inbox/state/inbox-state.svelte";
  import AccountRow from "../account/AccountRow.svelte";

  let { isCollapsed, onSettingsClick, isInSettings = false, onAccountClick, accountSectionElement = $bindable(null) } = $props<{
    isCollapsed: boolean;
    onSettingsClick?: () => void;
    isInSettings?: boolean;
    onAccountClick?: () => void;
    accountSectionElement?: HTMLElement | null;
  }>();

  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const unreadCount = $derived(inboxState.totalUnreadCount);

  // Voice control is opt-in via Settings > Preferences
  const voiceControlOptIn = $derived(getSettings()?.voiceControlEnabled === true);
  const voiceSupported = $derived(voiceControlOptIn && voiceControlState.supported);
  const voiceEnabled = $derived(voiceControlState.enabled);
  const inCommandMode = $derived(voiceControlState.commandMode);
  const hasVoiceError = $derived(voiceControlState.detectorState === "error");

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

  function handleInboxClick() {
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    inboxState.open();
  }

  function handleSettingsClick() {
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    onSettingsClick?.();
  }
</script>

<!-- Footer with settings, account (hidden when in settings mode) -->
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

    <!-- Network Status Indicator -->
    <NetworkStatusIndicator variant="desktop" />

    <!-- Inbox Button -->
    <button
      class="footer-button inbox-button"
      class:collapsed={isCollapsed}
      onclick={handleInboxClick}
      aria-label="Open inbox{hasUnread ? `, ${unreadCount} unread` : ''}"
    >
      <div class="button-icon-wrapper">
        <div class="button-icon">
          <i class="fas fa-inbox" aria-hidden="true"></i>
        </div>
        {#if hasUnread}
          <span class="unread-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        {/if}
      </div>
      {#if !isCollapsed}
        <span class="button-label">Inbox</span>
        {#if hasUnread && unreadCount > 0}
          <span class="inbox-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
        {/if}
      {/if}
    </button>

    <!-- Account Row (popover rendered outside nav to avoid overflow clipping) -->
    <div class="account-section" bind:this={accountSectionElement}>
      <AccountRow
        variant={isCollapsed ? "collapsed" : "expanded"}
        onclick={() => onAccountClick?.()}
      />
    </div>
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
     SIDEBAR FOOTER - Settings button + account row
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
     FOOTER BUTTONS (shared styles)
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
     BUTTON ICON
     ============================================================================ */
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

  .footer-button.collapsed .button-icon {
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 12px;
  }

  .footer-button:hover .button-icon {
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
     INBOX BUTTON
     ============================================================================ */
  .inbox-button {
    color: var(--semantic-info, #3b82f6);
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 25%, transparent);
  }

  .inbox-button:hover {
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
    color: var(--semantic-info, #3b82f6);
  }

  .inbox-button .button-icon {
    background: transparent;
  }

  .button-icon-wrapper {
    position: relative;
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -6px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--semantic-error, #ef4444);
    border-radius: 8px;
    color: white;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
    z-index: 1;
  }

  .inbox-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--semantic-info, #3b82f6);
    opacity: 0.8;
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
