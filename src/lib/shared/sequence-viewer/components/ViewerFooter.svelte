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
    bpm: number;
    isPlaying: boolean;
    isLoggedIn: boolean;
    controlsVisible?: boolean;
    landscape?: boolean;
    rampActive?: boolean;
    sequenceUrl?: string;
    isSyncToggling?: boolean;
    isSyncActive?: boolean;
    isSyncConnected?: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onStepHalfBack?: () => void;
    onStepHalfForward?: () => void;
    onSave: () => void;
    onCompose: () => void;
    onShare: () => void;
    onExport: (format?: ExportFormat) => void;
    onGetApp?: () => void;
    onRampStart?: () => void;
    onRampStop?: () => void;
    onPreviewModeChange?: (mode: ExportFormat | null) => void;
    onConnect?: () => void;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    controlsVisible = true,
    landscape = false,
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

  // Landscape BPM popover state
  let bpmPopoverOpen = $state(false);

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

{#if landscape}
  <!-- Landscape mobile: Vertical column of icon-only buttons on the right side -->
  <aside class="landscape-controls" aria-label="Playback and actions">
    <!-- Play/Pause (prominent, larger) -->
    <button
      type="button"
      class="landscape-btn play-pause"
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <!-- Step controls -->
    <button
      type="button"
      class="landscape-btn"
      onclick={onStepBack}
      aria-label="Step backward"
    >
      <i class="fas fa-backward-step" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="landscape-btn"
      onclick={onStepForward}
      aria-label="Step forward"
    >
      <i class="fas fa-forward-step" aria-hidden="true"></i>
    </button>

    <!-- BPM display / popover trigger -->
    <div class="landscape-bpm-wrapper">
      <button
        type="button"
        class="landscape-btn bpm-trigger"
        onclick={() => (bpmPopoverOpen = !bpmPopoverOpen)}
        aria-label="Adjust BPM: {bpm}"
        aria-expanded={bpmPopoverOpen}
      >
        <span class="bpm-value">{bpm}</span>
        <span class="bpm-label">BPM</span>
      </button>

      {#if bpmPopoverOpen}
        <!-- BPM popover overlay -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="bpm-popover-backdrop"
          onclick={() => (bpmPopoverOpen = false)}
          onkeydown={(e) => { if (e.key === "Escape") bpmPopoverOpen = false; }}
        ></div>
        <div class="bpm-popover" role="dialog" aria-label="Tempo control">
          <TempoControl
            {bpm}
            {onBpmChange}
            {rampActive}
            {onRampStart}
            {onRampStop}
          />
        </div>
      {/if}
    </div>

    <div class="landscape-divider" aria-hidden="true"></div>

    <!-- Action buttons -->
    {#if isLoggedIn}
      <button
        type="button"
        class="landscape-btn save"
        onclick={onSave}
        aria-label="Save"
      >
        <i class="fas fa-bookmark" aria-hidden="true"></i>
      </button>
    {/if}
    <button
      type="button"
      class="landscape-btn share"
      onclick={onShare}
      aria-label="Share"
    >
      <i class="fas fa-share" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="landscape-btn download"
      onclick={() => onExport()}
      aria-label="Download"
    >
      <i class="fas fa-download" aria-hidden="true"></i>
    </button>
  </aside>
{:else}
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
{/if}

<style>
  /* ===========================
     LANDSCAPE VERTICAL CONTROLS
     =========================== */

  .landscape-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
    padding-right: calc(4px + env(safe-area-inset-right, 0px));
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    width: 60px;
    height: 100%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  .landscape-controls::-webkit-scrollbar {
    display: none;
  }

  .landscape-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    min-height: 32px;
    height: 40px;
    border-radius: 10px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 1;
    -webkit-tap-highlight-color: transparent;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .landscape-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .landscape-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .landscape-btn.play-pause {
    width: 44px;
    min-height: 36px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: white;
    font-size: 16px;
    flex-shrink: 0;
  }

  .landscape-btn.play-pause:active {
    background: var(--theme-accent-hover, #4f46e5);
  }

  /* Color-coded landscape buttons */
  .landscape-btn.save { color: #22c55e; border-color: rgba(34, 197, 94, 0.25); }
  .landscape-btn.share { color: #a855f7; border-color: rgba(168, 85, 247, 0.25); }
  .landscape-btn.download { color: #818cf8; border-color: rgba(99, 102, 241, 0.35); }

  .landscape-divider {
    width: 28px;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 1;
    margin: 1px 0;
  }

  /* BPM trigger in landscape */
  .landscape-btn.bpm-trigger {
    flex-direction: column;
    gap: 0;
    min-height: 32px;
    height: 40px;
    width: 40px;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .bpm-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    line-height: 1;
  }

  .bpm-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  /* BPM popover */
  .landscape-bpm-wrapper {
    position: relative;
  }

  .bpm-popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .bpm-popover {
    position: absolute;
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 12px;
    min-width: 200px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

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
    .action-btn,
    .landscape-btn {
      transition: none;
    }

    .action-btn:active,
    .landscape-btn:active {
      transform: none;
    }
  }
</style>
