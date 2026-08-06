<!--
  StepMapEditor.svelte

  Full beat annotation UI for mapping performance video timestamps to sequence
  beats. Combines a video player, transport controls, the draggable StepMapTimeline,
  tap-to-place mode for quick sequential marking, and save/cancel actions.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import { generateEvenBeatTimestamps } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";
  import StepMapTimeline from "./StepMapTimeline.svelte";

  interface Props {
    videoUrl: string;
    videoDuration: number;
    stepCount: number;
    initialStepMap?: StepMap;
    bpm: number;
    onSave: (beatMap: StepMap) => Promise<void>;
    onClose: () => void;
  }

  let {
    videoUrl,
    videoDuration,
    stepCount,
    initialStepMap,
    bpm,
    onSave,
    onClose,
  }: Props = $props();

  // ---- Video element ----
  let videoEl: HTMLVideoElement | undefined = $state();

  // ---- Playback state ----
  let isPlaying = $state(false);
  let currentTime = $state(0);

  // ---- Beat timestamps ----
  // Initialize from existing beat map or generate even spacing from BPM.
  // We track "placed" count separately from the array length so that
  // tap-to-place can fill slots incrementally.
  let beatTimestamps = $state<number[]>(
    untrack(() => initialStepMap)
      ? [...untrack(() => initialStepMap)!.beatTimestamps]
      : generateEvenBeatTimestamps(untrack(() => videoDuration), untrack(() => stepCount), untrack(() => bpm))
  );

  // ---- Tap-to-place mode ----
  let isTapMode = $state(false);
  // In tap mode we track how many beats have been placed via tapping.
  // If entering tap mode fresh (no initial map), we clear all timestamps
  // and place them one at a time. If editing an existing map, tapping
  // overwrites from the beginning.
  let tapPlacedCount = $state(0);
  // Copy of timestamps used during tap mode. Uncommitted until tap mode
  // exits or all beats are placed.
  let tapTimestamps = $state<number[]>([]);

  let nextStepToPlace = $derived(
    isTapMode ? tapPlacedCount : stepCount
  );

  let placedCount = $derived(
    isTapMode ? tapPlacedCount : beatTimestamps.length
  );

  // ---- Save state ----
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);

  // ---- Beat placement flash ----
  let flashBeatIndex = $state(-1);
  let flashTimeout: ReturnType<typeof setTimeout> | undefined;

  // The currently active beat based on playback position
  let activeStepIndex = $derived.by(() => {
    const ts = isTapMode ? tapTimestamps : beatTimestamps;
    for (let i = ts.length - 1; i >= 0; i--) {
      if (currentTime >= ts[i]!) return i;
    }
    return -1;
  });

  // ---- Video event handlers ----

  function handleTimeUpdate() {
    if (videoEl) currentTime = videoEl.currentTime;
  }

  function handlePlay() {
    isPlaying = true;
  }

  function handlePause() {
    isPlaying = false;
  }

  function handleEnded() {
    isPlaying = false;
  }

  // ---- Transport controls ----

  function togglePlayPause() {
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause();
    } else {
      videoEl.play();
    }
  }

  function seekTo(time: number) {
    const clamped = Math.max(0, Math.min(time, videoDuration));
    // Update display immediately - don't wait for the video to decode
    currentTime = clamped;
    if (videoEl) videoEl.currentTime = clamped;
  }

  function stepToBeat(direction: -1 | 1) {
    const ts = isTapMode ? tapTimestamps : beatTimestamps;
    if (ts.length === 0) return;

    if (direction === 1) {
      // Find the next beat after current position
      const next = ts.find((t) => t > currentTime + 0.05);
      if (next !== undefined) seekTo(next);
    } else {
      // Find the previous beat before current position
      for (let i = ts.length - 1; i >= 0; i--) {
        if (ts[i]! < currentTime - 0.15) {
          seekTo(ts[i]!);
          return;
        }
      }
      seekTo(0);
    }
  }

  // ---- Timeline callbacks ----

  function handleTimestampChange(index: number, newTime: number) {
    if (isTapMode) {
      tapTimestamps[index] = newTime;
    } else {
      beatTimestamps[index] = newTime;
    }
  }

  function handleSeek(time: number) {
    seekTo(time);
  }

  // ---- Tap-to-place ----

  function enterTapMode() {
    isTapMode = true;
    tapPlacedCount = 0;
    tapTimestamps = [];
    // Start playing so the user can tap along
    if (videoEl) {
      videoEl.currentTime = 0;
      currentTime = 0;
      videoEl.play();
    }
  }

  function exitTapMode() {
    isTapMode = false;
    // Commit whatever was placed
    if (tapTimestamps.length > 0) {
      beatTimestamps = [...tapTimestamps];
    }
  }

  function markBeat() {
    if (!isTapMode || tapPlacedCount >= stepCount) return;

    tapTimestamps = [...tapTimestamps, currentTime];
    tapPlacedCount++;

    // Flash feedback
    flashBeatIndex = tapPlacedCount - 1;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      flashBeatIndex = -1;
    }, 300);

    // Auto-exit when all beats placed
    if (tapPlacedCount >= stepCount) {
      // Small delay so the user sees the last beat placed
      setTimeout(() => {
        exitTapMode();
        if (videoEl) videoEl.pause();
      }, 400);
    }
  }

  // ---- Reset ----

  function resetToEvenSpacing() {
    beatTimestamps = generateEvenBeatTimestamps(videoDuration, stepCount, bpm);
    if (isTapMode) exitTapMode();
  }

  // ---- Save ----

  async function handleSave() {
    isSaving = true;
    saveError = null;

    const finalTimestamps = isTapMode ? tapTimestamps : beatTimestamps;

    const beatMap: StepMap = {
      beatTimestamps: [...finalTimestamps],
      stepCount,
      source: "manual",
      updatedAt: new Date(),
    };

    try {
      await onSave(beatMap);
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Failed to save beat map";
    } finally {
      isSaving = false;
    }
  }

</script>

<div class="beat-map-editor" transition:fade={{ duration: 200 }}>
  <!-- Video player -->
  <div class="video-section">
    <video
      bind:this={videoEl}
      src={videoUrl}
      playsinline
      ontimeupdate={handleTimeUpdate}
      onplay={handlePlay}
      onpause={handlePause}
      onended={handleEnded}
    >
      <track kind="captions" />
    </video>
  </div>

  <!-- Transport controls -->
  <div class="transport">
    <button
      class="transport-btn"
      onclick={() => stepToBeat(-1)}
      type="button"
      aria-label="Previous beat"
    >
      <i class="fas fa-step-backward" aria-hidden="true"></i>
    </button>

    <button
      class="transport-btn play-btn"
      onclick={togglePlayPause}
      type="button"
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i
        class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"
        aria-hidden="true"
      ></i>
    </button>

    <button
      class="transport-btn"
      onclick={() => stepToBeat(1)}
      type="button"
      aria-label="Next beat"
    >
      <i class="fas fa-step-forward" aria-hidden="true"></i>
    </button>

    <span class="transport-time">
      {formatTime(currentTime)} / {formatTime(videoDuration)}
    </span>
  </div>

  <!-- Timeline -->
  <div class="timeline-section">
    <StepMapTimeline
      duration={videoDuration}
      {currentTime}
      beatTimestamps={isTapMode ? tapTimestamps : beatTimestamps}
      {activeStepIndex}
      onTimestampChange={handleTimestampChange}
      onSeek={handleSeek}
    />
  </div>

  <!-- Mode controls -->
  <div class="mode-controls">
    {#if isTapMode}
      <button
        class="mark-beat-btn"
        class:flash={flashBeatIndex >= 0}
        onclick={markBeat}
        disabled={tapPlacedCount >= stepCount}
        type="button"
      >
        <i class="fas fa-drum" aria-hidden="true"></i>
        Mark Beat {tapPlacedCount + 1}
      </button>

      <button
        class="mode-btn"
        onclick={exitTapMode}
        type="button"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
        Exit Tap Mode
      </button>
    {:else}
      <button class="mode-btn" onclick={enterTapMode} type="button">
        <i class="fas fa-hand-pointer" aria-hidden="true"></i>
        Tap to Place
      </button>

      <button class="mode-btn" onclick={resetToEvenSpacing} type="button">
        <i class="fas fa-redo" aria-hidden="true"></i>
        Reset
      </button>
    {/if}

    <span class="beat-counter">
      {placedCount} / {stepCount} beats
    </span>
  </div>

  <!-- Error -->
  {#if saveError}
    <div class="error-banner" role="alert">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{saveError}</span>
    </div>
  {/if}

  <!-- Action bar -->
  <div class="action-bar">
    <button
      class="cancel-btn"
      onclick={onClose}
      disabled={isSaving}
      type="button"
    >
      Cancel
    </button>

    <button
      data-save-shortcut
      class="save-btn"
      onclick={handleSave}
      disabled={isSaving || placedCount === 0}
      type="button"
    >
      {#if isSaving}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Saving...
      {:else}
        <i class="fas fa-check" aria-hidden="true"></i>
        Save Beat Map
      {/if}
    </button>
  </div>
</div>

<style>
  .beat-map-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    padding: 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    overflow-y: auto;
  }

  /* ============================================================
   * VIDEO PLAYER
   * ============================================================ */

  .video-section {
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    flex-shrink: 0;
  }

  .video-section video {
    display: block;
    width: 100%;
    max-height: 280px;
    object-fit: contain;
  }

  /* ============================================================
   * TRANSPORT CONTROLS
   * ============================================================ */

  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .transport-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .transport-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .transport-btn:active {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .transport-btn.play-btn {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: #ffffff;
    font-size: 16px;
  }

  .transport-btn.play-btn:hover {
    filter: brightness(1.1);
    background: var(--theme-accent, #6366f1);
  }

  .transport-time {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  /* ============================================================
   * TIMELINE SECTION
   * ============================================================ */

  .timeline-section {
    flex-shrink: 0;
    padding: 0 4px;
  }

  /* ============================================================
   * MODE CONTROLS
   * ============================================================ */

  .mode-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .mark-beat-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    min-height: 48px;
    border: none;
    border-radius: 12px;
    background: var(--semantic-success, #22c55e);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.15s ease, filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mark-beat-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
  }

  .mark-beat-btn:active:not(:disabled) {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .mark-beat-btn.flash {
    animation: beat-flash 0.3s ease;
  }

  .mark-beat-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes beat-flash {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent);
    }
    50% {
      box-shadow: 0 0 0 12px color-mix(in srgb, var(--semantic-success, #22c55e) 0%, transparent);
    }
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 0%, transparent);
    }
  }

  /* ============================================================
   * ERROR
   * ============================================================ */

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: 10px;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    flex-shrink: 0;
  }

  /* ============================================================
   * ACTION BAR
   * ============================================================ */

  .action-bar {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    margin-top: auto;
    padding-top: 8px;
  }

  .cancel-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .cancel-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-btn {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 24px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .save-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ============================================================
   * REDUCED MOTION
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .transport-btn,
    .mode-btn,
    .mark-beat-btn,
    .cancel-btn,
    .save-btn {
      transition: none !important;
    }

    .transport-btn:active,
    .mark-beat-btn:active,
    .save-btn:active {
      transform: none !important;
    }

    .mark-beat-btn.flash {
      animation: none !important;
    }
  }
</style>
