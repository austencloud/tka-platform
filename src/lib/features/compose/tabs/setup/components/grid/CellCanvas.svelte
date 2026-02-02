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
  import type { IAnimationPlaybackController } from "../../../../services/contracts/IAnimationPlaybackController";
  import type { IAnimationRenderer } from "../../../../services/contracts/IAnimationRenderer";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
  import { createAnimationPanelState } from "../../../../state/animation-panel-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  let {
    cell,
    cellIndex,
    currentBeat,
    isPlaying,
    isSelected = false,
    onSelect,
  }: {
    cell: GridCell;
    cellIndex: number;
    currentBeat: number;
    isPlaying: boolean;
    isSelected?: boolean;
    onSelect: () => void;
  } = $props();

  // Services
  let primaryPlaybackController: IAnimationPlaybackController | null = null;
  let secondaryPlaybackController: IAnimationPlaybackController | null = null;
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

  // Calculate current step for each layer
  const primaryCurrentStep = $derived.by(() => {
    if (!primaryLayer) return 0;
    const beatCount = primaryLayer.sequence.steps?.length || 1;
    const layerBeat = effectiveBeat + primaryLayer.beatOffset;
    return layerBeat % beatCount;
  });

  const secondaryCurrentStep = $derived.by(() => {
    if (!secondaryLayer) return 0;
    const beatCount = secondaryLayer.sequence.steps?.length || 1;
    const layerBeat = effectiveBeat + secondaryLayer.beatOffset;
    return layerBeat % beatCount;
  });

  // Get current step data
  const primaryStepData = $derived.by(() => {
    if (!primaryLayer?.sequence.steps) return null;
    const stepIndex = Math.max(
      0,
      Math.min(primaryCurrentStep, primaryLayer.sequence.steps.length - 1)
    );
    return primaryLayer.sequence.steps[stepIndex] || null;
  });

  const secondaryStepData = $derived.by(() => {
    if (!secondaryLayer?.sequence.steps) return null;
    const stepIndex = Math.max(
      0,
      Math.min(secondaryCurrentStep, secondaryLayer.sequence.steps.length - 1)
    );
    return secondaryLayer.sequence.steps[stepIndex] || null;
  });

  // Initialize services
  onMount(() => {
    try {
      primaryPlaybackController = container.items.animationPlaybackController;
      secondaryPlaybackController = container.items.animationPlaybackController;
      settingsService = container.items.settingsState;
      animationRenderer = container.items.animationRenderer;
      initialized = true;
    } catch (err) {
      console.error(`[CellCanvas ${cellIndex}] Failed to initialize:`, err);
    }
  });

  onDestroy(() => {
    primaryAnimationState.dispose();
    secondaryAnimationState.dispose();
  });

  // Initialize primary animation when layer changes
  $effect(() => {
    if (initialized && primaryLayer && primaryPlaybackController) {
      try {
        primaryPlaybackController.initialize(
          primaryLayer.sequence,
          primaryAnimationState
        );
      } catch (err) {
        console.error(`[CellCanvas ${cellIndex}] Primary init failed:`, err);
      }
    }
  });

  // Initialize secondary animation when layer changes
  $effect(() => {
    if (
      initialized &&
      secondaryLayer &&
      secondaryPlaybackController &&
      animationRenderer &&
      settingsService
    ) {
      initSecondary();
    }
  });

  async function initSecondary() {
    if (!secondaryLayer || !animationRenderer || !settingsService) return;

    try {
      const propType = settingsService.currentSettings.propType || "staff";
      await animationRenderer.loadSecondaryPropTextures(
        propType,
        secondaryLayer.propColors.left,
        secondaryLayer.propColors.right
      );
      secondaryTexturesLoaded = true;

      if (secondaryPlaybackController) {
        secondaryPlaybackController.initialize(
          secondaryLayer.sequence,
          secondaryAnimationState
        );
      }
    } catch (err) {
      console.error(`[CellCanvas ${cellIndex}] Secondary init failed:`, err);
    }
  }

  // Sync step positions
  $effect(() => {
    if (primaryAnimationState.sequenceData && primaryLayer) {
      primaryAnimationState.setCurrentStep(primaryCurrentStep);
    }
  });

  $effect(() => {
    if (secondaryAnimationState.sequenceData && secondaryLayer) {
      secondaryAnimationState.setCurrentStep(secondaryCurrentStep);
    }
  });

  function handleClick() {
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
        sizing="contain"
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

  /* Force AnimatorCanvas to fit within the square cell */
  /* The hierarchy is: cell-canvas > animation-container > content-wrapper > canvas-wrapper > canvas */

  /* Constrain the outermost AnimatorCanvas container */
  .cell-canvas :global(.animation-container) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }

  /* content-wrapper must fit within animation-container */
  .cell-canvas :global(.content-wrapper) {
    /* Override the calc() sizing to just fit the container */
    width: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }

  .cell-canvas :global(.canvas-wrapper) {
    /* Canvas wrapper should not exceed cell bounds */
    width: 100% !important;
    height: auto !important;
    max-height: 100% !important;
    aspect-ratio: 1 / 1;
  }

  /* Ensure the actual canvas element is constrained */
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
  .choreo-card-container :global(.sequence-preview-container) {
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
