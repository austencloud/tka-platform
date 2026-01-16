<!--
  AnimationPreviewWithPlayback.svelte

  Self-contained animation preview that loads a real B sequence and applies
  a 1,1 turn pattern to create visible trails during playback.

  Uses proper infrastructure:
  - DiscoverLoader to load valid sequence data
  - TurnPatternManager to apply turn modifications
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type { IDiscoverLoader } from "$lib/features/discover/gallery/display/services/contracts/IDiscoverLoader";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  // TurnPatternManager is loaded dynamically to avoid pulling in entire Create module at startup
  import type { TurnPattern } from "$lib/features/create/shared/domain/models/TurnPatternData";
  import { Timestamp } from "firebase/firestore";

  // Animation state - created once per component instance
  const animationState = createAnimationPanelState();
  const visibilityManager = getAnimationVisibilityManager();

  // Reactive visibility state
  let gridVisible = $state(visibilityManager.isGridVisible());

  // Services
  let playbackController: IAnimationPlaybackController | null = null;
  let discoverLoader: IDiscoverLoader | null = null;

  // Component state
  let loading = $state(true);
  let error = $state<string | null>(null);
  let sequenceData = $state<SequenceData | null>(null);

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

  // Derived: Current beat data for AnimatorCanvas
  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;

    const currentStep = animationState.currentStep;

    // Handle start position case (beat 0)
    if (
      currentStep === 0 &&
      !animationState.isPlaying &&
      animationState.sequenceData.startPosition
    ) {
      return animationState.sequenceData.startPosition;
    }

    // For steps, use direct indexing with clamping
    // Beat indexing: steps[0] = beat 1, steps[1] = beat 2, etc.
    // currentStep semantics: beat N's motion spans from N.0 to (N+1).0
    if (
      animationState.sequenceData.steps &&
      animationState.sequenceData.steps.length > 0
    ) {
      // Formula: ceil(currentStep - 1) gives the beat number whose motion is/was playing
      // - At 3.0 (pause after beat 2): ceil(2.0) = 2, shows beat 2
      const stepNumber = Math.ceil(currentStep - 1);
      const stepIndex = Math.max(0, stepNumber - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationState.sequenceData.steps.length - 1
      );
      return animationState.sequenceData.steps[clampedIndex] || null;
    }

    return null;
  });

  // Derived: Current letter
  let currentLetter = $derived.by(() => {
    return currentStepData?.letter || null;
  });

  onMount(() => {
    // Initialize with current settings from visibility manager
    animationState.setPlaybackMode(visibilityManager.getPlaybackMode());
    animationState.setSpeed(visibilityManager.getSpeed());

    initializeAnimation();

    // Subscribe to visibility changes (including playback mode and speed)
    const handleVisibilityChange = () => {
      gridVisible = visibilityManager.isGridVisible();

      // Sync playback mode from visibility manager
      const newMode = visibilityManager.getPlaybackMode();
      if (animationState.playbackMode !== newMode) {
        const wasPlaying = animationState.isPlaying;

        // If playing, stop first then change mode and restart
        if (wasPlaying && playbackController) {
          playbackController.togglePlayback(); // Stop
        }

        animationState.setPlaybackMode(newMode);

        // Restart with new mode if was playing
        if (wasPlaying && playbackController) {
          playbackController.togglePlayback(); // Start with new mode
        }
      }

      // Sync speed from visibility manager
      const newSpeed = visibilityManager.getSpeed();
      if (animationState.speed !== newSpeed) {
        playbackController?.setSpeed(newSpeed);
      }
    };
    visibilityManager.registerObserver(handleVisibilityChange);

    return () => {
      // Clean up on unmount
      playbackController?.dispose();
      animationState.dispose();
      visibilityManager.unregisterObserver(handleVisibilityChange);
    };
  });

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
        console.error("Failed to apply turn pattern:", result.error);
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
      // Speed is set from visibility manager in onMount

      loading = false;

      // Auto-start playback after a short delay
      setTimeout(() => {
        if (playbackController && animationState.sequenceData) {
          playbackController.togglePlayback();
        }
      }, 100);
    } catch (err) {
      console.error("Failed to initialize animation preview:", err);
      error = err instanceof Error ? err.message : "Failed to load animation";
      loading = false;
    }
  }
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
  <AnimatorCanvas
    blueProp={animationState.bluePropState}
    redProp={animationState.redPropState}
    {gridVisible}
    gridMode={animationState.sequenceData?.gridMode ?? null}
    letter={currentLetter}
    stepData={currentStepData}
    currentStep={animationState.currentStep}
    sequenceData={animationState.sequenceData}
    trailSettings={animationSettings.trail}
  />
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
    border: 3px solid rgba(244, 114, 182, 0.2);
    border-top-color: #f472b6;
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
