<!--
  ViewerMorphToolbar.svelte

  Mobile/mid-width footer layout for the Sequence Viewer.

  Default state (single row):
  [▶ Play] [── 60 BPM ──] [Save] [Remix]

  Controls expanded (replaces row):
  Row 1: [< « ▶ » >] transport controls
  Row 2: [- 60 BPM +] [Practice] [✕ close]
-->
<script lang="ts">
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import TempoControl from "./TempoControl.svelte";

  interface Props {
    bpm: number;
    isPlaying: boolean;
    isLoggedIn: boolean;
    practiceActive?: boolean;

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
    onPracticeStart?: () => void;
    onPracticeStop?: () => void;
    isOwned?: boolean;
    onDeleteRequest?: () => void;
    onVideoUpload?: () => void;
    videoCount?: number;
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    onFavorite?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onCopyLink?: () => void;
    onPropsOpen?: () => void;
    linkCopied?: boolean;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    practiceActive = false,
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
    onPracticeStart,
    onPracticeStop,
    isOwned = false,
    onDeleteRequest,
    onVideoUpload,
    videoCount,
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    onFavorite,
    onPublish,
    onUnpublish,
    onCopyLink,
    onPropsOpen,
    linkCopied = false,
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
  <!-- Two rows: actions + BPM chip (hidden when controls expanded) -->
  <div class="toolbar-collapsed" class:hidden={controlsExpanded}>
    <div class="actions-row">
      <button
        type="button"
        class="play-btn"
        class:playing={isPlaying}
        onclick={onPlayPause}
        aria-label={isPlaying ? "Pause animation" : "Play animation"}
      >
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
      </button>

      {#if isLoggedIn}
        <!-- Favorite heart -->
        {#if onFavorite}
          <button
            type="button"
            class="action-btn"
            class:favorited={isFavorite}
            onclick={onFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <i class="fas fa-heart" aria-hidden="true"></i>
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        {/if}

        {#if onCopyLink}
          <button
            type="button"
            class="action-btn"
            class:copied={linkCopied}
            onclick={onCopyLink}
            aria-label={linkCopied ? "Link copied" : "Copy shareable link"}
          >
            <i class="fas {linkCopied ? 'fa-check' : 'fa-link'}" aria-hidden="true"></i>
            <span>{linkCopied ? "Copied" : "Copy Link"}</span>
          </button>
        {/if}

        <!-- Save (only when unsaved) -->
        {#if isOwned && !isSaved}
          <button
            type="button"
            class="action-btn save"
            onclick={onSave}
            aria-label="Save sequence"
          >
            <i class="fas fa-floppy-disk" aria-hidden="true"></i>
            <span>Save</span>
          </button>
        {/if}

        <!-- Remix (owner only, when saved) -->
        {#if isOwned && isSaved}
          <button
            type="button"
            class="action-btn edit"
            onclick={onEdit}
            aria-label="Remix"
          >
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            <span>Remix</span>
          </button>
        {/if}

        {#if onPropsOpen}
          <button
            type="button"
            class="action-btn"
            onclick={onPropsOpen}
            aria-label="Change props"
          >
            <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
            <span>Props</span>
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

      {#if isLoggedIn && onVideoUpload}
        <button
          type="button"
          class="action-btn video"
          onclick={onVideoUpload}
          aria-label="Upload video"
        >
          <i class="fas fa-video" aria-hidden="true"></i>
          <span>Video</span>
          {#if videoCount && videoCount > 0}
            <span class="video-badge">{videoCount}</span>
          {/if}
        </button>
      {/if}
      {#if isLoggedIn && isOwned && isSaved}
        <button
          type="button"
          class="action-btn"
          onclick={isPublished ? onUnpublish : onPublish}
          aria-label={isPublished ? "Make Private" : "Make Public"}
        >
          <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
          <span>{isPublished ? "Make Private" : "Make Public"}</span>
        </button>
        {#if onDeleteRequest}
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
      {/if}
    </div>

    <div class="bpm-row">
      <button
        type="button"
        class="chip-trigger"
        class:active={controlsExpanded}
        onclick={openControls}
        aria-label="Playback controls: {bpm} BPM"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
        <span class="chip-value">{bpm} BPM</span>
        <i class="fas fa-chevron-up chip-chevron" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <!-- Expanded controls: slides up from below the main row -->
  {#if controlsExpanded}
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
        <button
          type="button"
          class="practice-btn"
          class:active={practiceActive}
          onclick={() => practiceActive ? onPracticeStop?.() : onPracticeStart?.()}
          aria-label={practiceActive ? "Stop practice training" : "Start practice training"}
        >
          {practiceActive ? "Stop" : "Practice"}
        </button>
        <div class="tempo-wrapper">
          <TempoControl
            {bpm}
            {onBpmChange}
            showPresets={false}
            showPractice={false}
            practiceActive={practiceActive}
            onPracticeStart={onPracticeStart}
            onPracticeStop={onPracticeStop}
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
     COLLAPSED STATE: TWO ROWS
     =========================== */

  .toolbar-collapsed {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .toolbar-collapsed.hidden {
    display: none;
  }

  .actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    flex-wrap: wrap;
  }

  .bpm-row {
    display: flex;
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
    flex: 1 1 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--min-touch-target);
    min-width: 80px;
    padding: 0 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, rgba(139, 92, 246, 0.35));
    border-radius: 24px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip-trigger i {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .chip-chevron {
    font-size: 10px !important;
    opacity: 0.6;
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
    flex-shrink: 0;
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

  .action-btn.delete {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    color: var(--semantic-error);
  }

  .action-btn.delete:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
  }

  .action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .action-btn.favorited:hover {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
  }

  .action-btn.copied {
    color: var(--semantic-success, #22c55e);
    border-color: rgba(34, 197, 94, 0.25);
  }

  /* ===========================
     INLINE CONTROLS (replaces action + playback rows)
     =========================== */

  .controls-inline {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    animation: slide-up 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
    transform-origin: bottom;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .transport-row {
    display: flex;
    justify-content: center;
  }

  .tempo-close-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .tempo-wrapper {
    min-width: 0;
  }

  /* ===========================
     PRACTICE BUTTON (in tempo row)
     =========================== */

  .practice-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .practice-btn.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
    animation: practice-pulse 2s ease-in-out infinite;
  }

  @keyframes practice-pulse {
    0%, 100% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.2); }
    50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.35); }
  }

  @media (hover: hover) and (pointer: fine) {
    .practice-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .practice-btn:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .practice-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
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
     VIDEO COUNT BADGE
     =========================== */

  .action-btn.video {
    position: relative;
  }

  .video-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .play-btn,
    .action-btn,
    .chip-trigger,
    .practice-btn,
    .close-controls-btn,
    .controls-inline {
      transition: none;
      animation: none;
    }

    .play-btn:active,
    .action-btn:active,
    .chip-trigger:active,
    .practice-btn:active,
    .close-controls-btn:active {
      transform: none;
    }
  }
</style>
