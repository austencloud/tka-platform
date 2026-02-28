<!--
  SyncPlaybackControls.svelte

  Playback controls that integrate with the device sync system.
  Provides play/pause, speed selection, loop toggle, and step navigation.

  Mobile Optimizations:
  - 48px minimum touch targets (WCAG AAA)
  - Haptic feedback on play/pause
  - Swipe gestures for seeking (optional)
  - Reduced motion support
-->
<script lang="ts">
  import { deviceSyncState } from '../state/device-sync-state.svelte';

  let {
    showSpeed = true,
    showLoop = true,
    showStepControls = true,
    showSeekGestures = false,
    compact = false,
  }: {
    showSpeed?: boolean;
    showLoop?: boolean;
    showStepControls?: boolean;
    /** Enable swipe left/right to seek (mobile-friendly) */
    showSeekGestures?: boolean;
    compact?: boolean;
  } = $props();

  // Speed presets
  const speedPresets = $derived(compact ? [0.5, 1, 1.5, 2] : [0.5, 1, 1.5, 2]);

  // Derived state from deviceSyncState
  const isPlaying = $derived(deviceSyncState.isPlaying);
  const speed = $derived(deviceSyncState.speed);
  const loop = $derived(deviceSyncState.loop);
  const currentStep = $derived(deviceSyncState.currentStep);
  const totalSteps = $derived(deviceSyncState.totalSteps);
  const controlsDisabled = $derived(!deviceSyncState.isConnected);

  // Detect reduced motion preference
  let prefersReducedMotion = $state(false);

  // Swipe gesture state
  let touchStartX: number | null = null;
  let touchStartY: number | null = null;
  let isSwiping = $state(false);
  const SWIPE_THRESHOLD = 50; // Minimum swipe distance in pixels
  const SWIPE_ANGLE_THRESHOLD = 30; // Max angle from horizontal in degrees

  // Initialize reduced motion detection
  $effect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion = mediaQuery.matches;

      const handleChange = (e: MediaQueryListEvent) => {
        prefersReducedMotion = e.matches;
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  });

  /**
   * Trigger haptic feedback if available.
   * Uses navigator.vibrate API which is widely supported on mobile.
   */
  function triggerHaptic(pattern: number | number[] = 10): void {
    // Skip haptic if user prefers reduced motion
    if (prefersReducedMotion) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Haptic not available - fail silently
      }
    }
  }

  // Handlers
  function handlePlayPause() {
    // Trigger haptic feedback
    triggerHaptic(isPlaying ? [5, 30, 5] : 15);

    if (isPlaying) {
      deviceSyncState.pause();
    } else {
      deviceSyncState.play();
    }
  }

  function handleSpeedChange(newSpeed: number) {
    triggerHaptic(5);
    deviceSyncState.setSpeed(newSpeed);
  }

  function handleLoopToggle() {
    triggerHaptic(loop ? 5 : [5, 20, 5]);
    deviceSyncState.toggleLoop();
  }

  function handleSeek(step: number) {
    triggerHaptic(3);
    deviceSyncState.seek(step);
  }

  function stepForward() {
    handleSeek(Math.min(currentStep + 1, totalSteps - 1));
  }

  function stepBackward() {
    handleSeek(Math.max(currentStep - 1, 0));
  }

  // Swipe gesture handlers
  function handleTouchStart(event: TouchEvent) {
    if (!showSeekGestures || controlsDisabled) return;

    const touch = event.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isSwiping = false;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!showSeekGestures || !touchStartX || !touchStartY || controlsDisabled) return;

    const touch = event.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Check if this is a horizontal swipe
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
    const isHorizontal = angle < SWIPE_ANGLE_THRESHOLD || angle > (180 - SWIPE_ANGLE_THRESHOLD);

    if (isHorizontal && Math.abs(deltaX) > 20) {
      isSwiping = true;
      // Prevent vertical scrolling while swiping
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!showSeekGestures || !touchStartX || !touchStartY || controlsDisabled) return;

    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Check if this is a valid horizontal swipe
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
    const isHorizontal = angle < SWIPE_ANGLE_THRESHOLD || angle > (180 - SWIPE_ANGLE_THRESHOLD);

    if (isHorizontal && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        // Swipe right - go forward
        stepForward();
      } else {
        // Swipe left - go backward
        stepBackward();
      }
    }

    // Reset state
    touchStartX = null;
    touchStartY = null;
    isSwiping = false;
  }

  function handleTouchCancel() {
    touchStartX = null;
    touchStartY = null;
    isSwiping = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sync-playback-controls"
  class:compact
  class:reduced-motion={prefersReducedMotion}
  class:swiping={isSwiping}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchCancel}
>
  <!-- Left: Transport controls -->
  <div class="controls-section transport">
    {#if showStepControls}
      <button
        class="control-btn step-btn"
        onclick={stepBackward}
        disabled={controlsDisabled || currentStep === 0}
        aria-label="Previous step"
      >
        <i class="fas fa-step-backward" aria-hidden="true"></i>
      </button>
    {/if}

    <button
      class="control-btn play-pause-btn"
      onclick={handlePlayPause}
      disabled={controlsDisabled}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      <i class="fas fa-{isPlaying ? 'pause' : 'play'}" aria-hidden="true"></i>
    </button>

    {#if showStepControls}
      <button
        class="control-btn step-btn"
        onclick={stepForward}
        disabled={controlsDisabled || currentStep >= totalSteps - 1}
        aria-label="Next step"
      >
        <i class="fas fa-step-forward" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Center: Progress indicator -->
  <div class="controls-section progress">
    <span class="progress-text" class:disabled={controlsDisabled}>
      {currentStep + 1} / {totalSteps || '--'}
    </span>

    {#if showSeekGestures && !compact}
      <span class="swipe-hint" class:hidden={controlsDisabled}>
        <i class="fas fa-hand-pointer" aria-hidden="true"></i>
        Swipe to seek
      </span>
    {/if}
  </div>

  <!-- Speed selector -->
  {#if showSpeed}
    <div class="controls-section speed">
      {#if !compact}
        <span class="section-label">Speed</span>
      {/if}
      <div class="speed-presets">
        {#each speedPresets as preset}
          <button
            class="speed-btn"
            class:active={Math.abs(speed - preset) < 0.01}
            onclick={() => handleSpeedChange(preset)}
            disabled={controlsDisabled}
            aria-label="Speed {preset}x"
          >
            {preset}x
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Loop toggle -->
  {#if showLoop}
    <div class="controls-section loop">
      <button
        class="control-btn loop-btn"
        class:active={loop}
        onclick={handleLoopToggle}
        disabled={controlsDisabled}
        aria-label={loop ? 'Disable loop' : 'Enable loop'}
      >
        <i class="fas fa-repeat" aria-hidden="true"></i>
        {#if !compact}
          <span class="btn-label">Loop</span>
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .sync-playback-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    touch-action: pan-y; /* Allow vertical scroll, handle horizontal ourselves */
    user-select: none;
    -webkit-user-select: none;
  }

  .sync-playback-controls.swiping {
    touch-action: none; /* Prevent scrolling while swiping */
  }

  .sync-playback-controls.compact {
    padding: 0.5rem 0.75rem;
    gap: 0.75rem;
  }

  .controls-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .transport {
    gap: 0.25rem;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-right: 0.25rem;
  }

  /* Base button styles - 48px minimum touch target */
  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 48px;
    min-height: 48px;
    padding: 0 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  /* Reduced motion - disable transitions */
  .reduced-motion .control-btn,
  .reduced-motion .speed-btn {
    transition: none;
  }

  .control-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .control-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .reduced-motion .control-btn:active:not(:disabled),
  .reduced-motion .speed-btn:active:not(:disabled) {
    transform: none;
    opacity: 0.8;
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Play/Pause button - accent colored */
  .play-pause-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-accent, #8b5cf6);
    font-size: 1.1rem;
  }

  .play-pause-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #ffffff);
  }

  /* Step buttons */
  .step-btn {
    min-width: 48px;
    padding: 0;
    font-size: 0.9rem;
  }

  /* Loop button active state */
  .loop-btn.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
    color: rgba(34, 211, 238, 1);
  }

  .btn-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  /* Progress indicator */
  .progress {
    flex-direction: column;
    gap: 0.25rem;
  }

  .progress-text {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
    padding: 0 0.5rem;
  }

  .progress-text.disabled {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .swipe-hint {
    font-size: var(--font-size-xs, 11px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .swipe-hint.hidden {
    display: none;
  }

  .swipe-hint i {
    font-size: 10px;
  }

  /* Speed presets */
  .speed-presets {
    display: flex;
    gap: 0.25rem;
  }

  /* Speed buttons - 48px minimum touch target */
  .speed-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 0 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .speed-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .speed-btn.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-accent, #8b5cf6);
    font-weight: 600;
  }

  .speed-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .speed-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Compact mode adjustments */
  .compact .section-label {
    display: none;
  }

  .compact .btn-label {
    display: none;
  }

  .compact .progress-text {
    font-size: var(--font-size-compact, 12px);
  }

  .compact .swipe-hint {
    display: none;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .sync-playback-controls {
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
    }

    .section-label {
      display: none;
    }

    .btn-label {
      display: none;
    }

    .speed-presets {
      gap: 0.2rem;
    }

    .speed-btn {
      font-size: var(--font-size-compact, 12px);
      /* Keep 48px touch target on mobile */
      min-width: 48px;
      min-height: 48px;
    }
  }

  /* Extra small screens */
  @media (max-width: 480px) {
    .sync-playback-controls {
      padding: 0.5rem;
    }

    .controls-section.speed {
      order: 10;
      width: 100%;
      justify-content: center;
      padding-top: 0.5rem;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .progress {
      flex-direction: row;
    }

    .swipe-hint {
      display: none;
    }
  }
</style>
