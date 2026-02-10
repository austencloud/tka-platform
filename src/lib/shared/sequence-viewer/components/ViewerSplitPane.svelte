<!--
  ViewerSplitPane.svelte

  Split view pane for the sequence viewer modal.
  Shows animation on one side, choreo card preview on the other.
  Supports focus mode (tap to expand one pane).
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";

  type FocusedPane = "animation" | "image" | null;

  interface Props {
    sequence: SequenceData;
    animationState: AnimationPanelState;
    animationLoading: boolean;
    currentStep: number;
    isPlaying: boolean;
    currentLetter: Letter | null;
    currentStepData: StartPositionData | StepData | null;
    highlightedStepIndex: number | null;
    // Image settings
    imgShowWord: boolean;
    imgShowDifficulty: boolean;
    imgShowStartPos: boolean;
    imgShowCreatorName: boolean;
    imgShowNotes: boolean;
    imgDarkMode: boolean;
    imgColumnCount: number | null;
    userName: string;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    // Layout
    isFullscreen: boolean;
    fullscreenStackVertical: boolean;
    isMobile: boolean;
    isLandscapeMobile?: boolean;
    focusedPane: FocusedPane;
    // Render progress
    onRenderProgress?: (loaded: number, total: number) => void;
    // Callbacks
    onFocusPane: (pane: "animation" | "image") => void;
    onUnfocusPane: () => void;
    onStepClick: (stepIndex: number) => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  }

  let {
    sequence,
    animationState,
    animationLoading,
    currentStep,
    isPlaying,
    currentLetter,
    currentStepData,
    highlightedStepIndex,
    imgShowWord,
    imgShowDifficulty,
    imgShowStartPos,
    imgShowCreatorName,
    imgShowNotes,
    imgDarkMode,
    imgColumnCount,
    userName,
    bluePropType,
    redPropType,
    catDogModeEnabled,
    isFullscreen,
    fullscreenStackVertical,
    isMobile,
    isLandscapeMobile = false,
    onRenderProgress,
    focusedPane,
    onFocusPane,
    onUnfocusPane,
    onStepClick,
    onCanvasReady,
  }: Props = $props();

  function handleAnimationClick() {
    if (focusedPane === "animation") {
      onUnfocusPane();
    } else {
      onFocusPane("animation");
    }
  }

  function handlePreviewClick() {
    if (focusedPane === "image") {
      onUnfocusPane();
    } else {
      onFocusPane("image");
    }
  }

  function handleKeydown(e: KeyboardEvent, pane: "animation" | "image") {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedPane === pane) {
        onUnfocusPane();
      } else {
        onFocusPane(pane);
      }
    }
  }

  function handleCloseClick(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    onUnfocusPane();
  }
</script>

<div
  class="split-view view-container"
  data-fullscreen-stack={isFullscreen ? (fullscreenStackVertical ? "vertical" : "horizontal") : undefined}
  data-landscape={isLandscapeMobile || undefined}
  data-focused={focusedPane}
  in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
  out:fade={{ duration: 150, easing: cubicOut }}
>
  <!-- Animation pane -->
  <div
    class="split-column animation-column"
    class:focused={focusedPane === "animation"}
    data-hidden={focusedPane === "image"}
    role="button"
    tabindex="0"
    onclick={handleAnimationClick}
    onkeydown={(e) => handleKeydown(e, "animation")}
    aria-label={focusedPane === "animation" ? "Exit focus mode" : "Focus on animation"}
    aria-expanded={focusedPane === "animation"}
  >
    <div class="media-pane animation-pane">
      <!-- Close button - shown when focused (desktop only) -->
      {#if focusedPane === "animation" && !isMobile}
        <div
          class="pane-close-btn"
          role="button"
          tabindex="0"
          onclick={handleCloseClick}
          onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") handleCloseClick(e); }}
          aria-label="Exit focus mode"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </div>
      {/if}

      {#if animationLoading}
        <div class="loading-state">
          <div class="spinner"></div>
        </div>
      {:else if animationState.error}
        <div class="error-state">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{animationState.error}</span>
        </div>
      {:else}
        <AnimatorCanvas
          sequenceData={animationState.sequenceData}
          {currentStep}
          {isPlaying}
          blueProp={animationState.bluePropState}
          redProp={animationState.redPropState}
          gridMode={sequence?.gridMode}
          letter={currentLetter}
          stepData={currentStepData}
          word={sequence?.word}
          {onCanvasReady}
        />
      {/if}
    </div>
  </div>

  <!-- Image/Preview pane -->
  <div
    class="split-column preview-column"
    class:focused={focusedPane === "image"}
    data-hidden={focusedPane === "animation"}
    role="button"
    tabindex="0"
    onclick={handlePreviewClick}
    onkeydown={(e) => handleKeydown(e, "image")}
    aria-label={focusedPane === "image" ? "Exit focus mode" : "Focus on image"}
    aria-expanded={focusedPane === "image"}
  >
    <div class="preview-column-inner" class:focused={focusedPane === "image"}>
      <div class="media-pane preview-pane">
        <!-- Close button - shown when focused (desktop only) -->
        {#if focusedPane === "image" && !isMobile}
          <div
            class="pane-close-btn"
            role="button"
            tabindex="0"
            onclick={handleCloseClick}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") handleCloseClick(e); }}
            aria-label="Exit focus mode"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </div>
        {/if}

        <LayeredSequencePreview
          {sequence}
          {highlightedStepIndex}
          showHighlight={isPlaying || highlightedStepIndex !== null}
          {onStepClick}
          {onRenderProgress}
          showStepNumbers={true}
          showDifficultyLevel={imgShowDifficulty}
          includeStartPosition={imgShowStartPos}
          showCreatorName={imgShowCreatorName}
          showNotes={imgShowNotes}
          showBirthday={true}
          showLoopGlyph={true}
          darkMode={imgDarkMode}
          columnCount={imgColumnCount}
          {userName}
          {bluePropType}
          {redPropType}
          {catDogModeEnabled}
        />
      </div>
    </div>
  </div>
</div>

<style>
  /* View container for absolute positioning */
  .view-container {
    position: absolute;
    inset: 0;
  }

  /* Split view - CSS Grid with animated grid-template transitions */
  .split-view {
    display: grid;
    /* Mobile: vertical stack, both panes equal (use % for animatable values) */
    grid-template-rows: 50% 50%;
    grid-template-columns: 1fr;
    height: 100%;
    width: 100%;
    position: relative;
    /* GPU hint for smoother animation */
    will-change: grid-template-rows, grid-template-columns;
    /* Smooth grid transitions - 300ms ease-out */
    transition: grid-template-rows 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                grid-template-columns 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* Split columns are tappable buttons */
  .split-column {
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* Button reset */
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
    /* Smooth opacity transition for content fade */
    transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .split-column:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .animation-column {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .preview-column {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition: border-color 0.25s ease,
                opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* Inner wrapper for preview column */
  .preview-column-inner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .media-pane {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    container-type: size;
    position: relative;
  }

  .animation-pane {
    background: transparent;
  }

  .preview-pane {
    background: transparent;
    border-top: none;
    container-type: normal;
  }

  /* Close button - shown when pane is focused */
  .pane-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
    animation: closeButtonPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes closeButtonPopIn {
    from {
      opacity: 0;
      transform: scale(0.7);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .pane-close-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .pane-close-btn:active {
    transform: scale(0.92);
  }

  .pane-close-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Hidden column fades out */
  .split-view[data-focused] .split-column[data-hidden="true"] {
    opacity: 0;
    pointer-events: none;
  }

  .split-view[data-focused] .preview-column {
    border-left-color: transparent;
    border-top-color: transparent;
  }

  /* ========================================
     MOBILE: Vertical layout (default)
     Use percentage-based grid for animatable transitions
     ======================================== */

  /* Mobile: Focus on animation - collapse preview row */
  .split-view[data-focused="animation"] {
    grid-template-rows: 100% 0%;
  }

  /* Mobile: Focus on image - collapse animation row */
  .split-view[data-focused="image"] {
    grid-template-rows: 0% 100%;
  }

  /* ========================================
     DESKTOP: Horizontal layout (768px+)
     ======================================== */
  @media (min-width: 768px) {
    .split-view {
      /* Desktop: side-by-side, both panes equal */
      grid-template-rows: 1fr;
      grid-template-columns: 50% 50%;
    }

    /* Desktop: Focus on animation - collapse preview column */
    .split-view[data-focused="animation"] {
      grid-template-rows: 1fr;
      grid-template-columns: 100% 0%;
    }

    /* Desktop: Focus on image - collapse animation column */
    .split-view[data-focused="image"] {
      grid-template-rows: 1fr;
      grid-template-columns: 0% 100%;
    }

    .preview-column {
      border-top: none;
      border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .media-pane {
      padding: 24px;
    }
  }

  /* ========================================
     LANDSCAPE MOBILE: Horizontal layout
     Side-by-side on landscape phones
     ======================================== */

  .split-view[data-landscape="true"] {
    grid-template-rows: 1fr;
    grid-template-columns: 50% 50%;
  }

  .split-view[data-landscape="true"] .preview-column {
    border-top: none;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .split-view[data-landscape="true"][data-focused="animation"] {
    grid-template-rows: 1fr;
    grid-template-columns: 100% 0%;
  }

  .split-view[data-landscape="true"][data-focused="image"] {
    grid-template-rows: 1fr;
    grid-template-columns: 0% 100%;
  }

  /* ========================================
     FULLSCREEN STACK LAYOUTS
     Override grid direction based on orientation
     ======================================== */

  /* Fullscreen horizontal stack */
  .split-view[data-fullscreen-stack="horizontal"] {
    grid-template-rows: 1fr;
    grid-template-columns: 50% 50%;
  }

  .split-view[data-fullscreen-stack="horizontal"] .preview-column {
    border-top: none;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Fullscreen horizontal + focus animation */
  .split-view[data-fullscreen-stack="horizontal"][data-focused="animation"] {
    grid-template-columns: 100% 0%;
  }

  /* Fullscreen horizontal + focus image */
  .split-view[data-fullscreen-stack="horizontal"][data-focused="image"] {
    grid-template-columns: 0% 100%;
  }

  /* Fullscreen vertical stack */
  .split-view[data-fullscreen-stack="vertical"] {
    grid-template-rows: 50% 50%;
    grid-template-columns: 1fr;
  }

  .split-view[data-fullscreen-stack="vertical"] .preview-column {
    border-left: none;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Fullscreen vertical + focus animation */
  .split-view[data-fullscreen-stack="vertical"][data-focused="animation"] {
    grid-template-rows: 100% 0%;
  }

  /* Fullscreen vertical + focus image */
  .split-view[data-fullscreen-stack="vertical"][data-focused="image"] {
    grid-template-rows: 0% 100%;
  }

  /* Media pane children should fill available space */
  .media-pane > :global(*) {
    max-width: 100%;
    max-height: 100%;
  }

  /* Loading/Error states */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
  }

  .error-state {
    color: var(--semantic-error, #f87171);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .split-view,
    .split-column,
    .preview-column,
    .pane-close-btn {
      transition: none !important;
    }

    .pane-close-btn {
      animation: none !important;
    }
  }
</style>
