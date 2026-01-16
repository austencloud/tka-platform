<!--
  AnimationPreviewController.svelte

  Manages animation loading, state initialization, and sync with visibility manager.
  Renders AnimationPreviewCanvas with stable props to avoid infinite loops.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  // TurnPatternManager is loaded dynamically to avoid pulling in entire Create module at startup
  import type { TurnPattern } from "$lib/features/create/shared/domain/models/TurnPatternData";
  import { Timestamp } from "firebase/firestore";
  import AnimationPreviewCanvas from "./AnimationPreviewCanvas.svelte";

  // Animation state - created once per component instance
  const animationState = createAnimationPanelState();
  const visibilityManager = getAnimationVisibilityManager();

  // Services
  let playbackController: IAnimationPlaybackController | null = null;
  let discoverLoader: IDiscoverLoader | null = null;

  // Component state
  let loading = $state(true);
  let error = $state<string | null>(null);
  let sequenceData = $state<SequenceData | null>(null);
  let gridVisible = $state(true);

  /**
   * Create a 1,1 turn pattern for a 4-beat sequence
   * This adds 1 turn to both blue and red motions on all steps
   */
  function createOneTurnPattern(stepCount: number): TurnPattern {
    const entries = [];
    for (let i = 0; i < stepCount; i++) {
      entries.push({
        stepIndex: i,
        blue: 1, // 1 turn for blue
        red: 1, // 1 turn for red
      });
    }

    return {
      id: "visibility-preview-1-1",
      name: "1,1 Pattern",
      userId: "system",
      createdAt: Timestamp.now(),
      stepCount,
      entries,
    };
  }

  /**
   * Retry helper for network requests
   */
  async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 500
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs * attempt));
        }
      }
    }
    throw lastError;
  }

  async function initializeAnimation() {
    try {
      loading = true;
      error = null;

      // Get services from container
      playbackController = container.items.animationPlaybackController as IAnimationPlaybackController;
      discoverLoader = container.items.discoverLoader as IDiscoverLoader;

      // Ensure sequence metadata is loaded (populates the cache) - with retry
      await withRetry(() => discoverLoader!.loadSequenceMetadata());

      // Load the base "B" sequence - with retry
      const baseSequence = await withRetry(() =>
        discoverLoader!.loadFullSequenceData("B")
      );

      if (!baseSequence) {
        throw new Error("Failed to load B sequence from database");
      }

      // Create and apply 1,1 turn pattern to get visible trails
      type ITurnPatternManager =
        import("$lib/features/create/shared/services/contracts/ITurnPatternManager").ITurnPatternManager;
      const turnPatternManager = container.items.turnPatternManager as ITurnPatternManager;
      const turnPattern = createOneTurnPattern(baseSequence.steps.length);
      const result = turnPatternManager.applyPattern(turnPattern, baseSequence);

      if (!result.success || !result.sequence) {
        console.error("❌ Failed to apply turn pattern:", result.error);
        throw new Error(result.error || "Failed to apply turn pattern");
      }

      const modifiedSequence = result.sequence;
      sequenceData = modifiedSequence;

      // Small delay to ensure UI is ready
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Initialize playback controller with the modified sequence
      const success = playbackController.initialize(
        modifiedSequence,
        animationState
      );

      if (!success) {
        throw new Error("Failed to initialize animation playback");
      }

      // Configure for looping preview
      animationState.setShouldLoop(true);

      loading = false;

      // Auto-start playback after a short delay
      setTimeout(() => {
        if (playbackController && animationState.sequenceData) {
          playbackController.togglePlayback();
        }
      }, 100);
    } catch (err) {
      console.error("❌ Failed to initialize animation preview:", err);
      error = err instanceof Error ? err.message : "Failed to load animation";
      loading = false;
    }
  }

  onMount(() => {
    // Initialize with current settings from visibility manager
    animationState.setPlaybackMode(visibilityManager.getPlaybackMode());
    animationState.setSpeed(visibilityManager.getSpeed());
    gridVisible = visibilityManager.isGridVisible();

    // Subscribe to visibility manager changes to update preview in real-time
    const visibilityObserver = () => {
      const newPlaybackMode = visibilityManager.getPlaybackMode();
      const newSpeed = visibilityManager.getSpeed();
      const newGridVisible = visibilityManager.isGridVisible();

      // Track if critical playback settings changed that require restart
      const playbackModeChanged =
        animationState.playbackMode !== newPlaybackMode;
      const speedChanged = animationState.speed !== newSpeed;
      const wasPlaying = animationState.isPlaying;

      // Update values
      if (playbackModeChanged) {
        animationState.setPlaybackMode(newPlaybackMode);
      }
      if (speedChanged) {
        animationState.setSpeed(newSpeed);
      }
      if (gridVisible !== newGridVisible) {
        gridVisible = newGridVisible;
      }

      // Restart playback if critical settings changed while playing
      if (
        (playbackModeChanged || speedChanged) &&
        wasPlaying &&
        playbackController
      ) {
        playbackController.togglePlayback(); // Stop
        playbackController.togglePlayback(); // Start with new settings
      }
    };
    visibilityManager.registerObserver(visibilityObserver);

    // Start initialization
    initializeAnimation();

    return () => {
      // Clean up on unmount
      visibilityManager.unregisterObserver(visibilityObserver);
      playbackController?.dispose();
    };
  });
</script>

{#if loading}
  <div class="preview-loading">
    <div class="spinner"></div>
    <span>Loading...</span>
  </div>
{:else if error}
  <div class="preview-error">
    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
    <span>{error}</span>
  </div>
{:else if sequenceData}
  <AnimationPreviewCanvas {animationState} {gridVisible} />
{:else}
  <div class="preview-error">
    <i class="fas fa-video-slash" aria-hidden="true"></i>
    <span>No sequence available</span>
  </div>
{/if}

<style>
  .preview-loading,
  .preview-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim);
  }

  .preview-loading .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .preview-loading span,
  .preview-error span {
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .preview-error i {
    font-size: var(--font-size-3xl);
    color: var(--semantic-warning, var(--semantic-warning));
    opacity: 0.6;
  }
</style>
