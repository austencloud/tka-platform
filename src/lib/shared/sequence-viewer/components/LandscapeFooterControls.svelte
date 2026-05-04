<script lang="ts">
  import TempoControl from "./TempoControl.svelte";

  interface Props {
    bpm: number;
    isPlaying: boolean;
    practiceActive?: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onRestartToStart?: () => void;
    onSave: () => void;
    onEdit: () => void;
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
  }

  let {
    bpm,
    isPlaying,
    practiceActive = false,
    onBpmChange,
    onPlayPause,
    onStepBack,
    onStepForward,
    onRestartToStart,
    onSave,
    onEdit,
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
  }: Props = $props();

  let bpmPopoverOpen = $state(false);
</script>

<aside class="landscape-controls" aria-label="Playback and actions">
  <button
    type="button"
    class="landscape-btn play-pause"
    onclick={onPlayPause}
    aria-label={isPlaying ? "Pause" : "Play"}
  >
    <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <button
    type="button"
    class="landscape-btn"
    onclick={onRestartToStart ?? onStepBack}
    aria-label={onRestartToStart ? "Restart from beginning" : "Step backward"}
  >
    <i class="fas {onRestartToStart ? 'fa-backward-fast' : 'fa-backward-step'}" aria-hidden="true"></i>
  </button>
  <button
    type="button"
    class="landscape-btn"
    onclick={onStepForward}
    aria-label="Step forward"
  >
    <i class="fas fa-forward-step" aria-hidden="true"></i>
  </button>

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
          practiceActive={practiceActive}
          onPracticeStart={onPracticeStart}
          onPracticeStop={onPracticeStop}
        />
      </div>
    {/if}
  </div>

  <div class="landscape-divider" aria-hidden="true"></div>

  {#if onFavorite}
    <button
      type="button"
      class="landscape-btn"
      class:favorited={isFavorite}
      onclick={onFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <i class="fas fa-heart" aria-hidden="true"></i>
    </button>
  {/if}
  {#if !isSaved}
    <button
      type="button"
      class="landscape-btn save"
      onclick={onSave}
      aria-label="Save"
    >
      <i class="fas fa-floppy-disk" aria-hidden="true"></i>
    </button>
  {/if}
  <button
    type="button"
    class="landscape-btn edit"
    onclick={onEdit}
    aria-label="Remix"
  >
    <i class="fas fa-pen-to-square" aria-hidden="true"></i>
  </button>
  {#if onVideoUpload}
    <button
      type="button"
      class="landscape-btn video"
      onclick={onVideoUpload}
      aria-label="Upload video"
    >
      <i class="fas fa-video" aria-hidden="true"></i>
      {#if videoCount && videoCount > 0}
        <span class="video-badge video-badge-sm">{videoCount}</span>
      {/if}
    </button>
  {/if}
  {#if isOwned && isSaved}
    <button
      type="button"
      class="landscape-btn"
      onclick={isPublished ? onUnpublish : onPublish}
      aria-label={isPublished ? "Make Private" : "Make Public"}
    >
      <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
    </button>
    {#if onDeleteRequest}
      <button
        type="button"
        class="landscape-btn delete"
        onclick={onDeleteRequest}
        aria-label="Delete sequence"
      >
        <i class="fas fa-trash" aria-hidden="true"></i>
      </button>
    {/if}
  {/if}
</aside>

<style>
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

  .landscape-btn.save { color: #22c55e; border-color: rgba(34, 197, 94, 0.25); }
  .landscape-btn.edit { color: #f59e0b; border-color: rgba(245, 158, 11, 0.25); }
  .landscape-btn.delete { color: var(--semantic-error); border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent); }
  .landscape-btn.favorited { color: var(--semantic-error); border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent); }

  .landscape-divider {
    width: 28px;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 1;
    margin: 1px 0;
  }

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

  .landscape-btn.video {
    position: relative;
  }

  .video-badge-sm {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .landscape-btn {
      transition: none;
    }

    .landscape-btn:active {
      transform: none;
    }
  }
</style>
