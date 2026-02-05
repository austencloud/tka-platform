<!--
  ViewerFooter.svelte

  Unified footer for the Sequence Viewer modal.

  Layout (ResizeObserver-based):
  - Desktop (wide): Single row with transport + BPM on left, actions on right
  - Mid: MorphChip toolbar when desktop content wouldn't fit
  - Mobile (<600px): Two stacked rows (actions on top, playback below)

  The desktop minimum width is calculated from known component sizes
  (transport controls, tempo section, action buttons). A ResizeObserver
  on the footer element triggers re-evaluation on any width change.

  Auto-hide behavior (mobile only):
  - Controls visible when modal opens
  - Auto-hide after 3 seconds of playback
  - Tap animation area to toggle visibility
  - Stay visible when paused
-->
<script lang="ts">
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import TempoControl from "./TempoControl.svelte";
  import ViewerMorphToolbar from "./ViewerMorphToolbar.svelte";

  type ExportFormat = "image" | "animation" | "side-by-side";

  interface Props {
    /** Current BPM value */
    bpm: number;
    /** Whether animation is currently playing */
    isPlaying: boolean;
    /** Whether user is logged in (affects Save button) */
    isLoggedIn: boolean;
    /** Whether controls should be visible (for auto-hide) */
    controlsVisible?: boolean;
    /** Whether tempo ramp is currently active */
    rampActive?: boolean;
    /** Shareable URL for the sequence */
    sequenceUrl?: string;
    /** Whether sync is currently connecting/disconnecting */
    isSyncToggling?: boolean;
    /** Whether sync is active (searching or connected) */
    isSyncActive?: boolean;
    /** Whether sync is connected to another device */
    isSyncConnected?: boolean;
    /** Callback when BPM changes */
    onBpmChange: (bpm: number) => void;
    /** Callback to toggle play/pause */
    onPlayPause: () => void;
    /** Callback for step backward (full beat) */
    onStepBack: () => void;
    /** Callback for step forward (full beat) */
    onStepForward: () => void;
    /** Callback for half-step backward */
    onStepHalfBack?: () => void;
    /** Callback for half-step forward */
    onStepHalfForward?: () => void;
    /** Callback when Save is clicked */
    onSave: () => void;
    /** Callback when Compose is clicked */
    onCompose: () => void;
    /** Callback when Share is clicked */
    onShare: () => void;
    /** Callback when Export is clicked (with format) */
    onExport: (format?: ExportFormat) => void;
    /** Callback when "Get TKA Scribe" is clicked (unauthenticated users) */
    onGetApp?: () => void;
    /** Callback when ramp training starts */
    onRampStart?: () => void;
    /** Callback when ramp training stops */
    onRampStop?: () => void;
    /** Callback when preview mode changes (mid layout export chip) */
    onPreviewModeChange?: (mode: ExportFormat | null) => void;
    /** Callback when Connect is clicked (toggle LAN sync) */
    onConnect?: () => void;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    controlsVisible = true,
    rampActive = false,
    sequenceUrl = "",
    isSyncToggling = false,
    isSyncActive = false,
    isSyncConnected = false,
    onBpmChange,
    onPlayPause,
    onStepBack,
    onStepForward,
    onStepHalfBack,
    onStepHalfForward,
    onSave,
    onCompose,
    onShare,
    onExport,
    onGetApp,
    onRampStart,
    onRampStop,
    onPreviewModeChange,
    onConnect,
  }: Props = $props();

  // Layout detection using ResizeObserver on the footer element.
  // Two layouts for consistency:
  //   - Mid: MorphChip toolbar (default, used on mobile and tablets)
  //   - Desktop: Full single-row layout with all controls visible
  // Desktop minimum width is calculated from known component sizes:
  //   Transport: 5 buttons (48px) + 4 gaps (8px) = 272px
  //   Tempo: BPM display + hold buttons + presets + ramp ≈ 400px
  //   Actions: N buttons × ~100px (68px min-width + 32px padding) + gaps
  //   Structural: playback gap (16) + section gap (16) + footer padding (32)
  type FooterLayout = "mid" | "desktop";
  let layout = $state<FooterLayout>("mid");
  let footerEl: HTMLElement | null = $state(null);

  $effect(() => {
    if (!footerEl) return;

    const selectLayout = () => {
      const actionCount = isLoggedIn ? 5 : 4; // Added Connect button
      const actionsWidth = actionCount * 100 + (actionCount - 1) * 10;
      const minDesktopWidth = 272 + 16 + 400 + 16 + actionsWidth + 32;

      layout = footerEl!.clientWidth >= minDesktopWidth ? "desktop" : "mid";
    };

    const observer = new ResizeObserver(() => selectLayout());
    observer.observe(footerEl);
    selectLayout();

    return () => observer.disconnect();
  });
</script>

<footer
  bind:this={footerEl}
  class="viewer-footer"
  data-controls-visible={controlsVisible}
>
  {#if layout === "mid"}
    <!-- Mid-width (self-calibrating): MorphChip toolbar -->
    <ViewerMorphToolbar
      {bpm}
      {isPlaying}
      {isLoggedIn}
      {rampActive}
      {sequenceUrl}
      {isSyncToggling}
      {isSyncActive}
      {isSyncConnected}
      {onBpmChange}
      {onPlayPause}
      {onStepBack}
      {onStepForward}
      {onStepHalfBack}
      {onStepHalfForward}
      {onSave}
      {onExport}
      {onCompose}
      {onPreviewModeChange}
      {onGetApp}
      {onRampStart}
      {onRampStop}
      {onConnect}
    />
  {:else}
    <!-- Desktop: Single row layout -->
    <div class="desktop-row">
      <div class="playback-section">
        <TransportControls
          {isPlaying}
          onPlaybackToggle={onPlayPause}
          onStepHalfBeatBackward={onStepHalfBack ?? (() => {})}
          onStepHalfBeatForward={onStepHalfForward ?? (() => {})}
          onStepFullBeatBackward={onStepBack}
          onStepFullBeatForward={onStepForward}
        />
        <div class="tempo-section">
          <TempoControl
            {bpm}
            {onBpmChange}
            rampActive={rampActive}
            onRampStart={onRampStart}
            onRampStop={onRampStop}
          />
        </div>
      </div>

      <div class="actions-section">
        {#if isLoggedIn}
          <button
            type="button"
            class="action-btn save"
            onclick={onSave}
            aria-label="Save to Library"
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i>
            <span>Save</span>
          </button>
          <button
            type="button"
            class="action-btn compose"
            onclick={onCompose}
            aria-label="Open in Compose"
          >
            <i class="fas fa-users" aria-hidden="true"></i>
            <span>Compose</span>
          </button>
          {#if onConnect}
            <button
              type="button"
              class="action-btn connect"
              class:active={isSyncActive}
              class:connected={isSyncConnected}
              onclick={onConnect}
              disabled={isSyncToggling}
              aria-label={isSyncConnected ? "Disconnect from sync" : isSyncActive ? "Searching for devices..." : "Connect to sync"}
            >
              <i class="fas {isSyncConnected ? 'fa-tower-broadcast' : isSyncActive ? 'fa-spinner fa-pulse' : 'fa-tower-broadcast'}" aria-hidden="true"></i>
              <span>{isSyncConnected ? "Connected" : isSyncActive ? "Searching" : "Connect"}</span>
            </button>
          {/if}
        {:else}
          <button
            type="button"
            class="action-btn get-app"
            onclick={onGetApp}
            aria-label="Get TKA Scribe"
          >
            <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span>Get App</span>
          </button>
        {/if}
        <button
          type="button"
          class="action-btn share"
          onclick={onShare}
          aria-label="Share"
        >
          <i class="fas fa-share" aria-hidden="true"></i>
          <span>Share</span>
        </button>
        <button
          type="button"
          class="action-btn download"
          onclick={() => onExport()}
          aria-label="Download"
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>Download</span>
        </button>
      </div>
    </div>
  {/if}
</footer>

<style>
  /* ===========================
     FOOTER BASE
     =========================== */

  .viewer-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  /* ===========================
     DESKTOP LAYOUT
     =========================== */

  .desktop-row {
    display: flex;
    align-items: center;
    gap: 16px;
    /* Clip overflow during the one-frame calibration render
       when the layout is testing whether desktop fits */
    overflow: hidden;
  }

  .playback-section {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  /* ===========================
     ACTION BUTTONS
     =========================== */

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 68px;
    height: 48px;
    padding: 6px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .action-btn i {
    font-size: 16px;
  }

  .action-btn span {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .action-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Color-coded action buttons */
  .action-btn.save {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .action-btn.save:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .action-btn.compose {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.25);
    color: #06b6d4;
  }

  .action-btn.compose:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .action-btn.get-app {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .action-btn.get-app:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .action-btn.share {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.25);
    color: #a855f7;
  }

  .action-btn.share:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .action-btn.download {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.35);
    color: #818cf8;
  }

  .action-btn.download:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
  }

  .action-btn.connect {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .action-btn.connect:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .action-btn.connect.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .action-btn.connect.connected {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.35);
    color: #22c55e;
  }

  .action-btn.connect:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ===========================
     TEMPO CONTROL SECTION
     =========================== */

  .tempo-section {
    flex: 1;
    min-width: 0;
    max-width: 500px;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }

    .action-btn:active {
      transform: none;
    }
  }
</style>
