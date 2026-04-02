<!--
  ViewerSplitPane.svelte

  Split view pane for the sequence viewer modal.
  Shows animation on one side, choreo card preview on the other.
  Supports focus mode (tap to expand one pane).
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type {
    ViewerPlaybackState,
    ImageCompositionProps,
    PropRenderingProps,
    ViewerLayoutState,
  } from "../domain/viewer-prop-groups";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import ChoreoCard from "./ChoreoCard.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

  // Derive trail settings from the global singleton so canvas settings changes
  // (e.g. switching from "one end" to "both ends") propagate to this canvas.
  // Also enforces unilateral prop constraint: props with one meaningful endpoint
  // (fan, club, minihoop, etc.) always use RIGHT_END regardless of stored preference.
  const trailSettings = $derived.by(() => {
    const t = animationSettings.trail;
    void t.mode;
    void t.fadeDurationMs;
    void t.lineWidth;
    void t.maxOpacity;
    void t.trackingMode;
    void t.effect;

    const settings = { ...t };

    // Enforce unilateral constraint: only bilateral props can track both ends
    if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
      const blue = propRendering.bluePropType;
      const red = propRendering.redPropType;
      const hasBilateral =
        (blue != null && isBilateralProp(String(blue))) ||
        (red != null && isBilateralProp(String(red)));
      if (!hasBilateral) {
        settings.trackingMode = TrackingMode.RIGHT_END;
      }
    }

    return settings;
  });

  interface Props {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    imageComposition: ImageCompositionProps;
    propRendering: PropRenderingProps;
    layout: ViewerLayoutState;
    renderMode?: '2d' | '3d';
    onRenderProgress?: (loaded: number, total: number) => void;
    onFocusPane: (pane: "animation" | "image") => void;
    onUnfocusPane: () => void;
    onStepClick: (stepIndex: number) => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    onChoreoCardContextMenu?: (x: number, y: number) => void;
    rerenderTrigger?: number;
  }

  let {
    sequence,
    playback,
    imageComposition,
    propRendering,
    layout,
    renderMode = '2d',
    onRenderProgress,
    onFocusPane,
    onUnfocusPane,
    onStepClick,
    onCanvasReady,
    onChoreoCardContextMenu,
    rerenderTrigger = 0,
  }: Props = $props();

  // 3D viewer context for the toggle button
  let viewer3DState: ReturnType<typeof getViewer3DContext> | undefined;
  try {
    viewer3DState = getViewer3DContext();
  } catch {
    // Not in a viewer context
  }

  function toggleRenderMode(e: MouseEvent) {
    e.stopPropagation();
    if (!viewer3DState) return;
    if (viewer3DState.renderMode === '3d') {
      viewer3DState.exit3D();
    } else if (playback.animationState.sequenceData) {
      viewer3DState.enter3D(playback.animationState.sequenceData);
    }
  }

  function handleAnimationClick() {
    // In 3D mode, don't intercept clicks — OrbitControls needs them
    if (renderMode === '3d') return;
    if (layout.focusedPane === "animation") {
      onUnfocusPane();
    } else {
      onFocusPane("animation");
    }
  }

  function handlePreviewClick() {
    if (layout.focusedPane === "image") {
      onUnfocusPane();
    } else {
      onFocusPane("image");
    }
  }

  function handleKeydown(e: KeyboardEvent, pane: "animation" | "image") {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (layout.focusedPane === pane) {
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
  data-fullscreen-stack={layout.isFullscreen ? (layout.fullscreenStackVertical ? "vertical" : "horizontal") : undefined}
  data-landscape={layout.isLandscapeMobile || undefined}
  data-focused={layout.focusedPane}
  in:fade={{ duration: 200 }}
>
  <!-- Animation pane -->
  <div
    class="split-column animation-column"
    class:focused={layout.focusedPane === "animation"}
    data-hidden={layout.focusedPane === "image"}
    role="button"
    tabindex="0"
    onclick={handleAnimationClick}
    onkeydown={(e) => handleKeydown(e, "animation")}
    aria-label={layout.focusedPane === "animation" ? "Exit focus mode" : "Focus on animation"}
    aria-expanded={layout.focusedPane === "animation"}
  >
    <div
      class="media-pane animation-pane"
    >
      <!-- Close button - shown when focused (desktop only) -->
      {#if layout.focusedPane === "animation" && !layout.isMobile && !layout.suppressCloseButton}
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

      {#if playback.animationLoading}
        <div class="loading-state">
          <ProgressRing percent={-1} size={32} strokeWidth={3} />
        </div>
      {:else if playback.animationState.error}
        <div class="error-state">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{playback.animationState.error}</span>
        </div>
      {:else}
        <!-- Both canvases always mounted. Crossfade via opacity transition. -->
        <div
          class="canvas-layer canvas-3d-layer"
          style="opacity:{renderMode === '3d' ? 1 : 0};pointer-events:{renderMode === '3d' ? 'auto' : 'none'};"
        >
          <Viewer3DCanvas
            sequenceData={playback.animationState.sequenceData}
            currentStep={playback.currentStep}
            isPlaying={playback.isPlaying}
            bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : null}
            redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : null}
          />
        </div>
        <AnimatorCanvas
          sequenceData={playback.animationState.sequenceData}
          currentStep={playback.currentStep}
          isPlaying={playback.isPlaying}
          blueProp={playback.animationState.bluePropState}
          redProp={playback.animationState.redPropState}
          gridMode={sequence?.gridMode}
          letter={playback.currentLetter}
          stepData={playback.currentStepData}
          word={sequence?.word}
          bluePropType={propRendering.bluePropType}
          redPropType={propRendering.redPropType}
          {trailSettings}
          {onCanvasReady}
          focused={layout.focusedPane === "animation"}
        />

        <!-- 2D/3D toggle — top left of animation pane -->
        {#if viewer3DState?.webgl2Available}
          <div class="render-mode-toggle" onclick={toggleRenderMode}>
            <button
              class="mode-pill"
              class:active={renderMode !== '3d'}
              aria-label="2D view"
            >2D</button>
            <button
              class="mode-pill"
              class:active={renderMode === '3d'}
              aria-label="3D view"
            >3D</button>
          </div>
        {/if}
      {/if}

    </div>
  </div>

  <!-- Image/Preview pane -->
  <div
    class="split-column preview-column"
    class:focused={layout.focusedPane === "image"}
    data-hidden={layout.focusedPane === "animation"}
    role="button"
    tabindex="0"
    onclick={handlePreviewClick}
    onkeydown={(e) => handleKeydown(e, "image")}
    aria-label={layout.focusedPane === "image" ? "Exit focus mode" : "Focus on image"}
    aria-expanded={layout.focusedPane === "image"}
  >
    <div class="preview-column-inner" class:focused={layout.focusedPane === "image"}>
      <div
        class="media-pane preview-pane"
      >
        <!-- Close button - shown when focused (desktop only) -->
        {#if layout.focusedPane === "image" && !layout.isMobile && !layout.suppressCloseButton}
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

        <ChoreoCard
          {sequence}
          highlightedStepIndex={layout.focusedPane === "image" ? null : playback.highlightedStepIndex}
          showHighlight={layout.focusedPane === "image" ? false : (playback.isPlaying || playback.highlightedStepIndex !== null)}
          {onStepClick}
          {onRenderProgress}
          showWord={imageComposition.showWord}
          showStepNumbers={imageComposition.showStepNumbers}
          showDifficultyLevel={imageComposition.showDifficulty}
          includeStartPosition={imageComposition.showStartPos}
          showCreatorName={imageComposition.showCreatorName}
          showNotes={imageComposition.showNotes}
          showQRCode={imageComposition.showQRCode}
          showBirthday={imageComposition.showBirthday}
          showLoopGlyph={imageComposition.showLoopGlyph ?? true}
          darkMode={imageComposition.darkMode}
          columnCount={imageComposition.columnCount}
          forceContain={imageComposition.forceContain}
          fitWidth={layout.isMobile && layout.focusedPane === "image"}
          userName={imageComposition.userName}
          bluePropType={propRendering.bluePropType}
          redPropType={propRendering.redPropType}
          catDogModeEnabled={propRendering.catDogModeEnabled}
          onContextMenu={onChoreoCardContextMenu}
          {rerenderTrigger}
        />

      </div>
    </div>
  </div>
</div>

<style>
  /*
   * Unified Motion Language
   *
   * One curve:  cubic-bezier(0.2, 0, 0, 1)  — Material 3 "emphasized decelerate"
   * Micro:      120ms  — button press, hover
   * Standard:   250ms  — layout shifts, panel transitions, focus/unfocus
   * Spring:     cubic-bezier(0.34, 1.56, 0.64, 1) — close button pop only
   */

  /* View container for absolute positioning */
  .view-container {
    position: absolute;
    inset: 0;
  }

  /* Split view - CSS Grid with animated grid-template transitions */
  .split-view {
    display: grid;
    grid-template-rows: 50% 50%;
    grid-template-columns: 1fr;
    height: 100%;
    width: 100%;
    position: relative;
    will-change: grid-template-rows, grid-template-columns;
    transition: grid-template-rows 250ms cubic-bezier(0.2, 0, 0, 1),
                grid-template-columns 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  /* Split columns — tappable focus targets */
  .split-column {
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
    transition: opacity 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  /* Hover scale — desktop pointer devices only */
  @media (hover: hover) and (pointer: fine) {
    .split-column:not(.focused) {
      transition: opacity 250ms cubic-bezier(0.2, 0, 0, 1),
                  transform 120ms cubic-bezier(0.2, 0, 0, 1);
    }
    .split-column:hover:not(.focused) {
      transform: scale(1.012);
    }
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
    transition: border-color 250ms cubic-bezier(0.2, 0, 0, 1),
                opacity 250ms cubic-bezier(0.2, 0, 0, 1);
  }

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

  .canvas-3d-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    transition: opacity 250ms ease;
  }

  .render-mode-toggle {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .mode-pill {
    padding: 5px 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-pill:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .mode-pill.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .preview-pane {
    background: transparent;
    border-top: none;
    container-type: normal;
  }

  /* Mobile: when focused for image export, allow the choreo card to scroll
     if it's taller than the viewport (e.g. many rows with few columns).
     Must unlock overflow at every level of the clipping chain. */
  @media (max-width: 767px) {
    .split-column.preview-column.focused {
      overflow-y: auto;
    }

    .focused .preview-pane {
      overflow-y: auto;
      align-items: flex-start;
    }
  }

  /* Export sidebar space is now handled by the parent's CSS grid layout
     (grid-template-columns: 1fr var(--export-sidebar-width)).
     No padding-right compensation needed. */

  /* Close button — spring pop-in, staggered 100ms after grid starts moving */
  .pane-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
    animation: closeButtonPopIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms both;
  }

  @keyframes closeButtonPopIn {
    from {
      opacity: 0;
      transform: scale(0.6);
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

  /* Hidden column fades out — same 250ms as the grid, so everything lands together */
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

    /* Preview pane needs less padding — the ChoreoCard
       handles its own glow padding internally */
    .preview-pane {
      padding: 4px;
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

  @media (prefers-reduced-motion: reduce) {
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
