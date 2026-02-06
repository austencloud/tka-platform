<!--
  ViewerMorphToolbar.svelte

  Mid-width footer layout (768-1024px) for the Sequence Viewer.

  Collapsed state:
  [▶ Play] [Save] [Copy Link] [── 60 BPM ──] [Download]

  BPM chip expanded:
  [── ‹½ | «1 | 1» | ½› │ - 60 BPM + │ Ramp ──]

  Download chip expanded:
  [Image] [Animation] [Side-by-Side] [Compose→] | [✓ Done] [✕]
-->
<script lang="ts">
  import MorphChipGroup from "$lib/shared/foundation/ui/morph-chip/MorphChipGroup.svelte";
  import MorphChip from "$lib/shared/foundation/ui/morph-chip/MorphChip.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import TempoControl from "./TempoControl.svelte";

  type ExportFormat = "image" | "animation" | "side-by-side";

  interface Props {
    bpm: number;
    isPlaying: boolean;
    isLoggedIn: boolean;
    rampActive?: boolean;
    sequenceUrl?: string;
    /** Whether sync is currently connecting/disconnecting */
    isSyncToggling?: boolean;
    /** Whether sync is active (searching or connected) */
    isSyncActive?: boolean;
    /** Whether sync is connected to another device */
    isSyncConnected?: boolean;

    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onStepHalfBack?: () => void;
    onStepHalfForward?: () => void;
    onSave: () => void;
    onExport: (format: ExportFormat) => void;
    onCompose: () => void;
    onPreviewModeChange?: (mode: ExportFormat | null) => void;
    onGetApp?: () => void;
    onRampStart?: () => void;
    onRampStop?: () => void;
    /** Callback when Connect is clicked (toggle LAN sync) */
    onConnect?: () => void;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
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
    onExport,
    onCompose,
    onPreviewModeChange,
    onGetApp,
    onRampStart,
    onRampStop,
    onConnect,
  }: Props = $props();

  let expandedChip = $state<string | null>(null);
  let selectedFormat = $state<ExportFormat>("image");

  // When download chip expands/collapses, notify parent for live preview
  function handleExpandedChange(id: string | null) {
    if (id === "download") {
      onPreviewModeChange?.(selectedFormat);
    } else if (id === null) {
      onPreviewModeChange?.(null);
    }
  }

  function handleFormatSelect(format: ExportFormat) {
    selectedFormat = format;
    onPreviewModeChange?.(format);
  }

  function handleDone(collapse: () => void) {
    onExport(selectedFormat);
    collapse();
  }

  function handleCopyLink() {
    if (sequenceUrl) {
      navigator.clipboard.writeText(sequenceUrl);
      // TODO: Show toast confirmation
    }
  }

  function handleCompose(collapse: () => void) {
    collapse();
    onCompose();
  }
</script>

<div class="morph-toolbar">
  <!-- Play/Pause - always visible for consistent expectations -->
  <button
    type="button"
    class="play-btn"
    class:playing={isPlaying}
    onclick={onPlayPause}
    aria-label={isPlaying ? "Pause animation" : "Play animation"}
  >
    <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <!-- Action buttons - hide when any chip is expanded -->
  {#if expandedChip === null}
    <div class="action-buttons">
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
        class="action-btn copy-link"
        onclick={handleCopyLink}
        aria-label="Copy link to clipboard"
      >
        <i class="fas fa-link" aria-hidden="true"></i>
        <span>Copy Link</span>
      </button>

      {#if isLoggedIn && onConnect}
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
    </div>
  {/if}

  <!-- Chip area with BPM and Download chips -->
  <div class="chip-area">
    <MorphChipGroup
      bind:expandedId={expandedChip}
      onExpandedChange={handleExpandedChange}
    >
      <!-- BPM chip: collapsed shows BPM, expanded shows transport + tempo -->
      <MorphChip
        id="controls"
        label=""
        value={bpm}
        displayValue="{bpm} BPM"
        options={[]}
      >
        {#snippet expandedContent({ collapse, morphProgress })}
          <div
            class="controls-row"
            style:pointer-events={morphProgress > 0.5 ? "auto" : "none"}
          >
            <div class="step-section">
              <TransportControls
                {isPlaying}
                onPlaybackToggle={onPlayPause}
                onStepHalfBeatBackward={onStepHalfBack ?? (() => {})}
                onStepHalfBeatForward={onStepHalfForward ?? (() => {})}
                onStepFullBeatBackward={onStepBack}
                onStepFullBeatForward={onStepForward}
              />
            </div>
            <div class="tempo-section">
              <TempoControl
                {bpm}
                {onBpmChange}
                showPresets={false}
                rampActive={rampActive}
                onRampStart={onRampStart}
                onRampStop={onRampStop}
              />
            </div>
            <button
              type="button"
              class="close-btn"
              onclick={() => collapse()}
              aria-label="Close controls"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        {/snippet}
      </MorphChip>

      <!-- Download chip: collapsed shows "Download", expanded shows format options -->
      <MorphChip
        id="download"
        label=""
        value="download"
        displayValue="Download"
        options={[]}
      >
        {#snippet expandedContent({ collapse, morphProgress })}
          <div
            class="export-panel"
            style:pointer-events={morphProgress > 0.5 ? "auto" : "none"}
          >
            <div class="format-options">
              <button
                type="button"
                class="format-btn"
                class:selected={selectedFormat === "image"}
                onclick={() => handleFormatSelect("image")}
                aria-pressed={selectedFormat === "image"}
              >
                <i class="fas fa-image" aria-hidden="true"></i>
                <span>Image</span>
              </button>

              <button
                type="button"
                class="format-btn"
                class:selected={selectedFormat === "animation"}
                onclick={() => handleFormatSelect("animation")}
                aria-pressed={selectedFormat === "animation"}
              >
                <i class="fas fa-film" aria-hidden="true"></i>
                <span>Animation</span>
              </button>

              <button
                type="button"
                class="format-btn"
                class:selected={selectedFormat === "side-by-side"}
                onclick={() => handleFormatSelect("side-by-side")}
                aria-pressed={selectedFormat === "side-by-side"}
              >
                <i class="fas fa-columns" aria-hidden="true"></i>
                <span>Side-by-Side</span>
              </button>

              <button
                type="button"
                class="format-btn compose"
                onclick={() => handleCompose(collapse)}
                aria-label="Open in Compose"
              >
                <i class="fas fa-users" aria-hidden="true"></i>
                <span>Compose</span>
                <i class="fas fa-arrow-right compose-arrow" aria-hidden="true"></i>
              </button>
            </div>

            <div class="action-row">
              <button
                type="button"
                class="done-btn"
                onclick={() => handleDone(collapse)}
                aria-label="Download selected format"
              >
                <i class="fas fa-check" aria-hidden="true"></i>
                <span>Done</span>
              </button>

              <button
                type="button"
                class="close-btn"
                onclick={() => collapse()}
                aria-label="Cancel export"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        {/snippet}
      </MorphChip>
    </MorphChipGroup>
  </div>
</div>

<style>
  /* ===========================
     TOOLBAR LAYOUT
     =========================== */

  .morph-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  /* ===========================
     PLAY/PAUSE BUTTON
     =========================== */

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, rgba(139, 92, 246, 0.4));
    border-radius: 50%;
    color: var(--theme-accent, rgba(139, 92, 246, 1));
    font-size: var(--font-size-lg, 18px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    box-shadow:
      0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.2)),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .play-btn.playing {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  @media (hover: hover) and (pointer: fine) {
    .play-btn:hover {
      transform: scale(1.05);
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    }
  }

  .play-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
  }

  .play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ===========================
     ACTION BUTTONS (collapsed state)
     =========================== */

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 22px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .action-btn i {
    font-size: 14px;
  }

  @media (hover: hover) and (pointer: fine) {
    .action-btn:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .action-btn:active {
    transform: scale(0.95);
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

  .action-btn.get-app {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .action-btn.get-app:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .action-btn.copy-link {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.25);
    color: #a855f7;
  }

  .action-btn.copy-link:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .action-btn.connect {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.25);
    color: #06b6d4;
  }

  .action-btn.connect:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .action-btn.connect.active {
    background: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.35);
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
     CHIP AREA
     =========================== */

  .chip-area {
    flex: 1;
    min-width: 0;
  }

  /* ===========================
     CONTROLS CHIP - EXPANDED: single row
     =========================== */

  .controls-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }

  .step-section {
    flex-shrink: 0;
  }

  /* Hide the redundant play/pause inside TransportControls */
  .step-section :global(.play-pause-btn) {
    display: none;
  }

  /* Tighten the transport gap since play/pause is removed */
  .step-section :global(.transport-controls) {
    gap: 4px;
    margin: 0;
  }

  .tempo-section {
    flex-shrink: 0;
    min-width: 0;
  }

  /* ===========================
     EXPORT PANEL (download chip expanded)
     =========================== */

  .export-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 0 4px;
  }

  .format-options {
    display: flex;
    gap: 6px;
    flex: 1;
  }

  .format-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 48px;
    padding: 8px 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-weight: 600;
    font-size: var(--font-size-compact, 12px);
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .format-btn i:not(.compose-arrow) {
    font-size: 16px;
  }

  .format-btn.compose {
    flex-direction: row;
    gap: 6px;
  }

  .format-btn .compose-arrow {
    font-size: 10px;
    opacity: 0.6;
  }

  @media (hover: hover) and (pointer: fine) {
    .format-btn:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, #fff);
    }
  }

  .format-btn:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .format-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .format-btn.selected {
    background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-card-bg));
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  /* Compose button has distinct styling */
  .format-btn.compose {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.25);
    color: #06b6d4;
  }

  .format-btn.compose:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
  }

  /* ===========================
     ACTION ROW (Done / Close)
     =========================== */

  .action-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .done-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 16px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 22px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .done-btn i {
    font-size: 14px;
  }

  @media (hover: hover) and (pointer: fine) {
    .done-btn:hover {
      background: color-mix(in srgb, var(--theme-accent) 85%, white);
      transform: scale(1.02);
    }
  }

  .done-btn:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .done-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .close-btn:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, #fff);
    }
  }

  .close-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .play-btn,
    .action-btn,
    .format-btn,
    .done-btn,
    .close-btn {
      transition: none;
    }

    .play-btn:active,
    .action-btn:active,
    .format-btn:active,
    .done-btn:active,
    .close-btn:active {
      transform: none;
    }
  }
</style>
