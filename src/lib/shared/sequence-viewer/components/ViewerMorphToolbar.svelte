<!--
  ViewerMorphToolbar.svelte

  Mobile/mid-width footer layout for the Sequence Viewer.

  Default state:
  Row 1: [Save] [Edit] [Copy Link] [Connect]
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
    onEdit: () => void;
    onCompose: () => void;
    onGetApp?: () => void;
    onRampStart?: () => void;
    onRampStop?: () => void;
    onConnect?: () => void;
    isOwned?: boolean;
    onDeleteRequest?: () => void;
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
    onEdit,
    onCompose,
    onGetApp,
    onRampStart,
    onRampStop,
    onConnect,
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

  function handleCopyLink() {
    if (sequenceUrl) {
      navigator.clipboard.writeText(sequenceUrl);
    }
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
    <!-- DEFAULT MODE: action buttons + play/BPM/download row -->
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
          class="action-btn edit"
          onclick={onEdit}
          aria-label="Edit in Constructor"
        >
          <i class="fas fa-hammer" aria-hidden="true"></i>
          <span>Edit</span>
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
     CHIP TRIGGERS
     =========================== */

  .chip-trigger {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
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

  .action-btn.edit {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .action-btn.edit:hover {
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
