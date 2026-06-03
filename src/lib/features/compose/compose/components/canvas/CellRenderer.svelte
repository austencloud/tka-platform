<script lang="ts">
  /**
   * CellRenderer - Unified renderer for composition cells
   *
   * Supports:
   * - Single mode: One sequence per cell
   * - Tunnel mode: Up to 4 sequences overlaid (additional layer textures auto-loaded by AnimationEngine)
   * - Rotation: CSS transform for 0°, 90°, 180°, 270°
   * - Mirroring: CSS scaleX(-1) for horizontal flip
   * - Synchronized playback via shared currentStep from composition state
   */

  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { CellConfig } from "$lib/shared/animation-engine/domain/compose-types";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createPlaybackControllerFactory } from "$lib/shared/animation-engine/create-playback-controller-factory";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/services/trail-capturer";
  interface Props {
    cell: CellConfig;
    isPlaying: boolean;
    isPreviewing: boolean;
    bpm?: number;
    currentStep?: number;
  }

  let { cell, isPlaying, isPreviewing, bpm = 60, currentStep = 0 }: Props = $props();

  // Convert BPM to speed multiplier (60 BPM = 1.0x speed)
  const speed = $derived(bpm / 60);

  // Animation states - one per sequence (up to 2 for now)
  // MUST be $state for reactivity when sequences are added/removed after mount
  let animationStates = $state<ReturnType<typeof createAnimationPanelState>[]>([]);
  let playbackControllers = $state<AnimationPlaybackController[]>([]);

  let initialized = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Track sequence IDs to detect actual sequence changes vs prop updates
  let lastSequenceIds: string[] = [];

  // Get sequences for rendering
  const sequences = $derived(cell.sequences);
  const hasSequence = $derived(sequences.length > 0);
  // Tunnel mode: 2+ sequences (auto-derived from sequence count)
  const isTunnel = $derived(sequences.length >= 2);
  const sequenceCount = $derived(sequences.length);

  // CSS transform for rotation and mirroring
  const transform = $derived.by(() => {
    const parts: string[] = [];

    if (cell.rotationOffset && cell.rotationOffset !== 0) {
      parts.push(`rotate(${cell.rotationOffset}deg)`);
    }

    if (cell.isMirrored) {
      parts.push("scaleX(-1)");
    }

    return parts.length > 0 ? parts.join(" ") : "none";
  });

  // Initialize animation states and controllers
  function initializeStates(count: number) {
    // Clean up existing states
    for (const state of animationStates) {
      state.dispose();
    }
    animationStates = [];
    playbackControllers = [];

    // Create new states for each sequence
    // Use factory to get fresh controller instances (required for tunnel mode)
    for (let i = 0; i < count; i++) {
      const state = createAnimationPanelState();
      // Each sequence needs its own controller with independent state
      const controller = createPlaybackControllerFactory();
      animationStates.push(state);
      playbackControllers.push(controller);
    }
  }

  // Initialize animation for a specific sequence index
  function initializeSequence(seq: SequenceData, index: number) {
    if (!playbackControllers[index] || !animationStates[index]) return false;

    try {
      const success = playbackControllers[index].initialize(seq, animationStates[index]);
      if (!success) {
        console.warn(`Failed to initialize sequence ${index} for cell ${cell.id}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Error initializing sequence ${index}:`, err);
      return false;
    }
  }

  // Get current sequence IDs for change detection
  function getSequenceIds(): string[] {
    return sequences.map(seq => seq.id || seq.word || seq.name || "unknown");
  }

  // Check if sequences actually changed
  function sequencesChanged(): boolean {
    const currentIds = getSequenceIds();
    if (currentIds.length !== lastSequenceIds.length) return true;
    return currentIds.some((id, i) => id !== lastSequenceIds[i]);
  }

  // Initialize services on mount
  onMount(() => {
    try {
      loading = true;

      // Initialize states for current sequences (up to 2 for tunnel mode)
      initializeStates(Math.min(2, Math.max(1, sequences.length)));

      // Initialize each sequence
      sequences.slice(0, 2).forEach((seq, i) => {
        initializeSequence(seq, i);
      });

      lastSequenceIds = getSequenceIds();
      initialized = true;
      loading = false;
    } catch (err) {
      console.error(`❌ CellRenderer [${cell.id}] init failed:`, err);
      error = "Failed to initialize animation";
      loading = false;
    }
  });

  // Handle sequence changes (add/remove/reorder)
  $effect(() => {
    if (!initialized) return;

    // Read sequences to establish dependency
    const seqCount = sequences.length;

    // Check if sequences actually changed (not just prop type changes)
    if (sequencesChanged()) {
      // Reinitialize with new sequence count (up to 2 for tunnel mode)
      initializeStates(Math.min(2, Math.max(1, seqCount)));

      sequences.slice(0, 2).forEach((seq, i) => {
        initializeSequence(seq, i);
      });

      lastSequenceIds = getSequenceIds();
    }
  });

  // Sync currentStep from composition state to all animation states
  // This is the key synchronization - all cells share the same beat position
  // CRITICAL: Also recalculate prop states via the playback controller
  $effect(() => {
    for (let i = 0; i < animationStates.length; i++) {
      const state = animationStates[i];
      const controller = playbackControllers[i];
      if (state?.sequenceData && controller) {
        state.setCurrentStep(currentStep);
        // Recalculate prop positions for this beat
        controller.calculateStateForStep(currentStep);
      }
    }
  });

  // Sync isPlaying state to animation states (for preview mode)
  $effect(() => {
    const shouldPlay = isPlaying || isPreviewing;
    for (const state of animationStates) {
      if (state.sequenceData && state.isPlaying !== shouldPlay) {
        state.setIsPlaying(shouldPlay);
      }
    }
  });

  // Sync speed to all playback controllers
  $effect(() => {
    for (const controller of playbackControllers) {
      controller.setSpeed(speed);
    }
  });

  // Get step data for a specific sequence at current beat
  function getStepDataForSequence(seq: SequenceData | null, stepPosition: number) {
    if (!seq) return null;

    // Handle start position (step 0)
    if (stepPosition === 0 && seq.startPosition) {
      return seq.startPosition;
    }

    // Get step data (step 1 = steps[0], etc.)
    if (seq.steps && seq.steps.length > 0) {
      const stepIndex = Math.max(0, Math.floor(stepPosition) - 1);
      const clampedIndex = Math.min(stepIndex, seq.steps.length - 1);
      return seq.steps[clampedIndex] || null;
    }

    return null;
  }

  // Derived: Primary animation state (always index 0)
  const primaryState = $derived(animationStates[0] ?? null);
  const primaryStepData = $derived(
    primaryState?.sequenceData
      ? getStepDataForSequence(primaryState.sequenceData, currentStep)
      : null
  );
  const primaryLetter = $derived(primaryStepData?.letter ?? null);

  // Derived: Additional layer props for tunnel mode (all states beyond primary)
  const additionalLayerProps = $derived.by((): AdditionalLayerProps[] => {
    return animationStates.slice(1).map((state) => ({
      blueProp: state.bluePropState,
      redProp: state.redPropState,
    }));
  });

  // Cleanup on destroy
  onDestroy(() => {
    for (const state of animationStates) {
      state.dispose();
    }
    animationStates = [];
    playbackControllers = [];
  });

  // Layer opacity for 3-4 sequence tunnel mode
  function getLayerOpacity(index: number, total: number): number {
    if (total <= 2) return 1;
    // Decrease opacity for each layer: 1.0, 0.85, 0.70, 0.55
    return 1 - index * 0.15;
  }
</script>

<div
  class="cell-renderer"
  class:tunnel={isTunnel}
  class:mirrored={cell.isMirrored}
>
  {#if loading}
    <div class="loading-state">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{error}</span>
    </div>
  {:else if hasSequence && primaryState?.sequenceData}
    <!-- Canvas container with rotation/mirroring transforms -->
    <div class="canvas-container" style:transform={transform}>
      {#if isTunnel && sequenceCount > 2}
        <!-- 3-4 sequence tunnel: Layer multiple AnimatorCanvas components -->
        {#each animationStates as state, i (i)}
          {#if state?.sequenceData}
            <div
              class="tunnel-layer"
              style:opacity={getLayerOpacity(i, sequenceCount)}
              style:z-index={sequenceCount - i}
            >
              <AnimatorCanvas
                blueProp={state.bluePropState}
                redProp={state.redPropState}
                gridVisible={i === 0}
                gridMode={state.sequenceData.gridMode ?? null}
                letter={i === 0 ? primaryLetter : null}
                stepData={i === 0 ? primaryStepData : getStepDataForSequence(state.sequenceData, currentStep)}
                currentStep={currentStep}
                sequenceData={state.sequenceData}
              />
            </div>
          {/if}
        {/each}
      {:else if isTunnel && sequenceCount >= 2 && additionalLayerProps.length > 0}
        <!-- Multi-sequence tunnel: Use additionalLayers on single canvas -->
        <!-- Hide glyph/beat overlays - combined motions don't form a TKA letter -->
        <AnimatorCanvas
          blueProp={primaryState.bluePropState}
          redProp={primaryState.redPropState}
          additionalLayers={additionalLayerProps}
          gridVisible={true}
          gridMode={primaryState.sequenceData.gridMode ?? null}
          letter={null}
          stepData={primaryStepData}
          currentStep={currentStep}
          sequenceData={primaryState.sequenceData}
          hideTkaGlyph={true}
          hideStepNumbers={true}
        />
      {:else}
        <!-- Single sequence (or tunnel with 1 sequence) -->
        <AnimatorCanvas
          blueProp={primaryState.bluePropState}
          redProp={primaryState.redPropState}
          gridVisible={true}
          gridMode={primaryState.sequenceData.gridMode ?? null}
          letter={primaryLetter}
          stepData={primaryStepData}
          currentStep={currentStep}
          sequenceData={primaryState.sequenceData}
        />
      {/if}
    </div>

    <!-- Tunnel overlay info (shows sequence count) -->
    {#if isTunnel && sequenceCount > 1}
      <div class="tunnel-info-badge">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        <span>{sequenceCount} layers</span>
      </div>
    {/if}

    <!-- Rotation indicator -->
    {#if cell.rotationOffset && cell.rotationOffset !== 0}
      <div class="rotation-badge">
        <i class="fas fa-redo" aria-hidden="true"></i>
        <span>{cell.rotationOffset}°</span>
      </div>
    {/if}

    <!-- Mirror indicator -->
    {#if cell.isMirrored}
      <div class="mirror-badge">
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
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
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--duration-emphasis) ease;
  }

  /* Ensure AnimatorCanvas fills container properly */
  .canvas-container :global(.animation-container) {
    width: 100%;
    height: 100%;
  }

  /* Tunnel layer stacking */
  .tunnel-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tunnel-layer :global(.animation-container) {
    width: 100%;
    height: 100%;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 2cqi, 6px);
    color: var(--semantic-error, #ef4444);
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: clamp(1rem, 12cqi, 2.5rem);
  }

  /* Info badges - positioned in corners */
  .tunnel-info-badge,
  .rotation-badge,
  .mirror-badge {
    position: absolute;
    display: flex;
    align-items: center;
    gap: clamp(2px, 1cqi, 4px);
    padding: clamp(2px, 1cqi, 4px) clamp(4px, 2cqi, 8px);
    background: rgba(0, 0, 0, 0.7);
    border-radius: clamp(2px, 1cqi, 6px);
    font-size: clamp(0.5rem, 3cqi, 0.7rem);
    color: var(--theme-text, white);
    pointer-events: none;
    z-index: 10;
  }

  .tunnel-info-badge {
    bottom: clamp(2px, 2cqi, 8px);
    right: clamp(2px, 2cqi, 8px);
    background: rgba(139, 92, 246, 0.8);
  }

  .rotation-badge {
    top: clamp(2px, 2cqi, 8px);
    right: clamp(2px, 2cqi, 8px);
    background: rgba(245, 158, 11, 0.8);
  }

  .mirror-badge {
    top: clamp(2px, 2cqi, 8px);
    left: clamp(2px, 2cqi, 8px);
    background: rgba(59, 130, 246, 0.8);
  }

  /* Tunnel mode styling */
  .cell-renderer.tunnel {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.1) 0%,
      rgba(59, 130, 246, 0.1) 100%
    );
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .canvas-container {
      transition: none;
    }
  }
</style>
