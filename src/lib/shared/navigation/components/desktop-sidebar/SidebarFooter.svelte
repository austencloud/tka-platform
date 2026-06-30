<!-- Sidebar Footer Component -->
<!-- Footer with settings, network status, prop switcher, account, and voice mic -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import NetworkStatusIndicator from "../../../offline/components/NetworkStatusIndicator.svelte";
  import { voiceControlState } from "../../../voice-control/state/voice-control-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import { propDrawerState } from "../../../settings/state/prop-drawer-state.svelte";
  import { getPropTypeDisplayInfo } from "../../../pictograph/prop/domain/prop-type-display-registry";
  import { PropType } from "../../../pictograph/prop/domain/enums/prop-type";
  import AccountRow from "../account/AccountRow.svelte";
  import { inboxState } from "../../../inbox/state/inbox-state.svelte";
  import { authState } from "../../../auth/state/auth-state.svelte";
  import { supportModalState } from "../../../support/state/support-modal-state.svelte";

  // Inbox is a member-only surface (unfinished, and not relevant to guests).
  // Anonymous guests are authenticated but not full accounts — gate on this.
  const isFullAccount = $derived(authState.isFullAccount);

  let { isCollapsed, onSettingsClick, isInSettings = false, onAccountClick, accountSectionElement = $bindable(null) } = $props<{
    isCollapsed: boolean;
    onSettingsClick?: () => void;
    isInSettings?: boolean;
    onAccountClick?: () => void;
    accountSectionElement?: HTMLElement | null;
  }>();

  // Prop type display info for the prop button
  const bluePropType = $derived(getSettings()?.bluePropType ?? PropType.STAFF);
  const propDisplayInfo = $derived(getPropTypeDisplayInfo(bluePropType));

  // Inbox unread state
  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const badgeCount = $derived(
    inboxState.totalUnreadCount > 99
      ? "99+"
      : String(inboxState.totalUnreadCount)
  );

  // Voice control is opt-in via Settings > Preferences
  const voiceControlOptIn = $derived(getSettings()?.voiceControlEnabled === true);
  const voiceSupported = $derived(voiceControlOptIn && voiceControlState.supported);
  const voiceEnabled = $derived(voiceControlState.enabled);
  const inCommandMode = $derived(voiceControlState.commandMode);
  const hasVoiceError = $derived(voiceControlState.detectorState === "error");

  function handleMicClick() {
    try {
      const hapticService = getHapticFeedback();
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

  function handlePropClick() {
    try {
      const hapticService = getHapticFeedback();
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    propDrawerState.toggle();
  }

  function handleInboxClick() {
    try {
      const hapticService = getHapticFeedback();
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    inboxState.open();
  }

  function handleSettingsClick() {
    try {
      const hapticService = getHapticFeedback();
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

    <!-- Support button (opens the in-app support modal — no longer a new tab) -->
    <button
      type="button"
      class="footer-button support-button"
      class:collapsed={isCollapsed}
      onclick={() => supportModalState.show()}
      aria-label="Support The Kinetic Alphabet"
    >
      <div class="button-icon">
        <i class="fas fa-heart" aria-hidden="true"></i>
      </div>
      {#if !isCollapsed}
        <span class="button-label">Support</span>
      {/if}
    </button>

    <!-- Inbox Button (members only) -->
    {#if isFullAccount}
      <button
        class="footer-button inbox-button"
        class:collapsed={isCollapsed}
        class:has-unread={hasUnread}
        onclick={handleInboxClick}
        aria-label="Open inbox{hasUnread ? `, ${inboxState.totalUnreadCount} unread` : ''}"
      >
        <div class="button-icon inbox-icon-wrapper">
          <i class="fas fa-inbox" aria-hidden="true"></i>
          {#if hasUnread}
            <span class="unread-badge" aria-hidden="true">
              {badgeCount}
            </span>
          {/if}
        </div>
        {#if !isCollapsed}
          <span class="button-label">Inbox</span>
          {#if hasUnread}
            <span class="unread-label-badge">
              {badgeCount}
            </span>
          {/if}
        {/if}
      </button>
    {/if}

    <!-- Network Status Indicator -->
    <NetworkStatusIndicator variant="desktop" />

    <!-- Prop Switcher Button -->
    <button
      class="footer-button prop-button"
      class:collapsed={isCollapsed}
      onclick={handlePropClick}
      aria-label="Change prop type. Current: {propDisplayInfo.label}"
    >
      <div class="button-icon">
        <img
          src={propDisplayInfo.image}
          alt={propDisplayInfo.label}
          class="prop-icon-img"
        />
      </div>
      {#if !isCollapsed}
        <span class="button-label">{propDisplayInfo.label}</span>
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

  /* Support is a link styled as a footer button */
  .support-button {
    text-decoration: none;
  }
  .support-button .button-icon i {
    color: #f472b6; /* warm pink heart */
  }
  .support-button:hover {
    border-color: color-mix(in srgb, #f472b6 40%, var(--theme-stroke));
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
     PROP SWITCHER BUTTON
     ============================================================================ */
  .prop-button {
    border-color: color-mix(in srgb, var(--theme-accent, #818cf8) 25%, transparent);
  }

  .prop-button:hover {
    background: color-mix(in srgb, var(--theme-accent, #818cf8) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #818cf8) 40%, transparent);
  }

  .prop-button .button-icon {
    background: transparent;
  }

  .prop-icon-img {
    width: 26px;
    height: 26px;
    object-fit: contain;
    filter: brightness(1.3) saturate(1.3);
  }

  /* ============================================================================
     INBOX BUTTON
     ============================================================================ */
  .inbox-icon-wrapper {
    position: relative;
  }

  .inbox-button.has-unread {
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 30%, var(--theme-stroke));
  }

  .inbox-button.has-unread:hover {
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 50%, var(--theme-stroke));
  }

  .unread-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: var(--semantic-error, #ef4444);
    border-radius: 9px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    pointer-events: none;
    animation: badgePop var(--duration-emphasis, 300ms) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .unread-label-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--semantic-error, #ef4444);
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  @keyframes badgePop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
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
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    color: var(--semantic-success, #22c55e);
    box-shadow: 0 0 12px color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
  }

  .mic-button.command-mode:hover {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 25%, transparent);
    box-shadow: 0 0 16px color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
  }

  .mic-glow-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
    animation: mic-glow-pulse 2s ease-out infinite;
  }

  @keyframes mic-glow-pulse {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* Error state */
  .mic-button.error {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent);
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
