<!--
  ShareHubDrawer.svelte

  Drawer wrapper for unified Share Hub panel.
  Provides AnimationExportContext to eliminate prop drilling.

  - Mobile: Bottom drawer, 100dvh height
  - Desktop: Right drawer, full height
  - Context-based animation state (no prop drilling)

  Uses SequencePreviewPanel (mode="preview") for consistent UX
  with the Discover gallery's full mode.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequencePreviewPanel from "$lib/shared/sequence-viewer/components/SequencePreviewPanel.svelte";
  import type { MediaFormat, ExportSettings as SequenceViewerExportSettings } from "$lib/shared/sequence-viewer/domain/types";
  import type { ExportSettings } from "../domain/models/ExportSettings";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import {
    setAnimationExportContext,
    createAnimationExportContext,
  } from "../context/animation-export-context.svelte";

  let {
    isOpen = $bindable(false),
    sequence,
    isSequenceSaved = true,
    isMobile = false,
    onClose,
    onExport,
    // Animation props (converted to context)
    animationSequenceData = null,
    isAnimationPlaying = false,
    animationCurrentBeat = 0,
    animationSpeed = 1,
    animationBluePropState = null,
    animationRedPropState = null,
    isCircular = false,
    exportLoopCount = 1,
    isAnimationExporting = false,
    animationExportProgress = null,
    animationServicesReady = false,
    animationLoading = false,
    selectedFormat = "animation",
    playbackMode = "continuous" as PlaybackMode,
    stepPlaybackPauseMs = 300,
    stepPlaybackStepSize = 1 as StepPlaybackStepSize,
    blueMotionVisible = true,
    redMotionVisible = true,
    isSideBySideLayout = false,
    onPlaybackToggle,
    onSpeedChange,
    onStepHalfBeatForward,
    onStepHalfBeatBackward,
    onStepFullBeatForward,
    onStepFullBeatBackward,
    onLoopCountChange,
    onCanvasReady,
    onCancelExport,
    onExportVideo,
    onFormatChange,
    onPlaybackModeChange,
    onStepPlaybackPauseMsChange,
    onStepPlaybackStepSizeChange,
    onToggleBlue,
    onToggleRed,
  }: {
    isOpen?: boolean;
    sequence: SequenceData | null;
    isSequenceSaved?: boolean;
    isMobile?: boolean;
    onClose?: () => void;
    onExport?: (
      mode: "single" | "composite",
      settings?: ExportSettings
    ) => Promise<void>;
    // Animation props
    animationSequenceData?: SequenceData | null;
    isAnimationPlaying?: boolean;
    animationCurrentBeat?: number;
    animationSpeed?: number;
    animationBluePropState?: any;
    animationRedPropState?: any;
    isCircular?: boolean;
    exportLoopCount?: number;
    isAnimationExporting?: boolean;
    animationExportProgress?: VideoExportProgress | null;
    animationServicesReady?: boolean;
    animationLoading?: boolean;
    selectedFormat?: "animation" | "static" | "performance";
    playbackMode?: PlaybackMode;
    stepPlaybackPauseMs?: number;
    stepPlaybackStepSize?: StepPlaybackStepSize;
    blueMotionVisible?: boolean;
    redMotionVisible?: boolean;
    isSideBySideLayout?: boolean;
    onPlaybackToggle?: () => void;
    onSpeedChange?: (speed: number) => void;
    onStepHalfBeatForward?: () => void;
    onStepHalfBeatBackward?: () => void;
    onStepFullBeatForward?: () => void;
    onStepFullBeatBackward?: () => void;
    onLoopCountChange?: (count: number) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onCancelExport?: () => void;
    onExportVideo?: () => void;
    onFormatChange?: (format: "animation" | "static" | "performance") => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onStepPlaybackPauseMsChange?: (pauseMs: number) => void;
    onStepPlaybackStepSizeChange?: (stepSize: StepPlaybackStepSize) => void;
    onToggleBlue?: () => void;
    onToggleRed?: () => void;
  } = $props();

  // Create and provide the animation export context
  // This eliminates prop drilling through ShareHubPanel → SingleMediaView → AnimationExportView
  //
  // IMPORTANT: Context must be set during initialization, not reactively.
  // We create a reactive state object that gets updated, and set the context once.
  const animationContext = $state({
    state: {
      sequenceData: animationSequenceData,
      isCircular,
      isPlaying: isAnimationPlaying,
      currentBeat: animationCurrentBeat,
      speed: animationSpeed,
      playbackMode,
      stepPlaybackPauseMs,
      stepPlaybackStepSize,
      blueMotionVisible,
      redMotionVisible,
      bluePropState: animationBluePropState,
      redPropState: animationRedPropState,
      exportLoopCount,
      isExporting: isAnimationExporting,
      exportProgress: animationExportProgress,
      servicesReady: animationServicesReady,
      loading: animationLoading,
      isSideBySideLayout,
      selectedFormat,
    },
    actions: {
      onPlaybackToggle: onPlaybackToggle ?? (() => {}),
      onSpeedChange: onSpeedChange ?? (() => {}),
      onPlaybackModeChange: onPlaybackModeChange ?? (() => {}),
      onStepPlaybackPauseMsChange: onStepPlaybackPauseMsChange ?? (() => {}),
      onStepPlaybackStepSizeChange: onStepPlaybackStepSizeChange ?? (() => {}),
      onStepHalfBeatForward: onStepHalfBeatForward ?? (() => {}),
      onStepHalfBeatBackward: onStepHalfBeatBackward ?? (() => {}),
      onStepFullBeatForward: onStepFullBeatForward ?? (() => {}),
      onStepFullBeatBackward: onStepFullBeatBackward ?? (() => {}),
      onToggleBlue: onToggleBlue ?? (() => {}),
      onToggleRed: onToggleRed ?? (() => {}),
      onLoopCountChange: onLoopCountChange ?? (() => {}),
      onExportVideo: onExportVideo ?? (() => {}),
      onCancelExport: onCancelExport ?? (() => {}),
      onCanvasReady: onCanvasReady ?? (() => {}),
      onFormatChange: onFormatChange ?? (() => {}),
    },
  });

  // Update the context state reactively when props change
  $effect(() => {
    animationContext.state.sequenceData = animationSequenceData;
    animationContext.state.isCircular = isCircular;
    animationContext.state.isPlaying = isAnimationPlaying;
    animationContext.state.currentBeat = animationCurrentBeat;
    animationContext.state.speed = animationSpeed;
    animationContext.state.playbackMode = playbackMode;
    animationContext.state.stepPlaybackPauseMs = stepPlaybackPauseMs;
    animationContext.state.stepPlaybackStepSize = stepPlaybackStepSize;
    animationContext.state.blueMotionVisible = blueMotionVisible;
    animationContext.state.redMotionVisible = redMotionVisible;
    animationContext.state.bluePropState = animationBluePropState;
    animationContext.state.redPropState = animationRedPropState;
    animationContext.state.exportLoopCount = exportLoopCount;
    animationContext.state.isExporting = isAnimationExporting;
    animationContext.state.exportProgress = animationExportProgress;
    animationContext.state.servicesReady = animationServicesReady;
    animationContext.state.loading = animationLoading;
    animationContext.state.isSideBySideLayout = isSideBySideLayout;
    animationContext.state.selectedFormat = selectedFormat;
  });

  // Update actions when callbacks change
  $effect(() => {
    animationContext.actions.onPlaybackToggle = onPlaybackToggle ?? (() => {});
    animationContext.actions.onSpeedChange = onSpeedChange ?? (() => {});
    animationContext.actions.onPlaybackModeChange =
      onPlaybackModeChange ?? (() => {});
    animationContext.actions.onStepPlaybackPauseMsChange =
      onStepPlaybackPauseMsChange ?? (() => {});
    animationContext.actions.onStepPlaybackStepSizeChange =
      onStepPlaybackStepSizeChange ?? (() => {});
    animationContext.actions.onStepHalfBeatForward =
      onStepHalfBeatForward ?? (() => {});
    animationContext.actions.onStepHalfBeatBackward =
      onStepHalfBeatBackward ?? (() => {});
    animationContext.actions.onStepFullBeatForward =
      onStepFullBeatForward ?? (() => {});
    animationContext.actions.onStepFullBeatBackward =
      onStepFullBeatBackward ?? (() => {});
    animationContext.actions.onToggleBlue = onToggleBlue ?? (() => {});
    animationContext.actions.onToggleRed = onToggleRed ?? (() => {});
    animationContext.actions.onLoopCountChange =
      onLoopCountChange ?? (() => {});
    animationContext.actions.onExportVideo = onExportVideo ?? (() => {});
    animationContext.actions.onCancelExport = onCancelExport ?? (() => {});
    animationContext.actions.onCanvasReady = onCanvasReady ?? (() => {});
    animationContext.actions.onFormatChange = onFormatChange ?? (() => {});
  });

  // Set context once during initialization
  setAnimationExportContext(animationContext);

  // Try to get Create module context for measured tool panel width
  const createModuleContext = tryGetCreateModuleContext();

  // Get measured tool panel width (if available from Create module)
  const toolPanelWidth = $derived.by(() =>
    createModuleContext ? createModuleContext.panelState.toolPanelWidth : 0
  );

  // CSS variable for measured width (null means use CSS fallback)
  const measuredWidth = $derived(
    toolPanelWidth > 0 ? `${toolPanelWidth}px` : null
  );

  function handleClose() {
    isOpen = false;
    onClose?.();
  }

  // Pass export request through to parent coordinator
  function handleExport(format: MediaFormat, settings: SequenceViewerExportSettings) {
    // Pass through directly - the coordinator handles the actual export
    onExport?.("single", settings as ExportSettings);
  }

  // Export progress is passed directly (types align)
  const viewerExportProgress = $derived(animationExportProgress);
</script>

<div
  class="share-hub-drawer-wrapper"
  style:--measured-panel-width={measuredWidth}
>
  <Drawer
    bind:isOpen
    ariaLabel="Share Hub - Choose export format"
    onclose={handleClose}
    closeOnBackdrop={false}
    showHandle={true}
    dismissible={true}
    respectLayoutMode={true}
    placement="right"
    class="share-hub-drawer"
    backdropClass="share-hub-backdrop"
    trapFocus={false}
    preventScroll={true}
  >
    <div class="share-hub-content">
        {#if sequence}
          <SequencePreviewPanel
            {sequence}
            mode="preview"
            initialMediaType="animation"
            onClose={handleClose}
            onExport={handleExport}
            isExporting={isAnimationExporting}
            exportProgress={viewerExportProgress}
            onCustomNameChange={(value) => {
              if (sequence) {
                sequence.customName = value;
              }
            }}
          />
        {:else}
          <div class="empty-state">
            <p>No sequence to share</p>
            <button class="close-btn" onclick={handleClose}>Close</button>
          </div>
        {/if}
    </div>
  </Drawer>
</div>

<style>
  .share-hub-drawer-wrapper {
    display: contents;
  }

  /* Drawer container styling - NO BLUR to keep content behind visible */
  :global(.drawer-content.share-hub-drawer) {
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.92),
      rgba(0, 0, 0, 0.95)
    ) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      0 -8px 32px rgba(0, 0, 0, 0.5),
      0 -2px 8px var(--theme-shadow),
      inset 0 1px 0 var(--theme-card-hover-bg);
    z-index: 150 !important;
  }

  /* Desktop (right placement) - match Create module panel width */
  :global(.drawer-content.share-hub-drawer[data-placement="right"]) {
    width: var(--measured-panel-width, clamp(360px, 50vw, 1600px));
    max-width: 100vw;
    height: 100dvh;
  }

  /* Mobile (bottom placement) - Full viewport height */
  :global(.drawer-content.share-hub-drawer[data-placement="bottom"]) {
    /* Explicit height for full viewport coverage */
    height: 100dvh !important;
    max-height: 100dvh !important;
    /* Remove border radius at full height for cleaner look */
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }

  /* Ensure drawer-inner fills properly in both placements */
  :global(.drawer-content.share-hub-drawer .drawer-inner) {
    flex: 1;
    min-height: 0;
    min-width: 0;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Backdrop - Completely transparent */
  :global(.drawer-overlay.share-hub-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    pointer-events: none !important;
  }

  /* Content wrapper - ensure it fills the drawer and provides container context */
  .share-hub-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    /* Container context for responsive children */
    container-type: size;
    container-name: share-hub-content;
  }

  /* Custom Name Section */
  .custom-name-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    flex-shrink: 0;
  }

  .custom-name-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    margin: 0;
  }

  .custom-name-label i {
    font-size: 16px;
  }

  .custom-name-input {
    width: 100%;
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-md, 15px);
    outline: none;
    transition: border-color 0.2s ease;
  }

  .custom-name-input:focus {
    border-color: var(--theme-accent, rgba(59, 130, 246, 0.5));
  }

  .custom-name-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .custom-name-hint {
    font-size: var(--font-size-xs, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* Empty state fallback */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .empty-state .close-btn {
    padding: 10px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .empty-state .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.drawer-content.share-hub-drawer) {
      transition: none !important;
    }
  }
</style>
