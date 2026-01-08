<!--
  InlineAnimationPlayer.svelte

  Lightweight animation player for inline use in gallery detail panels.
  Does not require Create module context - fully standalone.

  Uses the shared animation engine with BPM preset controls.
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { resolve, loadFeatureModule } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";

  // BPM/Speed conversion constant
  const DEFAULT_BPM = 60;

  /**
   * Get the Greek letter (α, β, γ) for the start position phase.
   * Uses the sequence prop which has startingPositionGroup preserved.
   */
  function getStartPositionLetter(): Letter | null {
    // Use sequence prop - it has startingPositionGroup preserved
    // (animationState.sequenceData loses this field during processing)
    const seq = sequence;
    if (!seq) return null;

    // 1. Derive from startingPositionGroup (most reliable)
    if (seq.startingPositionGroup) {
      const group = seq.startingPositionGroup.toLowerCase();
      if (group === "alpha") return Letter.ALPHA;
      if (group === "beta") return Letter.BETA;
      if (group === "gamma") return Letter.GAMMA;
    }

    // 2. Check if startPosition.letter is already a valid Greek letter
    const spLetter = seq.startPosition?.letter;
    if (
      spLetter === Letter.ALPHA ||
      spLetter === Letter.BETA ||
      spLetter === Letter.GAMMA
    ) {
      return spLetter;
    }

    // 3. Derive from first beat's startPosition field (GridPosition like "alpha1")
    const firstBeat = seq.beats?.[0];
    if (firstBeat) {
      const startPos = firstBeat.startPosition || (firstBeat as any).startPos;
      if (startPos && typeof startPos === "string") {
        const posLower = startPos.toLowerCase();
        if (posLower.startsWith("alpha")) return Letter.ALPHA;
        if (posLower.startsWith("beta")) return Letter.BETA;
        if (posLower.startsWith("gamma")) return Letter.GAMMA;
      }
    }

    return null;
  }

  let {
    sequence,
    autoPlay = true,
    showControls = true,
  }: {
    sequence: SequenceData;
    autoPlay?: boolean;
    showControls?: boolean;
  } = $props();

  // Services
  let sequenceService: ISequenceRepository | null = null;
  let playbackController: IAnimationPlaybackController | null = null;
  let servicesReady = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Animation state
  const animationState = createAnimationPanelState();

  // Track last loaded sequence to prevent re-loading same sequence
  // Also prevents remounts during prop type changes (hot-swap handles those)
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state for UI
  let isPlaying = $state(false);
  let bpm = $state(DEFAULT_BPM); // 60 BPM = 1.0x speed

  // Sync playing state from animation state
  $effect(() => {
    const checkPlaying = () => {
      const current = animationState.isPlaying;
      if (current !== isPlaying) {
        isPlaying = current;
      }
    };
    checkPlaying();
    const interval = setInterval(checkPlaying, 50);
    return () => clearInterval(interval);
  });

  // Derived state for canvas
  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentBeat = animationState.currentBeat;

    // At start position phase (before beat 1) - show Greek letter (α, β, γ)
    if (currentBeat < 1) {
      return getStartPositionLetter();
    }

    if (animationState.sequenceData.beats?.length > 0) {
      // currentBeat is 1-based: currentBeat 1.0-2.0 = beat 1 (uses beats[0])
      const beatIndex = Math.max(0, Math.floor(currentBeat) - 1);
      const clampedIndex = Math.min(
        beatIndex,
        animationState.sequenceData.beats.length - 1
      );
      return animationState.sequenceData.beats[clampedIndex]?.letter || null;
    }

    return null;
  });

  let currentBeatData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentBeat = animationState.currentBeat;

    if (currentBeat < 1 && animationState.sequenceData.startPosition) {
      return animationState.sequenceData.startPosition;
    }

    if (animationState.sequenceData.beats?.length > 0) {
      // currentBeat is 1-based: currentBeat 1.0-2.0 = beat 1 (uses beats[0])
      const beatIndex = Math.max(0, Math.floor(currentBeat) - 1);
      const clampedIndex = Math.min(
        beatIndex,
        animationState.sequenceData.beats.length - 1
      );
      return animationState.sequenceData.beats[clampedIndex] || null;
    }

    return null;
  });

  // Prefer sequence prop's gridMode (always current) over animation state (may be stale during switch)
  let gridMode = $derived(
    sequence?.gridMode ?? animationState.sequenceData?.gridMode
  );

  // Load services on mount
  onMount(async () => {
    try {
      // Load animator module
      await loadFeatureModule("animate");

      sequenceService = resolve<ISequenceRepository>(TYPES.ISequenceRepository);
      playbackController = resolve<IAnimationPlaybackController>(
        TYPES.IAnimationPlaybackController
      );
      servicesReady = true;
    } catch (err) {
      console.error("Failed to initialize animation player:", err);
      error = "Failed to load animation";
      loading = false;
    }
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  // Watch for sequence changes and reload animation
  // Only triggers when sequence ID changes, not on every state update
  $effect(() => {
    const sequenceId = sequence?.id || sequence?.word || sequence?.name;

    if (sequence && servicesReady && sequenceId !== lastLoadedSequenceId) {
      // Use untrack to avoid creating dependency on isPlaying
      untrack(() => {
        // Stop any currently playing animation
        if (animationState.isPlaying) {
          playbackController?.togglePlayback();
        }
        // Reset state and reload
        animationState.reset();
        lastLoadedSequenceId = sequenceId ?? null;
        loadAnimation(autoPlay);
      });
    }
  });

  async function loadAnimation(shouldAutoPlay: boolean = false) {
    if (!sequenceService || !playbackController || !sequence) return;

    loading = true;
    error = null;

    try {
      // Load full sequence data if needed
      const fullSequence = await loadSequenceData(sequence);

      if (!fullSequence) {
        throw new Error("Failed to load sequence data");
      }

      // Initialize playback
      animationState.setShouldLoop(true);
      const success = playbackController.initialize(
        fullSequence,
        animationState
      );

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      // Note: playbackController.initialize() already sets normalized sequence data on the state

      // Auto-start only if explicitly requested (initial load with autoPlay prop)
      if (shouldAutoPlay) {
        setTimeout(() => {
          playbackController?.togglePlayback();
        }, 300);
      }
    } catch (err) {
      console.error("Failed to load animation:", err);
      error = err instanceof Error ? err.message : "Failed to load animation";
    } finally {
      loading = false;
    }
  }

  async function loadSequenceData(
    seq: SequenceData
  ): Promise<SequenceData | null> {
    if (!sequenceService) return null;

    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.beats) &&
      s.beats.length > 0 &&
      s.beats.some((beat) => beat?.motions?.blue && beat?.motions?.red);

    if (hasMotionData(seq)) {
      return seq;
    }

    // Try to load from gallery
    const identifier = seq.word || seq.name || seq.id;
    if (identifier) {
      const loaded = await sequenceService.getSequence(identifier);
      if (loaded && hasMotionData(loaded)) {
        return loaded;
      }
    }

    return seq;
  }

  function togglePlayback() {
    playbackController?.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
    const speed = newBpm / DEFAULT_BPM;
    playbackController?.setSpeed(speed);
  }
</script>

<div class="inline-animation-player">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading animation...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <span>{error}</span>
      <button class="retry-btn" onclick={() => loadAnimation()}>Retry</button>
    </div>
  {:else}
    <!-- Animation Canvas -->
    <div class="canvas-container">
      <AnimatorCanvas
        blueProp={animationState.bluePropState}
        redProp={animationState.redPropState}
        gridVisible={true}
        {gridMode}
        letter={currentLetter}
        beatData={currentBeatData}
        sequenceData={animationState.sequenceData}
        {isPlaying}
        onPlaybackToggle={togglePlayback}
        trailSettings={animationSettings.trail}
      />
    </div>

    <!-- Controls (optional) -->
    {#if showControls}
      <div class="controls">
        <button
          class="control-btn play-btn"
          onclick={togglePlayback}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {#if isPlaying}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          {/if}
        </button>

        <div class="bpm-controls">
          <BpmChips {bpm} variant="compact" onBpmChange={handleBpmChange} />
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .inline-animation-player {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 8px;
  }

  .canvas-container {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .control-btn svg {
    width: 20px;
    height: 20px;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .play-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: linear-gradient(135deg, var(--semantic-info) 0%, #2563eb 100%);
    border-color: transparent;
  }

  .play-btn:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }

  .bpm-controls {
    flex: 1;
    min-width: 0;
  }

  /* ===========================================
     WIDE LANDSCAPE LAYOUT (e.g., unfolded Z-Fold)
     Switch to side-by-side: canvas left, controls right
     =========================================== */
  @media (orientation: landscape) and (min-width: 600px) and (min-height: 400px) {
    .inline-animation-player {
      flex-direction: row;
      gap: 12px;
    }

    .canvas-container {
      flex: 1;
      min-width: 0;
      border-radius: 12px;
    }

    .controls {
      flex-direction: column;
      width: 140px;
      flex-shrink: 0;
      padding: 12px;
      border-radius: 12px;
      gap: 12px;
      justify-content: flex-start;
      align-items: stretch;
    }

    .control-btn.play-btn {
      width: 100%;
      height: 48px;
      border-radius: 10px;
    }

    .bpm-controls {
      flex: none;
      width: 100%;
    }

    /* Stack BPM chips vertically in sidebar */
    .bpm-controls :global(.bpm-chips.compact) {
      flex-wrap: wrap;
      gap: 6px;
    }

    .bpm-controls :global(.preset-chip) {
      flex: 1 1 calc(50% - 3px);
      min-width: 0;
      padding: 10px 4px;
    }

    /* Custom chip takes full width at bottom */
    .bpm-controls :global(.custom-chip) {
      flex: 1 1 100%;
      max-width: none;
    }
  }

  /* Extra wide screens (like tablets or larger foldables) - give controls more room */
  @media (orientation: landscape) and (min-width: 900px) and (min-height: 500px) {
    .controls {
      width: 160px;
    }
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    height: 100%;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: rgba(59, 130, 246, 0.8);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    color: rgba(252, 165, 165, 1);
  }

  .retry-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .control-btn,
    .retry-btn {
      transition: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>
