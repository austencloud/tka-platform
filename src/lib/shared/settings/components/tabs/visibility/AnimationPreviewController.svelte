<!--
  AnimationPreviewController.svelte

  Manages animation loading, state initialization, and sync with visibility manager.
  Renders AnimationPreviewCanvas with stable props to avoid infinite loops.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import * as turnPatternManager from "$lib/shared/create/services/turn-pattern-manager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { createPlaybackControllerFactory } from "$lib/shared/animation-engine/createPlaybackControllerFactory";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TurnPattern } from "$lib/shared/create/domain/TurnPatternData";
  import { Timestamp } from "firebase/firestore";
  import AnimationPreviewCanvas from "./AnimationPreviewCanvas.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  const animationState = createAnimationPanelState();
  const visibilityManager = getAnimationVisibilityManager();

  let playbackController: AnimationPlaybackController | null = null;
  let browseLoader: PublicSequencesLoader | null = null;

  let loading = $state(true);
  let error = $state<string | null>(null);
  let sequenceData = $state<SequenceData | null>(null);
  let gridVisible = $state(true);
  let gridModeStr = $state(visibilityManager.getGridMode());

  function createOneTurnPattern(stepCount: number): TurnPattern {
    const entries = [];
    for (let i = 0; i < stepCount; i++) {
      entries.push({
        stepIndex: i,
        blue: 1,
        red: 1,
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

      playbackController = createPlaybackControllerFactory();
      browseLoader = getBrowseLoader();

      await withRetry(() => browseLoader!.loadSequenceMetadata());

      const baseSequence = await withRetry(() =>
        browseLoader!.loadFullSequenceData("B")
      );

      if (!baseSequence) {
        throw new Error("Failed to load B sequence from database");
      }

      const turnPattern = createOneTurnPattern(baseSequence.steps.length);
      const result = turnPatternManager.applyPattern(turnPattern, baseSequence);

      if (!result.success || !result.sequence) {
        throw new Error(result.error || "Failed to apply turn pattern");
      }

      sequenceData = result.sequence;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const success = playbackController.initialize(
        result.sequence,
        animationState
      );

      if (!success) {
        throw new Error("Failed to initialize animation playback");
      }

      animationState.setShouldLoop(true);
      loading = false;

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

  onMount(() => {
    animationState.setPlaybackMode(visibilityManager.getPlaybackMode());
    animationState.setSpeed(visibilityManager.getSpeed());
    gridVisible = visibilityManager.isGridVisible();

    const visibilityObserver = () => {
      const newPlaybackMode = visibilityManager.getPlaybackMode();
      const newSpeed = visibilityManager.getSpeed();
      const newGridVisible = visibilityManager.isGridVisible();

      const playbackModeChanged = animationState.playbackMode !== newPlaybackMode;
      const speedChanged = animationState.speed !== newSpeed;
      const wasPlaying = animationState.isPlaying;

      if (playbackModeChanged) animationState.setPlaybackMode(newPlaybackMode);
      if (speedChanged) animationState.setSpeed(newSpeed);
      if (gridVisible !== newGridVisible) gridVisible = newGridVisible;
      gridModeStr = visibilityManager.getGridMode();

      if ((playbackModeChanged || speedChanged) && wasPlaying && playbackController) {
        playbackController.togglePlayback();
        playbackController.togglePlayback();
      }
    };
    visibilityManager.registerObserver(visibilityObserver);

    initializeAnimation();

    return () => {
      visibilityManager.unregisterObserver(visibilityObserver);
      playbackController?.dispose();
    };
  });
</script>

{#if loading}
  <div class="preview-loading">
    <ProgressRing percent={-1} size={24} strokeWidth={2} />
    <span>Loading preview...</span>
  </div>
{:else if error}
  <div class="preview-error">
    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
    <span>{error}</span>
  </div>
{:else if sequenceData}
  <AnimationPreviewCanvas {animationState} {gridVisible} {gridModeStr} />
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

  .preview-loading span,
  .preview-error span {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .preview-error i {
    font-size: 24px;
    color: var(--semantic-warning);
    opacity: 0.6;
  }
</style>
