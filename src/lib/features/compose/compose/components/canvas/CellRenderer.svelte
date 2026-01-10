<script lang="ts">
  /**
   * CellRenderer - Unified renderer for composition cells
   *
   * Handles both single and tunnel cell types.
   * Renders the animation within a grid cell using the animation engine.
   */

  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { container } from "$lib/shared/di";
  import type { CellConfig } from "../../domain/types";
  import type { IAnimationPlaybackController } from "../../../services/contracts/IAnimationPlaybackController";
  import { createAnimationPanelState } from "../../../state/animation-panel-state.svelte";

  interface Props {
    cell: CellConfig;
    isPlaying: boolean;
    isPreviewing: boolean;
    bpm?: number;
  }

  let { cell, isPlaying, isPreviewing, bpm = 60 }: Props = $props();

  // Convert BPM to speed multiplier (60 BPM = 1.0x speed)
  const speed = $derived(bpm / 60);

  // Animation state per cell
  const animationState = createAnimationPanelState();

  // Services - must be $state for reactive effects to track them
  let playbackController = $state<IAnimationPlaybackController | null>(null);
  let initialized = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Get primary sequence for rendering
  const primarySequence = $derived(cell.sequences[0] ?? null);
  const hasSequence = $derived(cell.sequences.length > 0);

  // Initialize services on mount
  onMount(() => {
    try {
      loading = true;

      playbackController = container.items
        .animationPlaybackController as IAnimationPlaybackController;

      initialized = true;
      loading = false;

      // Initialize with sequence if available
      if (primarySequence) {
        initializeAnimation();
      }
    } catch (err) {
      console.error(`❌ CellRenderer [${cell.id}] init failed:`, err);
      error = "Failed to initialize animation";
      loading = false;
    }
  });

  // Re-initialize when sequence changes
  $effect(() => {
    if (initialized && primarySequence) {
      initializeAnimation();
    }
  });

  // Sync playback state
  $effect(() => {
    if (!playbackController || !animationState.sequenceData) return;

    if (isPlaying !== animationState.isPlaying) {
      playbackController.togglePlayback();
    }
  });

  // Sync speed
  $effect(() => {
    if (playbackController && animationState.sequenceData) {
      playbackController.setSpeed(speed);
    }
  });

  async function initializeAnimation() {
    if (!primarySequence || !playbackController) return;

    try {
      const success = playbackController.initialize(
        primarySequence,
        animationState
      );

      if (!success) {
        throw new Error("Failed to initialize animation");
      }

      // Apply rotation if set
      if (cell.rotationOffset && cell.rotationOffset !== 0) {
        // TODO: Apply rotation to the animation canvas
      }

      // Auto-start if previewing
      if (isPreviewing) {
        animationState.setIsPlaying(true);
      }
    } catch (err) {
      console.error(`❌ CellRenderer [${cell.id}] animation init failed:`, err);
      error = err instanceof Error ? err.message : "Animation failed";
    }
  }

  // Current beat data derived from animation state
  const currentBeatData = $derived.by(() => {
    if (!animationState.sequenceData) return null;

    const currentBeat = animationState.currentBeat;

    // Handle start position case explicitly
    if (
      currentBeat === 0 &&
      !animationState.isPlaying &&
      animationState.sequenceData.startPosition
    ) {
      return animationState.sequenceData.startPosition;
    }

    // For beats, use direct indexing with clamping
    // currentBeat is 1-based: currentBeat 1.0-2.0 = beat 1 (uses beats[0])
    if (
      animationState.sequenceData.beats &&
      animationState.sequenceData.beats.length > 0
    ) {
      const beatIndex = Math.max(0, Math.floor(currentBeat) - 1);
      const clampedIndex = Math.min(
        beatIndex,
        animationState.sequenceData.beats.length - 1
      );
      return animationState.sequenceData.beats[clampedIndex] || null;
    }

    return null;
  });

  // Current letter derived from beat data
  const currentLetter = $derived.by(() => {
    return currentBeatData?.letter || null;
  });

  onDestroy(() => {
    // Cleanup animation state effects
    animationState.dispose();
  });
</script>

<div
  class="cell-renderer"
  class:tunnel={cell.type === "tunnel"}
  style:--rotation="{cell.rotationOffset ?? 0}deg"
>
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{error}</span>
    </div>
  {:else if hasSequence && animationState.sequenceData}
    <!-- Animation Canvas -->
    <div class="canvas-container" style:transform="rotate(var(--rotation))">
      <AnimatorCanvas
        blueProp={animationState.bluePropState}
        redProp={animationState.redPropState}
        gridVisible={true}
        gridMode={animationState.sequenceData.gridMode ?? null}
        letter={currentLetter}
        beatData={currentBeatData}
        currentBeat={animationState.currentBeat}
        sequenceData={animationState.sequenceData}
      />
    </div>

    <!-- Tunnel overlay layers (for tunnel mode) -->
    {#if cell.type === "tunnel" && cell.sequences.length > 1}
      <div class="tunnel-overlay-hint">
        <span>+{cell.sequences.length - 1} layers</span>
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <i class="fas fa-film" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .cell-renderer {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: transparent;
    container-type: size;
    container-name: renderer;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
  }

  /* Ensure AnimatorCanvas fills container properly */
  .canvas-container :global(.canvas-wrapper) {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    width: clamp(16px, 15cqi, 32px);
    height: clamp(16px, 15cqi, 32px);
    border: clamp(2px, 1cqi, 4px) solid var(--theme-stroke);
    border-top-color: rgba(236, 72, 153, 0.8);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 2cqi, 6px);
    color: rgba(239, 68, 68, 0.8);
    font-size: clamp(0.55rem, 4cqi, 0.85rem);
    text-align: center;
    padding: clamp(4px, 3cqi, 12px);
  }

  .error-state i {
    font-size: clamp(0.8rem, 8cqi, 1.5rem);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4); /* Improved contrast for WCAG AAA */
    font-size: clamp(1rem, 12cqi, 2.5rem);
  }

  /* Tunnel mode indicator */
  .tunnel-overlay-hint {
    position: absolute;
    bottom: clamp(2px, 2cqi, 6px);
    right: clamp(2px, 2cqi, 6px);
    padding: clamp(1px, 1cqi, 4px) clamp(3px, 2cqi, 8px);
    background: rgba(0, 0, 0, 0.6);
    border-radius: clamp(2px, 1cqi, 6px);
    font-size: clamp(0.5rem, 3cqi, 0.75rem);
    color: var(--theme-text-dim);
    pointer-events: none;
  }

  /* Tunnel mode styling */
  .cell-renderer.tunnel {
    background: linear-gradient(
      135deg,
      rgba(60, 40, 80, 0.3) 0%,
      rgba(40, 30, 60, 0.3) 100%
    );
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .canvas-container {
      transition: none;
    }
  }
</style>
