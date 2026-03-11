<!--
  ViewerMorphToolbar.svelte

  Mobile/mid-width footer layout for the Sequence Viewer.

  Default state:
  Row 1: [Save] [Construct] [Video] [Image] [Delete]
  Row 2: [▶ Play] [── 60 BPM ──]

  Controls expanded (replaces both rows inline):
  Row 1: [< « ▶ » >] transport controls
  Row 2: [- 60 BPM +] [Ramp] [✕ close]
-->
<script lang="ts">
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import TempoControl from "./TempoControl.svelte";

  interface Props {
    bpm: number;
    isPlaying: boolean;
    isLoggedIn: boolean;
    rampActive?: boolean;

    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onStepHalfBack?: () => void;
    onStepHalfForward?: () => void;
    onRestartToStart?: () => void;
    onSave: () => void;
    onEdit: () => void;
    onGetApp?: () => void;
    onExportVideo?: () => void;
    onExportImage?: () => void;
    onRampStart?: () => void;
    onRampStop?: () => void;
    isOwned?: boolean;
    onDeleteRequest?: () => void;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    rampActive = false,
    onBpmChange,
    onPlayPause,
    onStepBack,
    onStepForward,
    onStepHalfBack,
    onStepHalfForward,
    onRestartToStart,
    onSave,
    onEdit,
    onGetApp,
    onExportVideo,
    onExportImage,
    onRampStart,
    onRampStop,
    isOwned = false,
    onDeleteRequest,
  }: Props = $props();

  let controlsExpanded = $state(false);

  function openControls() {
    controlsExpanded = true;
  }

  function closeControls() {
    controlsExpanded = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (controlsExpanded) closeControls();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="morph-toolbar" onkeydown={handleKeydown}>
  {#if controlsExpanded}
    <!-- CONTROLS MODE: transport + tempo inline, replaces action/chip rows -->
    <div class="controls-inline">
      <div class="transport-row">
        <TransportControls
          {isPlaying}
          onPlaybackToggle={onPlayPause}
          onStepHalfBeatBackward={onStepHalfBack ?? (() => {})}
          onStepHalfBeatForward={onStepHalfForward ?? (() => {})}
          onStepFullBeatBackward={onStepBack}
          onStepFullBeatForward={onStepForward}
          {onRestartToStart}
        />
      </div>
      <div class="tempo-close-row">
        <div class="tempo-wrapper">
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
          class="close-controls-btn"
          onclick={closeControls}
          aria-label="Close playback controls"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  {:else}
    <!-- DEFAULT MODE: action buttons + play/BPM row -->
    <div class="action-row-top">
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
          class="action-btn construct"
          onclick={onEdit}
          aria-label="Open in Constructor"
        >
          <i class="fas fa-hammer" aria-hidden="true"></i>
          <span>Construct</span>
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

      {#if onExportVideo}
        <button
          type="button"
          class="action-btn export-video"
          onclick={onExportVideo}
          aria-label="Export video"
        >
          <i class="fas fa-video" aria-hidden="true"></i>
          <span>Video</span>
        </button>
      {/if}
      {#if onExportImage}
        <button
          type="button"
          class="action-btn export-image"
          onclick={onExportImage}
          aria-label="Export image"
        >
          <i class="fas fa-image" aria-hidden="true"></i>
          <span>Image</span>
        </button>
      {/if}

      {#if isLoggedIn && isOwned && onDeleteRequest}
        <button
          type="button"
          class="action-btn delete"
          onclick={onDeleteRequest}
          aria-label="Delete sequence"
        >
          <i class="fas fa-trash" aria-hidden="true"></i>
          <span>Delete</span>
        </button>
      {/if}
    </div>

    <div class="playback-row">
      <button
        type="button"
        class="play-btn"
        class:playing={isPlaying}
        onclick={onPlayPause}
        aria-label={isPlaying ? "Pause animation" : "Play animation"}
      >
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="chip-trigger"
        class:active={controlsExpanded}
        onclick={openControls}
        aria-label="Playback controls: {bpm} BPM"
      >
        <span class="chip-value">{bpm} BPM</span>
      </button>
    </div>
  {/if}
</div>


<style>
  /* ===========================
     TOOLBAR LAYOUT
     =========================== */

  .morph-toolbar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  /* ===========================
     ROW 1: ACTION BUTTONS
     =========================== */

  .action-row-top {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .action-row-top::-webkit-scrollbar {
    display: none;
  }

  /* ===========================
     ROW 2: PLAY + CHIP TRIGGERS
     =========================== */

  .playback-row {
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
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
     CHIP TRIGGERS
     =========================== */

  .chip-trigger {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--min-touch-target);
    min-width: 0;
    padding: 0 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip-trigger.active {
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 1px var(--theme-accent, #6366f1);
  }

  @media (hover: hover) and (pointer: fine) {
    .chip-trigger:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    }
  }

  .chip-trigger:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .chip-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ===========================
     ACTION BUTTONS (row 1)
     =========================== */

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

  .action-btn.construct {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .action-btn.construct:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
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

  .action-btn.export-video {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.25);
    color: #3b82f6;
  }

  .action-btn.export-video:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .action-btn.export-image {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.25);
    color: #06b6d4;
  }

  .action-btn.export-image:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .action-btn.delete {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    color: var(--semantic-error);
  }

  .action-btn.delete:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
  }

  /* ===========================
     INLINE CONTROLS (replaces action + playback rows)
     =========================== */

  .controls-inline {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .transport-row {
    display: flex;
    justify-content: center;
  }

  .tempo-close-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tempo-wrapper {
    flex: 1;
    min-width: 0;
  }

  .close-controls-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .close-controls-btn:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, #fff);
    }
  }

  .close-controls-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
  }

  .close-controls-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .play-btn,
    .action-btn,
    .chip-trigger,
    .close-controls-btn {
      transition: none;
    }

    .play-btn:active,
    .action-btn:active,
    .chip-trigger:active,
    .close-controls-btn:active {
      transform: none;
    }
  }
</style>
