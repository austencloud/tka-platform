<!--
  StepMapEditor.svelte

  Full beat annotation UI for mapping performance video timestamps to sequence
  beats. Combines a video player, transport controls, the draggable StepMapTimeline,
  tap-to-place mode for quick sequential marking, and save/cancel actions.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import { generateEvenBeatTimestamps } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";
  import StepMapTimeline from "./StepMapTimeline.svelte";

  interface Props {
    videoUrl: string;
    videoDuration: number;
    stepCount: number;
    stepLabels?: readonly string[];
    initialStepMap?: StepMap;
    bpm: number;
    onSave: (beatMap: StepMap) => Promise<void>;
    onClose: () => void;
  }

  let {
    videoUrl,
    videoDuration,
    stepCount,
    stepLabels = [],
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
      : generateEvenBeatTimestamps(
          untrack(() => videoDuration),
          untrack(() => stepCount),
          untrack(() => bpm)
        )
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

  let nextStepToPlace = $derived(isTapMode ? tapPlacedCount : stepCount);

  let placedCount = $derived(
    isTapMode ? tapPlacedCount : beatTimestamps.length
  );

  // ---- Save state ----
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);

  // ---- Beat placement flash ----
  let flashBeatIndex = $state(-1);
  let flashTimeout: ReturnType<typeof setTimeout> | undefined;
  let autoExitTimeout: ReturnType<typeof setTimeout> | undefined;

  const canSave = $derived(
    !isSaving && placedCount === stepCount && stepCount > 0
  );

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

  function togglePlayPause(): void {
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause();
    } else {
      void videoEl.play().catch(() => {
        saveError = "Playback could not start. Try the play button again.";
      });
    }
  }

  function seekTo(time: number): void {
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

  function enterTapMode(): void {
    isTapMode = true;
    tapPlacedCount = 0;
    tapTimestamps = [];
    // Start playing so the user can tap along
    if (videoEl) {
      videoEl.currentTime = 0;
      currentTime = 0;
      void videoEl.play().catch(() => {
        saveError = "Playback could not start. Try the play button again.";
      });
    }
  }

  function exitTapMode(): void {
    isTapMode = false;
    // Commit whatever was placed
    if (tapTimestamps.length > 0) {
      beatTimestamps = [...tapTimestamps];
    }
  }

  function markBeat(): void {
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
      if (autoExitTimeout) clearTimeout(autoExitTimeout);
      autoExitTimeout = setTimeout(() => {
        exitTapMode();
        if (videoEl) videoEl.pause();
      }, 400);
    }
  }

  function undoLastMarker(): void {
    if (!isTapMode || tapPlacedCount === 0) return;
    tapTimestamps = tapTimestamps.slice(0, -1);
    tapPlacedCount -= 1;
    flashBeatIndex = -1;
  }

  function stepLabel(index: number): string {
    return stepLabels[index]?.trim() || `Move ${index + 1}`;
  }

  function handleKeyboard(event: KeyboardEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement
    ) {
      return;
    }
    if (isTapMode && (event.code === "Space" || event.key === "Enter")) {
      event.preventDefault();
      markBeat();
      return;
    }
    if (isTapMode && (event.ctrlKey || event.metaKey) && event.key === "z") {
      event.preventDefault();
      undoLastMarker();
    }
  }

  // ---- Reset ----

  function resetToEvenSpacing(): void {
    beatTimestamps = generateEvenBeatTimestamps(videoDuration, stepCount, bpm);
    if (isTapMode) exitTapMode();
  }

  // ---- Save ----

  async function handleSave(): Promise<void> {
    isSaving = true;
    saveError = null;

    const finalTimestamps = isTapMode ? tapTimestamps : beatTimestamps;

    if (finalTimestamps.length !== stepCount) {
      saveError = `Mark all ${stepCount} moves before saving.`;
      isSaving = false;
      return;
    }

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

  onDestroy(() => {
    if (flashTimeout) clearTimeout(flashTimeout);
    if (autoExitTimeout) clearTimeout(autoExitTimeout);
  });
</script>

<svelte:window onkeydown={handleKeyboard} />

<div class="beat-map-editor">
  <div class="mapping-intro">
    <div>
      <span class="eyebrow">Move timing</span>
      <h3>
        {isTapMode
          ? `Mark move ${Math.min(tapPlacedCount + 1, stepCount)} of ${stepCount}`
          : "Synchronize the performance"}
      </h3>
      <p>
        {isTapMode
          ? `Press Space or tap Mark when ${stepLabel(tapPlacedCount)} begins.`
          : "Play the video, mark each move, then fine-tune the markers on the timeline."}
      </p>
    </div>
    <strong class:complete={placedCount === stepCount} class="mapping-progress">
      {placedCount}/{stepCount}
    </strong>
  </div>
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
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
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

  <div class="step-strip" aria-label="Sequence move timing">
    {#each Array(stepCount) as _, index}
      <button
        type="button"
        class:active={activeStepIndex === index}
        class:placed={index < placedCount}
        disabled={(isTapMode ? tapTimestamps : beatTimestamps)[index] ===
          undefined}
        aria-label={`Seek to ${stepLabel(index)}`}
        onclick={() =>
          seekTo((isTapMode ? tapTimestamps : beatTimestamps)[index] ?? 0)}
      >
        <span>{index + 1}</span>
        <strong>{stepLabel(index)}</strong>
      </button>
    {/each}
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
        Mark move {Math.min(tapPlacedCount + 1, stepCount)}
      </button>

      <button
        class="mode-btn"
        onclick={undoLastMarker}
        disabled={tapPlacedCount === 0}
        type="button"
      >
        <i class="fas fa-undo" aria-hidden="true"></i>
        Undo marker
      </button>

      <button class="mode-btn" onclick={exitTapMode} type="button">
        <i class="fas fa-times" aria-hidden="true"></i>
        Stop marking
      </button>
    {:else}
      <button class="mode-btn" onclick={enterTapMode} type="button">
        <i class="fas fa-hand-pointer" aria-hidden="true"></i>
        Mark moves
      </button>

      <button class="mode-btn" onclick={resetToEvenSpacing} type="button">
        <i class="fas fa-redo" aria-hidden="true"></i>
        Even spacing
      </button>
    {/if}

    <span class="beat-counter">
      {placedCount} / {stepCount} moves
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
      disabled={!canSave}
      type="button"
    >
      {#if isSaving}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Saving...
      {:else}
        <i class="fas fa-check" aria-hidden="true"></i>
        Save timing
      {/if}
    </button>
  </div>
</div>

<style>
  .beat-map-editor {
    display: flex;
    flex-direction: column;
    container-type: inline-size;
    gap: 0.75rem;
    height: 100%;
    padding: 1rem;
    background: var(--theme-panel-bg);
    overflow-y: auto;
  }

  .mapping-intro {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .mapping-intro > div {
    display: grid;
    gap: 0.25rem;
  }

  .eyebrow {
    color: var(--theme-accent);
    font-size: var(--font-size-compact);
    font-weight: 750;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .mapping-intro h3,
  .mapping-intro p {
    margin: 0;
  }

  .mapping-intro h3 {
    color: var(--theme-text);
    font-size: 1.25rem;
  }

  .mapping-intro p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
    line-height: 1.4;
  }

  .mapping-progress {
    display: grid;
    place-items: center;
    min-width: 4rem;
    min-height: 2.75rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 45%, transparent);
    border-radius: var(--radius-2026-full);
    color: var(--semantic-warning);
    font-size: var(--font-size-min);
    font-variant-numeric: tabular-nums;
  }

  .mapping-progress.complete {
    border-color: color-mix(in srgb, var(--semantic-success) 45%, transparent);
    color: var(--semantic-success);
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
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
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

  .step-strip {
    display: grid;
    grid-auto-columns: minmax(5.5rem, 1fr);
    grid-auto-flow: column;
    gap: 0.4rem;
    min-height: 3.5rem;
    padding-bottom: 0.25rem;
    overflow-x: auto;
  }

  .step-strip button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.45rem;
    min-height: 3.25rem;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font: inherit;
    font-size: var(--font-size-compact);
    cursor: pointer;
  }

  .step-strip button > span {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-2026-full);
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    font-variant-numeric: tabular-nums;
  }

  .step-strip button strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-strip button.placed {
    border-color: color-mix(
      in srgb,
      var(--semantic-success) 38%,
      var(--theme-stroke)
    );
    color: var(--theme-text);
  }

  .step-strip button.active {
    border-color: var(--theme-accent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 14%,
      var(--theme-card-bg)
    );
  }

  .step-strip button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .step-strip button:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
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
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
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
    transition:
      transform 0.1s ease,
      box-shadow 0.15s ease,
      filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mark-beat-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 16px
      color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
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
      box-shadow: 0 0 0 0
        color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent);
    }
    50% {
      box-shadow: 0 0 0 12px
        color-mix(in srgb, var(--semantic-success, #22c55e) 0%, transparent);
    }
    100% {
      box-shadow: 0 0 0 0
        color-mix(in srgb, var(--semantic-success, #22c55e) 0%, transparent);
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
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
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
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
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
    transition:
      filter 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
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

  @container (min-width: 70rem) {
    .beat-map-editor {
      gap: 1rem;
      padding: 1.5rem;
    }

    .video-section video {
      max-height: 34rem;
    }

    .mapping-intro h3 {
      font-size: 1.5rem;
    }

    .mapping-intro p,
    .mode-btn,
    .transport-time,
    .step-strip button {
      font-size: var(--font-size-min);
    }
  }
</style>
