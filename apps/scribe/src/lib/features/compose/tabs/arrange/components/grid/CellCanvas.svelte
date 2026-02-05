<!--
  CellCanvas.svelte

  A single cell in the composition grid.
  Renders based on display mode:
  - animation: AnimatorCanvas with tunnel layers
  - choreo-card: LayeredSequencePreview with beat highlighting
  Can be selected to edit its contents.
-->
<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LayeredSequencePreview from "$lib/shared/sequence-viewer/components/LayeredSequencePreview.svelte";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import type { GridCell } from "../../state/arrange-grid-state.svelte";
  import type { IAnimationRenderer } from "../../../../services/contracts/IAnimationRenderer";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
  import type { ISequenceAnimationOrchestrator } from "../../../../services/contracts/ISequenceAnimationOrchestrator";
  import { SequenceAnimationOrchestrator } from "../../../../services/implementations/SequenceAnimationOrchestrator";
  import { createAnimationPanelState } from "../../../../state/animation-panel-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  let {
    cell,
    cellIndex,
    currentBeat,
    isPlaying,
    skipStartPosition = true,
    isSelected = false,
    isDragging = false,
    onSelect,
  }: {
    cell: GridCell;
    cellIndex: number;
    currentBeat: number;
    isPlaying: boolean;
    /** When true, step 0 (start position) is skipped and beats map to steps 1..N */
    skipStartPosition?: boolean;
    isSelected?: boolean;
    /** When true, click is suppressed (drag just ended) */
    isDragging?: boolean;
    onSelect: () => void;
  } = $props();

  // Per-cell animation orchestrators (NOT shared singletons)
  let primaryOrchestrator: ISequenceAnimationOrchestrator | null = null;
  let secondaryOrchestrator: ISequenceAnimationOrchestrator | null = null;
  let animationRenderer: IAnimationRenderer | null = null;
  let settingsService: ISettingsState | null = null;

  // Animation states for primary and secondary layers
  const primaryAnimationState = createAnimationPanelState();
  const secondaryAnimationState = createAnimationPanelState();

  // Local state
  let initialized = $state(false);
  let secondaryTexturesLoaded = $state(false);

  // Derived: Get layer data
  const primaryLayer = $derived(cell.layers[0] || null);
  const secondaryLayer = $derived(cell.layers[1] || null);
  const hasLayers = $derived(cell.layers.length > 0);
  const isAnimationType = $derived(cell.mediaType === "animation");

  // Media type display info
  const mediaTypeInfo = $derived.by(() => {
    switch (cell.mediaType) {
      case "video": return { icon: "fa-video", label: "Video" };
      case "image": return { icon: "fa-image", label: "Image" };
      case "choreo-card": return { icon: "fa-id-card", label: "Card" };
      default: return null;
    }
  });

  // Trail settings
  const trailSettings = $derived(animationSettings.trail);

  // Calculate effective beat for this cell (including cell-level offset)
  const effectiveBeat = $derived(currentBeat + cell.beatOffset);

  // Calculate current step for each layer.
  // The orchestrator uses 1-based steps: step=1 is beat 1 (steps[0]), step < 1 is start position.
  // steps.length = number of motion beats (start position is stored separately).
  //
  // skipStartPosition=true (seamless loop):
  //   actualBeats = stepCount, wrapped ranges 0..stepCount-1, step = wrapped + 1
  //   So orchestrator sees steps 1..stepCount (all motion beats, no start position)
  //
  // skipStartPosition=false (show start pose):
  //   actualBeats = stepCount + 1, wrapped ranges 0..stepCount
  //   step = wrapped (0 = start position, 1..stepCount = motion beats)
  const primaryCurrentStep = $derived.by(() => {
    if (!primaryLayer) return 0;
    const stepCount = primaryLayer.sequence.steps?.length || 1;
    const actualBeats = skipStartPosition ? stepCount : stepCount + 1;
    const layerBeat = effectiveBeat + primaryLayer.beatOffset;
    const wrapped = layerBeat % actualBeats;
    return skipStartPosition ? wrapped + 1 : wrapped;
  });

  const secondaryCurrentStep = $derived.by(() => {
    if (!secondaryLayer) return 0;
    const stepCount = secondaryLayer.sequence.steps?.length || 1;
    const actualBeats = skipStartPosition ? stepCount : stepCount + 1;
    const layerBeat = effectiveBeat + secondaryLayer.beatOffset;
    const wrapped = layerBeat % actualBeats;
    return skipStartPosition ? wrapped + 1 : wrapped;
  });

  // Get current step data. The orchestrator step is 1-based (step=1 uses steps[0]),
  // so subtract 1 before indexing into the array.
  const primaryStepData = $derived.by(() => {
    if (!primaryLayer?.sequence.steps) return null;
    const stepIndex = Math.floor(
      Math.max(0, Math.min(primaryCurrentStep - 1, primaryLayer.sequence.steps.length - 1))
    );
    return primaryLayer.sequence.steps[stepIndex] || null;
  });

  const secondaryStepData = $derived.by(() => {
    if (!secondaryLayer?.sequence.steps) return null;
    const stepIndex = Math.floor(
      Math.max(0, Math.min(secondaryCurrentStep - 1, secondaryLayer.sequence.steps.length - 1))
    );
    return secondaryLayer.sequence.steps[stepIndex] || null;
  });

  // Initialize services - create per-cell orchestrators
  onMount(() => {
    try {
      // Get shared stateless services from DI
      const animationStateService = container.items.animationStateService;
      const stepCalculationService = container.items.stepCalculationService;
      const propInterpolationService = container.items.propInterpolationService;
      settingsService = container.items.settingsState;
      animationRenderer = container.items.animationRenderer;

      // Create per-cell orchestrators (NOT shared singletons)
      primaryOrchestrator = new SequenceAnimationOrchestrator(
        animationStateService,
        stepCalculationService,
        propInterpolationService
      );
      secondaryOrchestrator = new SequenceAnimationOrchestrator(
        animationStateService,
        stepCalculationService,
        propInterpolationService
      );

      initialized = true;
    } catch (err) {
      console.error(`[CellCanvas ${cellIndex}] Failed to initialize:`, err);
    }
  });

  onDestroy(() => {
    primaryAnimationState.dispose();
    secondaryAnimationState.dispose();
    primaryOrchestrator?.dispose();
    secondaryOrchestrator?.dispose();
  });

  // Initialize primary orchestrator when layer changes
  $effect(() => {
    if (initialized && primaryLayer && primaryOrchestrator) {
      try {
        primaryOrchestrator.initializeWithDomainData(primaryLayer.sequence);
        primaryAnimationState.setSequenceData(primaryLayer.sequence);
        primaryAnimationState.setTotalSteps(primaryLayer.sequence.steps?.length || 0);
      } catch (err) {
        console.error(`[CellCanvas ${cellIndex}] Primary init failed:`, err);
      }
    }
  });

  // Initialize secondary orchestrator when layer changes
  $effect(() => {
    if (initialized && secondaryLayer && secondaryOrchestrator) {
      initSecondary();
    }
  });

  async function initSecondary() {
    if (!secondaryLayer || !animationRenderer || !settingsService || !secondaryOrchestrator) return;

    try {
      const propType = settingsService.currentSettings.propType || "staff";
      await animationRenderer.loadSecondaryPropTextures(
        propType,
        secondaryLayer.propColors.left,
        secondaryLayer.propColors.right
      );
      secondaryTexturesLoaded = true;

      secondaryOrchestrator.initializeWithDomainData(secondaryLayer.sequence);
      secondaryAnimationState.setSequenceData(secondaryLayer.sequence);
      secondaryAnimationState.setTotalSteps(secondaryLayer.sequence.steps?.length || 0);
    } catch (err) {
      console.error(`[CellCanvas ${cellIndex}] Secondary init failed:`, err);
    }
  }

  // Sync step positions - calculate prop states and update animation state
  // IMPORTANT: Read the derived step value BEFORE the conditional so Svelte 5
  // always tracks it as a dependency. If the read is inside the `if`, and the
  // condition is false on first run, the dependency is never registered and
  // the effect won't re-run when the step changes during playback.
  $effect(() => {
    const step = primaryCurrentStep;
    if (primaryOrchestrator?.isInitialized() && primaryLayer) {
      primaryOrchestrator.calculateState(step);
      const states = primaryOrchestrator.getCurrentPropStates();
      primaryAnimationState.setPropStates(states.blue, states.red);
    }
  });

  $effect(() => {
    const step = secondaryCurrentStep;
    if (secondaryOrchestrator?.isInitialized() && secondaryLayer) {
      secondaryOrchestrator.calculateState(step);
      const states = secondaryOrchestrator.getCurrentPropStates();
      secondaryAnimationState.setPropStates(states.blue, states.red);
    }
  });

  function handleClick() {
    if (isDragging) return;
    onSelect();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }
</script>

<div
  class="cell-canvas"
  class:selected={isSelected}
  class:empty={!hasLayers && isAnimationType}
  class:other-media={!isAnimationType}
  role="button"
  tabindex="0"
  aria-label="Cell {cellIndex + 1}{isAnimationType ? (hasLayers ? ` with ${cell.layers.length} layer${cell.layers.length > 1 ? 's' : ''}` : ', empty') : `, ${cell.mediaType}`}"
  aria-pressed={isSelected}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  {#if isAnimationType}
    {#if hasLayers}
      <AnimatorCanvas
        blueProp={primaryAnimationState.bluePropState}
        redProp={primaryAnimationState.redPropState}
        secondaryBlueProp={secondaryLayer ? secondaryAnimationState.bluePropState : null}
        secondaryRedProp={secondaryLayer ? secondaryAnimationState.redPropState : null}
        gridVisible={true}
        gridMode={primaryLayer?.sequence.gridMode ?? null}
        letter={primaryStepData?.letter || null}
        stepData={primaryStepData}
        currentStep={primaryCurrentStep}
        sequenceData={primaryLayer?.sequence || null}
        word={null}
        {trailSettings}
        hideTkaGlyph={true}
        hideStepNumbers={true}
      />
    {:else}
      <div class="empty-cell">
        <i class="fas fa-plus" aria-hidden="true"></i>
      </div>
    {/if}
  {:else if cell.mediaType === "choreo-card" && primaryLayer}
    <!-- Choreo Card mode: Beat-synced sequence preview -->
    <div class="choreo-card-container">
      <LayeredSequencePreview
        sequence={primaryLayer.sequence}
        highlightedStepIndex={primaryCurrentStep}
        showHighlight={isPlaying}
        darkMode={true}
        showWord={false}
        showCreatorName={false}
        showNotes={false}
        showBirthday={false}
      />
    </div>
  {:else}
    <!-- Non-animation media type placeholder (video, image, or empty choreo-card) -->
    <div class="media-placeholder">
      <i class="fas {mediaTypeInfo?.icon ?? 'fa-film'}" aria-hidden="true"></i>
      <span class="media-label">{mediaTypeInfo?.label ?? 'Content'}</span>
    </div>
  {/if}

  <!-- Cell index badge -->
  <span class="cell-index">{cellIndex + 1}</span>

  <!-- Layer count badge (only for animation type) -->
  {#if isAnimationType && hasLayers}
    <span class="layer-count">{cell.layers.length}</span>
  {/if}

  <!-- Media type badge (for non-animation types) -->
  {#if mediaTypeInfo}
    <span class="media-type-badge">
      <i class="fas {mediaTypeInfo.icon}" aria-hidden="true"></i>
    </span>
  {/if}
</div>

<style>
  .cell-canvas {
    position: relative;
    /* Fill the cell-wrapper completely (may be non-square for spanning cells) */
    width: 100%;
    height: 100%;
    /* Dynamic aspect ratio based on span (set via CSS variables from parent) */
    aspect-ratio: var(--col-span, 1) / var(--row-span, 1);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md);
    overflow: hidden;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    container-type: size;
    /* Flex to center the canvas content */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cell-canvas:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .cell-canvas:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .cell-canvas.selected {
    border-color: var(--theme-accent, #8b5cf6);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
  }

  .cell-canvas.empty {
    border-style: dashed;
  }

  /* Force AnimatorCanvas to fit within the cell as a centered square */
  /* Hierarchy: cell-canvas > animation-container > content-wrapper > canvas-wrapper > canvas */
  /* For non-square cells (e.g. 2-col × 1-row), the canvas must be the largest
     centered square that fits, not stretch to the wider dimension and overflow. */

  .cell-canvas :global(.animation-container) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }

  .cell-canvas :global(.content-wrapper) {
    /* Fill the cell and center the canvas within */
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Hide chrome that doesn't belong in grid cells (word header, progress bar) */
  .cell-canvas :global(.header-slot),
  .cell-canvas :global(.progress-slot) {
    display: none !important;
  }

  .cell-canvas :global(.canvas-wrapper) {
    /* Centered square: min(cell width, cell height)
       cqw → content-wrapper width (inline-size container) = cell width
       cqh → animation-container height (size container) = cell height */
    width: min(100cqw, 100cqh) !important;
    height: min(100cqw, 100cqh) !important;
    max-width: none !important;
    max-height: none !important;
    aspect-ratio: auto !important;
    flex-shrink: 0 !important;
  }

  .cell-canvas :global(canvas) {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
  }

  .empty-cell {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .empty-cell i {
    font-size: clamp(16px, 20cqw, 32px);
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }

  .cell-canvas:hover .empty-cell i {
    opacity: 0.8;
  }

  .cell-index {
    position: absolute;
    top: 4px;
    left: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: rgba(0, 0, 0, 0.5);
    padding: 2px 6px;
    border-radius: var(--border-radius-sm);
    pointer-events: none;
  }

  .layer-count {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: var(--font-size-compact, 12px);
    color: white;
    background: var(--theme-accent, #8b5cf6);
    padding: 2px 6px;
    border-radius: var(--border-radius-sm);
    pointer-events: none;
  }

  /* Choreo Card container - allows sequence preview to fit within cell */
  .choreo-card-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    overflow: hidden;
  }

  /* Constrain LayeredSequencePreview within the choreo card container */
  .choreo-card-container :global(.layered-preview) {
    max-width: 100%;
    max-height: 100%;
  }

  /* Media type placeholder for non-animation cells */
  .media-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .media-placeholder i {
    font-size: clamp(20px, 25cqw, 48px);
    opacity: 0.6;
  }

  .media-placeholder .media-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.6;
  }

  .cell-canvas.other-media {
    border-style: dashed;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .cell-canvas.other-media:hover {
    border-color: var(--theme-accent, #8b5cf6);
  }

  .cell-canvas.other-media:hover .media-placeholder {
    color: var(--theme-accent, #8b5cf6);
  }

  .cell-canvas.other-media:hover .media-placeholder i,
  .cell-canvas.other-media:hover .media-placeholder .media-label {
    opacity: 1;
  }

  /* Media type badge */
  .media-type-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 10px;
    color: white;
    background: var(--theme-accent, #8b5cf6);
    padding: 4px 6px;
    border-radius: var(--border-radius-sm);
    pointer-events: none;
  }
</style>
