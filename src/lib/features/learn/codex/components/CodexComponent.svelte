<!--
	Codex Component - Reference sidebar for browsing pictographs

	Matches desktop CodexComponent functionality with control panel,
	row-based pictograph organization, operations, and orientation selector.
	Now featuring beautiful glass scrollbars.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import SimpleGlassScroll from "$lib/shared/foundation/ui/SimpleGlassScroll.svelte";
  import { createCodexState } from "../state/codex-state.svelte";
  import CodexControlPanel from "./CodexControlPanel.svelte";
  import CodexPictographGrid from "./CodexPictographGrid.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  // Props
  let {
    isVisible = true,
    onPictographSelected,
    onLetterSelected,
  } = $props<{
    isVisible?: boolean;
    onPictographSelected?: (pictograph: PictographData) => void;
    onLetterSelected?: (letter: string) => void;
  }>();

  // Create codex state using runes
  const codexState = createCodexState();

  const hapticService = getHapticFeedback();

  // Initialize pictographs when component mounts - only once
  $effect(() => {
    // Only initialize if visible and not already initialized or loading
    if (isVisible && !codexState.isInitialized && !codexState.isLoading) {
      codexState.refreshPictographs();
    }
  });

  // Reactive values
  let filteredPictographsByLetter = $derived(
    codexState.filteredPictographsByLetter
  );
  let letterRows = $derived(codexState.letterRows);
  let isLoading = $derived(codexState.isLoading);
  let isInitialized = $derived(codexState.isInitialized);
  let currentOrientation = $derived(codexState.currentOrientation);
  let error = $derived(codexState.error);
  let isProcessingOperation = $derived(codexState.isProcessingOperation);

  // Methods

  function handlePictographClick(pictograph: PictographData) {
    // Trigger selection haptic for pictograph selection
    hapticService?.trigger("selection");

    // If onLetterSelected is provided, treat this as a letter selection
    // Otherwise, treat it as a pictograph selection
    if (onLetterSelected && pictograph.letter) {
      onLetterSelected(pictograph.letter);
    } else {
      onPictographSelected?.(pictograph);
    }
  }

  // Control panel handlers
  function handleRotate() {
    // Trigger selection haptic for rotate action
    hapticService?.trigger("selection");
    codexState.rotatePictographs();
  }

  function handleMirror() {
    // Trigger selection haptic for mirror action
    hapticService?.trigger("selection");
    codexState.mirrorPictographs();
  }

  function handleColorSwap() {
    // Trigger selection haptic for color swap action
    hapticService?.trigger("selection");
    codexState.colorSwapPictographs();
  }

  function handleOrientationChange(orientation: string) {
    // Trigger selection haptic for orientation change
    hapticService?.trigger("selection");
    codexState.setOrientation(orientation);
  }

  function handleRetry() {
    // Trigger selection haptic for retry action
    hapticService?.trigger("selection");
    codexState.refreshPictographs();
  }
</script>

<div class="codex-component" class:collapsed={!isVisible}>
  {#if isVisible}
    <!-- Control Panel -->
    <CodexControlPanel
      {currentOrientation}
      onRotate={handleRotate}
      onMirror={handleMirror}
      onColorSwap={handleColorSwap}
      onOrientationChange={handleOrientationChange}
    />

    <!-- Content area with beautiful glass scrollbar -->
    <div class="content-wrapper">
      <SimpleGlassScroll variant="primary" height="100%">
        {#if error}
          <div class="error-state" role="alert" aria-live="assertive">
            <div class="error-icon">⚠️</div>
            <p class="error-message">{error}</p>
            <button class="retry-button" onclick={handleRetry}> Retry </button>
          </div>
        {:else if isLoading}
          <div class="loading-state">
            <ProgressRing percent={-1} size={32} strokeWidth={3} />
            <p>Loading pictographs...</p>
          </div>
        {:else if isProcessingOperation}
          <div class="loading-state">
            <ProgressRing percent={-1} size={32} strokeWidth={3} />
            <p>Processing operation...</p>
          </div>
        {:else if !isInitialized}
          <div class="loading-state">
            <ProgressRing percent={-1} size={32} strokeWidth={3} />
            <p>Initializing codex...</p>
          </div>
        {:else if Object.keys(filteredPictographsByLetter).length === 0}
          <div class="empty-state">
            <p>No pictographs found</p>
          </div>
        {:else}
          <!-- Row-based pictograph grid -->
          <CodexPictographGrid
            pictographsByLetter={filteredPictographsByLetter}
            {letterRows}
            onPictographClick={handlePictographClick}
          />
        {/if}
      </SimpleGlassScroll>
    </div>
  {/if}
</div>

<style>
  .codex-component {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0; /* Allow shrinking in flex context */
    background: transparent;
    border-radius: 0;
    border: none;
  }

  .codex-component.collapsed {
    width: var(--min-touch-target);
    min-width: var(--min-touch-target);
  }

  /* Content wrapper for glass scroll container */
  .content-wrapper {
    flex: 1;
    min-height: 0; /* Important for flex containers */
  }

  .collapsed .content-wrapper {
    display: none;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--theme-text-dim);
    text-align: center;
    gap: 16px;
    padding: 24px;
  }

  .loading-state p,
  .empty-state p {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    text-align: center;
    gap: 16px;
    padding: 24px;
  }

  .error-icon {
    font-size: 2rem;
    opacity: 0.8;
  }

  .error-message {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.875rem;
    color: var(--semantic-error);
  }

  .retry-button {
    padding: 10px 20px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 10px;
    color: var(--theme-text);
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .retry-button:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .retry-button:active {
    transform: scale(0.97);
  }

</style>
