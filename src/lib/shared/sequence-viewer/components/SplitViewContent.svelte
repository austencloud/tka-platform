<!--
  SplitViewContent.svelte

  Split view showing animation and image panes side by side.
  Tap on a pane to focus/expand it.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";

  interface Props {
    sequence: SequenceData;
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    currentLetter: string | null;
    currentStepData: StepData | null;
    bluePropState: PropState | null;
    redPropState: PropState | null;
    animationLoading: boolean;
    animationError: string | null;
    highlightedStepIndex: number | null;
    userName: string;
    /** Which pane is focused/expanded: 'animation', 'image', or null */
    editingPane: 'animation' | 'image' | null;
    /** Image visibility settings */
    imgShowWord: boolean;
    imgShowStartPos: boolean;
    imgShowDifficulty: boolean;
    imgShowCreatorName: boolean;
    imgShowNotes: boolean;
    imgDarkMode: boolean;
    imgColumnCount: number | null;
    /** Whether in fullscreen mode */
    isFullscreen: boolean;
    /** Stack direction for fullscreen split */
    fullscreenStackVertical: boolean;
    /** Event handlers */
    onEnterEditMode: (pane: 'animation' | 'image') => void;
    onExitEditMode: () => void;
    onStepClick: (stepIndex: number) => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  }

  let {
    sequence,
    sequenceData,
    currentStep,
    isPlaying,
    currentLetter,
    currentStepData,
    bluePropState,
    redPropState,
    animationLoading,
    animationError,
    highlightedStepIndex,
    userName,
    editingPane,
    imgShowWord,
    imgShowStartPos,
    imgShowDifficulty,
    imgShowCreatorName,
    imgShowNotes,
    imgDarkMode,
    imgColumnCount,
    isFullscreen,
    fullscreenStackVertical,
    onEnterEditMode,
    onExitEditMode,
    onStepClick,
    onCanvasReady,
  }: Props = $props();

  function handleAnimationPaneClick() {
    if (editingPane === 'animation') {
      onExitEditMode();
    } else {
      onEnterEditMode('animation');
    }
  }

  function handleImagePaneClick() {
    if (editingPane === 'image') {
      onExitEditMode();
    } else {
      onEnterEditMode('image');
    }
  }

  function handleKeydown(e: KeyboardEvent, pane: 'animation' | 'image') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (editingPane === pane) {
        onExitEditMode();
      } else {
        onEnterEditMode(pane);
      }
    }
  }

  function handleCloseClick(e: Event) {
    e.stopPropagation();
    onExitEditMode();
  }

  function handleCloseKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      onExitEditMode();
    }
  }
</script>

<div
  class="split-view view-container"
  data-fullscreen-stack={isFullscreen ? (fullscreenStackVertical ? 'vertical' : 'horizontal') : undefined}
  data-focused={editingPane}
  in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
  out:fade={{ duration: 150, easing: cubicOut }}
>
  <!-- Animation pane -->
  <div
    class="split-column animation-column"
    class:focused={editingPane === 'animation'}
    data-hidden={editingPane === 'image'}
    role="button"
    tabindex="0"
    onclick={handleAnimationPaneClick}
    onkeydown={(e) => handleKeydown(e, 'animation')}
    aria-label={editingPane === 'animation' ? "Exit focus mode" : "Focus on animation"}
    aria-expanded={editingPane === 'animation'}
  >
    <div class="media-pane animation-pane">
      <!-- Close button - shown when focused -->
      {#if editingPane === 'animation'}
        <div
          class="pane-close-btn"
          role="button"
          tabindex="0"
          onclick={handleCloseClick}
          onkeydown={handleCloseKeydown}
          aria-label="Exit focus mode"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </div>
      {/if}

      {#if animationLoading}
        <div class="loading-state">
          <div class="spinner"></div>
        </div>
      {:else if animationError}
        <div class="error-state">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{animationError}</span>
        </div>
      {:else}
        <AnimatorCanvas
          {sequenceData}
          currentStep={currentStep}
          isPlaying={isPlaying}
          blueProp={bluePropState}
          redProp={redPropState}
          gridMode={sequence?.gridMode}
          letter={currentLetter as Letter | null}
          stepData={currentStepData}
          onCanvasReady={onCanvasReady}
        />
      {/if}
    </div>
  </div>

  <!-- Image/Preview pane -->
  <div
    class="split-column preview-column"
    class:focused={editingPane === 'image'}
    data-hidden={editingPane === 'animation'}
    role="button"
    tabindex="0"
    onclick={handleImagePaneClick}
    onkeydown={(e) => handleKeydown(e, 'image')}
    aria-label={editingPane === 'image' ? "Exit focus mode" : "Focus on image"}
    aria-expanded={editingPane === 'image'}
  >
    <div class="preview-column-inner" class:focused={editingPane === 'image'}>
      <div class="media-pane preview-pane">
        <!-- Close button - shown when focused -->
        {#if editingPane === 'image'}
          <div
            class="pane-close-btn"
            role="button"
            tabindex="0"
            onclick={handleCloseClick}
            onkeydown={handleCloseKeydown}
            aria-label="Exit focus mode"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </div>
        {/if}

        <LayeredSequencePreview
          {sequence}
          highlightedStepIndex={highlightedStepIndex}
          showHighlight={isPlaying}
          onStepClick={onStepClick}
          showWord={imgShowWord}
          showStepNumbers={true}
          showDifficultyLevel={imgShowDifficulty}
          includeStartPosition={imgShowStartPos}
          showCreatorName={imgShowCreatorName}
          showNotes={imgShowNotes}
          showBirthday={true}
          showLoopGlyph={true}
          darkMode={imgDarkMode}
          {userName}
          columnCount={imgColumnCount}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .split-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    height: 100%;
    overflow: hidden;
  }

  /* Fullscreen stacking */
  .split-view[data-fullscreen-stack="horizontal"] {
    flex-direction: row;
  }

  .split-view[data-fullscreen-stack="vertical"] {
    flex-direction: column;
  }

  .split-column {
    flex: 1;
    min-height: 0;
    min-width: 0;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) var(--ease-out, ease-out);
    position: relative;
  }

  .split-column[data-hidden="true"] {
    display: none;
  }

  .split-column.focused {
    flex: 1;
  }

  /* When one pane is focused, hide the other */
  .split-view[data-focused="animation"] .preview-column,
  .split-view[data-focused="image"] .animation-column {
    flex: 0;
    opacity: 0;
    pointer-events: none;
    height: 0;
    min-height: 0;
    padding: 0;
    margin: 0;
    overflow: hidden;
  }

  .media-pane {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    overflow: hidden;
  }

  .preview-column-inner {
    width: 100%;
    height: 100%;
    display: flex;
  }

  .preview-column-inner.focused {
    /* Allow scrolling in focused mode */
    overflow: auto;
  }

  /* Close button for focused panes */
  .pane-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    cursor: pointer;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .pane-close-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.05);
  }

  .pane-close-btn:active {
    transform: scale(0.95);
  }

  /* Loading and error states */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state i {
    font-size: 24px;
    color: var(--semantic-error, #ef4444);
  }

  /* Desktop: Side by side */
  @media (min-width: 768px) {
    .split-view {
      flex-direction: row;
      gap: 12px;
      padding: 12px;
    }

    .split-column {
      flex: 1;
    }
  }

  /* Mobile adjustments */
  @media (max-width: 767px) {
    .split-view {
      gap: 6px;
      padding: 6px;
    }

    .pane-close-btn {
      width: 32px;
      height: 32px;
      top: 8px;
      right: 8px;
    }
  }
</style>
