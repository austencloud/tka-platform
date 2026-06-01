<!--
  AnimationShareDrawer.svelte

  Drawer component for video export and playback.
  All business logic lives in AnimationCoordinator.

  This component:
  - Receives all state as props
  - Displays animation playback UI
  - Handles video export controls
  - Emits events when user interacts
  - Has ZERO business logic
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";

  // Extracted components (from animate module)
  import AnimationPanelHeader from "$lib/shared/animation-engine/components/canvas/AnimationPanelHeader.svelte";
  import AnimationCanvas from "$lib/shared/animation-engine/components/canvas/AnimationCanvas.svelte";
  import AnimationControlsPanel from "$lib/shared/animation-engine/components/canvas/AnimationControlsPanel.svelte";
  import AnimationViewerHelpSheet from "./AnimationViewerHelpSheet.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import type { ExportPhase } from "$lib/shared/video-export/components/ExportTakeover.svelte";

  // Lazy-loaded to avoid shared/ → features/ static import
  let CreatePanelDrawer = $state<typeof import("$lib/features/create/shared/components/CreatePanelDrawer.svelte").default | null>(null);
  import("$lib/features/create/shared/components/CreatePanelDrawer.svelte").then(m => { CreatePanelDrawer = m.default; });

  // Services
  import { getKeyboardShortcutManager } from "$lib/shared/keyboard/get-keyboard-shortcut-manager";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import type { ResponsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import type { KeyboardShortcutManager } from '$lib/shared/keyboard/services/keyboard-shortcut-manager'
  import { animationShortcutRegistrar } from "../services/animation-shortcut-registrar";

  // Types
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  // ============================================================================
  // MOBILE STATE
  // ============================================================================

  // Mobile tool view state
  let mobileToolsExpanded = $state(true); // Whether to show full controls or just toolbar
  let mobileToolView = $state<"controls" | "step-grid">("controls"); // Toggle between views
  let isSettingsOpen = $state(false); // Track when settings sheet is open for canvas adjustment

  // Toggle mobile tool view between controls and beat-grid
  function toggleMobileToolView() {
    mobileToolView = mobileToolView === "controls" ? "step-grid" : "controls";
  }

  // Touch handling state for preventing back navigation
  let mobileTouchStartY = $state(0);
  let mobileTouchStartX = $state(0);

  function handleMobileTouchStart(e: TouchEvent, _isSideBySideLayout: boolean) {
    const touch = e.touches[0];
    if (!touch) return;
    mobileTouchStartY = touch.pageY;
    mobileTouchStartX = touch.pageX;
    if (touch.pageX < 10) {
      e.preventDefault();
    }
  }

  function handleMobileTouchMove(e: TouchEvent, sideBySide: boolean) {
    const touch = e.touches[0];
    if (!touch) return;

    const currentX = touch.pageX;
    const deltaX = currentX - mobileTouchStartX;
    const deltaY = mobileTouchStartY - touch.pageY;
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

    // Prevent horizontal swipes from triggering back navigation
    if (isHorizontalSwipe && Math.abs(deltaX) > 5) {
      e.preventDefault();
    }
  }

  function preventBackNavigation(node: HTMLElement, sideBySide: boolean) {
    const onTouchStart = (e: TouchEvent) =>
      handleMobileTouchStart(e, sideBySide);
    const onTouchMove = (e: TouchEvent) => handleMobileTouchMove(e, sideBySide);
    const onWheel = (e: WheelEvent) => {
      const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (isHorizontalSwipe && Math.abs(e.deltaX) > 5) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    node.addEventListener("touchstart", onTouchStart, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("wheel", onWheel, { passive: false });

    return {
      update(newSideBySide: boolean) {
        node.removeEventListener("touchstart", onTouchStart);
        node.removeEventListener("touchmove", onTouchMove);
        node.removeEventListener("wheel", onWheel);

        const updatedOnTouchStart = (e: TouchEvent) =>
          handleMobileTouchStart(e, newSideBySide);
        const updatedOnTouchMove = (e: TouchEvent) =>
          handleMobileTouchMove(e, newSideBySide);

        node.addEventListener("touchstart", updatedOnTouchStart, {
          passive: false,
        });
        node.addEventListener("touchmove", updatedOnTouchMove, {
          passive: false,
        });
        node.addEventListener("wheel", onWheel, { passive: false });
      },
      destroy() {
        node.removeEventListener("touchstart", onTouchStart);
        node.removeEventListener("touchmove", onTouchMove);
        node.removeEventListener("wheel", onWheel);
      },
    };
  }

  // Props - ALL state comes from parent
  let {
    show = false,
    combinedPanelHeight = 0,
    isSideBySideLayout: isSideBySideLayoutProp,
    loading = false,
    error = null,
    speed = 1,
    isPlaying = false,
    playbackMode = "continuous",
    stepPlaybackPauseMs = 300,
    stepPlaybackStepSize = 1,
    blueProp = null,
    redProp = null,
    gridVisible = true,
    gridMode = null,
    letter = null,
    stepData = null,
    sequenceData = null,
    isExporting = false,
    exportProgress = null,
    onClose = () => {},
    onSpeedChange = () => {},
    onPlaybackStart = () => {},
    onPlaybackToggle = () => {},
    onPlaybackModeChange = () => {},
    onStepPlaybackPauseMsChange = () => {},
    onStepPlaybackStepSizeChange = () => {},
    onStepHalfBeatBackward = () => {},
    onStepHalfBeatForward = () => {},
    onStepFullBeatBackward = () => {},
    onStepFullBeatForward = () => {},
    onCanvasReady = () => {},
    onVideoStepChange = () => {},
    onExportVideo = () => {},
    onCancelExport = () => {},
    onShareAnimation = () => {},
    isSharing = false,
    isCircular = false,
    loopCount = 1,
    onLoopCountChange = () => {},
  }: {
    show?: boolean;
    combinedPanelHeight?: number;
    isSideBySideLayout?: boolean;
    loading?: boolean;
    error?: string | null;
    speed?: number;
    isPlaying?: boolean;
    playbackMode?: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode;
    stepPlaybackPauseMs?: number;
    stepPlaybackStepSize?: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").StepPlaybackStepSize;
    blueProp?: PropState | null;
    redProp?: PropState | null;
    gridVisible?: boolean;
    gridMode?: GridMode | null | undefined;
    letter?: Letter | null;
    stepData?: StartPositionData | StepData | null;
    sequenceData?: SequenceData | null;
    isExporting?: boolean;
    exportProgress?: VideoExportProgress | null;
    onClose?: () => void;
    onSpeedChange?: (newSpeed: number) => void;
    onPlaybackStart?: () => void;
    onPlaybackToggle?: () => void;
    onPlaybackModeChange?: (
      mode: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").PlaybackMode
    ) => void;
    onStepPlaybackPauseMsChange?: (pauseMs: number) => void;
    onStepPlaybackStepSizeChange?: (
      stepSize: import("$lib/shared/animation-engine/state/animation-panel-state.svelte").StepPlaybackStepSize
    ) => void;
    onStepHalfBeatBackward?: () => void;
    onStepHalfBeatForward?: () => void;
    onStepFullBeatBackward?: () => void;
    onStepFullBeatForward?: () => void;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onVideoStepChange?: (beat: number) => void;
    onExportVideo?: () => void;
    onCancelExport?: () => void;
    onShareAnimation?: () => void;
    isSharing?: boolean;
    isCircular?: boolean;
    loopCount?: number;
    onLoopCountChange?: (count: number) => void;
  } = $props();

  // ============================================================================
  // HELP SHEET STATE
  // ============================================================================

  let showHelpSheet = $state(false);

  function handleShowHelp() {
    showHelpSheet = true;
  }

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  let shortcutService: KeyboardShortcutManager | null = null;
  let unregisterShortcuts: (() => void) | null = null;

  function setupKeyboardShortcuts() {
    if (!shortcutService || !show) return;

    // Set context to animation-panel
    shortcutService.setContext("animation-panel");

    // Register shortcuts
    unregisterShortcuts = animationShortcutRegistrar.register(shortcutService, {
      onPlaybackToggle,
      onStepHalfBeatForward,
      onStepHalfBeatBackward,
      onStepFullBeatForward,
      onStepFullBeatBackward,
      onClose: handleClose,
      onShowHelp: handleShowHelp,
    });
  }

  function cleanupKeyboardShortcuts() {
    if (unregisterShortcuts) {
      unregisterShortcuts();
      unregisterShortcuts = null;
    }
    // Reset context to global when closing
    if (shortcutService) {
      shortcutService.setContext("global");
    }
  }

  // Register/unregister shortcuts when panel opens/closes
  $effect(() => {
    if (show && shortcutService) {
      setupKeyboardShortcuts();
    } else {
      cleanupKeyboardShortcuts();
    }
  });

  onDestroy(() => {
    cleanupKeyboardShortcuts();
  });

  // ============================================================================
  // LAYOUT DETECTION
  // ============================================================================

  // Detect side-by-side layout internally if not provided via prop
  let layoutService: ResponsiveLayoutManager | null = null;
  let detectedSideBySide = $state(false);

  onMount(() => {
    layoutService = responsiveLayoutManager;
    if (layoutService) {
      detectedSideBySide = layoutService.shouldUseSideBySideLayout();
    }

    // Try to resolve keyboard shortcut service
    shortcutService = getKeyboardShortcutManager();
  });

  // Update on resize
  $effect(() => {
    if (!browser || !layoutService) return;

    const handleResize = () => {
      if (layoutService) {
        detectedSideBySide = layoutService.shouldUseSideBySideLayout();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Use prop if explicitly provided, otherwise use detected value
  const isSideBySideLayout = $derived(
    isSideBySideLayoutProp !== undefined
      ? isSideBySideLayoutProp
      : detectedSideBySide
  );

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Trail settings from global animation settings (derived for reactivity)
  let trailSettings = $derived(animationSettings.settings.trail);

  // ── Export takeover overlay (dim scrim + progress ring over the live canvas) ──
  const takeoverPhase = $derived<ExportPhase>(
    !isExporting ? "idle"
    : exportProgress?.stage === "error" ? "error"
    : exportProgress?.stage === "encoding" ? "encoding"
    : exportProgress?.stage === "complete" ? "complete"
    : "capturing",
  );
  const takeoverLabel = $derived(
    takeoverPhase === "encoding" ? "Encoding…"
    : takeoverPhase === "complete" ? "Done"
    : "Rendering",
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleClose() {
    onClose();
  }
</script>

{#if CreatePanelDrawer}
<CreatePanelDrawer
  isOpen={show}
  panelName="animation"
  {combinedPanelHeight}
  fullHeightOnMobile={!isSideBySideLayout}
  showHandle={true}
  closeOnBackdrop={false}
  focusTrap={false}
  lockScroll={false}
  labelledBy="animation-panel-title"
  onClose={handleClose}
>
  <div
    class="animation-panel"
    role="dialog"
    aria-labelledby="animation-panel-title"
  >
    <!-- Header (Mobile/Desktop adaptive) -->
    <AnimationPanelHeader
      {isSideBySideLayout}
      onClose={handleClose}
      onShowHelp={handleShowHelp}
    />

    <h2 id="animation-panel-title" class="sr-only">Animation Viewer</h2>

    {#if loading}
      <div
        class="loading-message"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        Loading animation...
      </div>
    {:else if error}
      <div class="error-message" role="alert">{error}</div>
    {:else}
      <!-- Animation Viewer with Adaptive Layout -->
      <div class="canvas-container">
        <div
          class="content-wrapper"
          class:desktop={isSideBySideLayout}
          class:mobile-expanded={!isSideBySideLayout}
          class:settings-open={isSettingsOpen && !isSideBySideLayout}
        >
          <!-- Canvas Area (position:relative host so the export takeover scrims only the canvas) -->
          <div class="canvas-overlay-host">
            <AnimationCanvas
              {blueProp}
              {redProp}
              {gridVisible}
              {gridMode}
              {letter}
              {stepData}
              {sequenceData}
              {isPlaying}
              {speed}
              {onCanvasReady}
              {onVideoStepChange}
              {onPlaybackToggle}
              {trailSettings}
            />
            <ExportTakeover
              phase={takeoverPhase}
              progress={exportProgress?.progress ?? 0}
              phaseLabel={takeoverLabel}
              error={exportProgress?.error ?? null}
              onCancel={onCancelExport}
              onRetry={onExportVideo}
            />
          </div>

          <!-- Unified Controls Panel -->
          <AnimationControlsPanel
            {speed}
            {isPlaying}
            {playbackMode}
            {stepPlaybackPauseMs}
            {stepPlaybackStepSize}
            {isSideBySideLayout}
            isExpanded={!isSideBySideLayout}
            bind:isSettingsOpen
            {mobileToolView}
            {sequenceData}
            currentStep={stepData && "stepNumber" in stepData
              ? stepData.stepNumber
              : 0}
            {onSpeedChange}
            {onPlaybackStart}
            {onPlaybackToggle}
            {onPlaybackModeChange}
            {onStepPlaybackPauseMsChange}
            {onStepPlaybackStepSizeChange}
            {onStepHalfBeatBackward}
            {onStepHalfBeatForward}
            {onStepFullBeatBackward}
            {onStepFullBeatForward}
            onToggleToolView={toggleMobileToolView}
            {onExportVideo}
            {onCancelExport}
            {isExporting}
            {exportProgress}
            {isCircular}
            {loopCount}
            {onLoopCountChange}
            preventBackNavAction={preventBackNavigation}
          />
        </div>
      </div>
    {/if}
  </div>
</CreatePanelDrawer>
{/if}

<!-- Help Sheet -->
<AnimationViewerHelpSheet bind:isOpen={showHelpSheet} {isSideBySideLayout} />

<style>
  /* ===========================
     ANIMATION PANEL
     Main container and layout styles
     (Component-specific styles are in child components)
     =========================== */

  .animation-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    /* Prevent browser back navigation on horizontal swipes */
    overscroll-behavior-x: contain;
    touch-action: pan-y pinch-zoom;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ===========================
     MAIN LAYOUT
     =========================== */

  .canvas-container {
    container-type: size;
    container-name: animator-canvas;
    flex: 1;
    width: 100%;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    min-height: 0;
    padding: clamp(4px, 2vw, 20px);
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    flex: 1;
    gap: 10px;
    min-height: 0;
  }

  /* position:relative host so ExportTakeover scrims only the canvas, not the
     controls. It carries the flex-child sizing while the inner .canvas-area
     (whose responsive flex rules live below) stretches to fill it. */
  .canvas-overlay-host {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
  }

  .canvas-overlay-host :global(.canvas-area) {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
  }

  /* Mobile Expanded: Responsive layout that adapts to viewport size */
  .content-wrapper.mobile-expanded {
    gap: 4px;
  }

  /* When settings sheet is open, shrink canvas to fit in top portion */
  .content-wrapper.settings-open {
    gap: 0;
  }

  .content-wrapper.settings-open :global(.canvas-area) {
    flex: 0 0 auto;
    max-height: 42vh;
    min-height: 0;
  }

  .content-wrapper.settings-open :global(.controls-panel) {
    display: none; /* Hide controls when settings sheet is open */
  }

  /* Small devices (iPhone SE, small phones): Canvas expands to fill space */
  @media (max-width: 430px) and (max-height: 752px) {
    .canvas-container {
      padding: 8px !important;
      gap: 8px;
    }

    .content-wrapper.mobile-expanded {
      gap: 8px;
    }

    .content-wrapper.mobile-expanded :global(.canvas-area) {
      flex: 1 1 auto;
      min-height: 200px;
      max-height: none;
    }

    .content-wrapper.mobile-expanded :global(.controls-panel) {
      flex: 0 0 auto;
      min-height: 0;
      overflow-y: visible;
      max-height: none;
      padding: 8px;
      gap: 8px;
    }
  }

  /* Extra small devices (iPhone SE): Even more compact */
  @media (max-width: 375px) and (max-height: 670px) {
    .canvas-container {
      padding: 6px !important;
      gap: 6px;
    }

    .content-wrapper.mobile-expanded {
      gap: 6px;
    }

    .content-wrapper.mobile-expanded :global(.canvas-area) {
      flex: 1 1 auto;
      min-height: 180px;
      max-height: none;
    }

    .content-wrapper.mobile-expanded :global(.controls-panel) {
      flex: 0 0 auto;
      padding: 6px;
      gap: 6px;
    }
  }

  /* ===========================
     DESKTOP LAYOUT - Full height canvas
     =========================== */

  .content-wrapper.desktop {
    gap: 12px;
  }

  .content-wrapper.desktop :global(.canvas-area) {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none; /* No height restriction on desktop */
    height: 100%;
  }

  .content-wrapper.desktop :global(.controls-panel) {
    flex: 0 0 auto;
    overflow-y: auto;
  }

  /* Medium to large devices (Galaxy Fold, tablets): Responsive flexible layout */
  @media (min-width: 431px), (min-height: 751px) {
    .content-wrapper.mobile-expanded :global(.canvas-area) {
      flex: 1 1 auto;
      min-height: 200px;
      max-height: 60vh;
    }

    .content-wrapper.mobile-expanded :global(.controls-panel) {
      flex: 0 1 auto;
      overflow-y: auto;
      padding: 8px;
      gap: 10px;
    }

    .animation-panel:has(.content-wrapper.mobile-expanded) .canvas-container {
      padding: 8px !important;
    }
  }

  /* ===========================
     LANDSLOOPE LAYOUT - Side-by-side
     =========================== */

  @container animator-canvas (min-aspect-ratio: 1.5/1) {
    .content-wrapper {
      flex-direction: row;
      gap: 1.5cqw;
      align-items: stretch;
    }

    .content-wrapper .canvas-overlay-host {
      flex: 1 1 50%;
      min-width: 0;
      width: auto;
      height: 100%;
    }

    .content-wrapper :global(.canvas-area) {
      flex: 1 1 50%;
      min-width: 0;
      width: auto;
      height: 100%;
    }

    .content-wrapper :global(.controls-panel) {
      flex: 0 0 auto;
      min-width: 280px;
      max-width: 400px;
      height: 100%;
      overflow-y: auto;
    }

    /* Desktop in landscape: ensure full height */
    .content-wrapper.desktop :global(.canvas-area) {
      flex: 1 1 auto;
      height: 100%;
      max-height: none;
    }
  }

  /* ===========================
     LOADING & ERROR STATES
     =========================== */

  .loading-message,
  .error-message {
    text-align: center;
    padding: clamp(20px, 4vw, 32px);
    font-size: clamp(13px, 2.8vw, 15px);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    border-radius: clamp(12px, 2vw, 16px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
  }

  .error-message {
    color: var(--semantic-error);
    background: var(--semantic-error-dim);
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
  }
</style>
