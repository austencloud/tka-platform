<!--
  ViewerSplitPane owns split geometry and shared rendering contexts. Individual
  surfaces own their own lazy mounting, keep-alive, and practice behavior.
-->
<script lang="ts">
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import {
    getScene3DRenderContext,
    setScene3DRenderContext,
  } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { startSceneAssetPreload } from "$lib/shared/3d/services/scene-asset-preloader.svelte";
  import { foldTrailIntentIntoSettings } from "$lib/shared/effects/translators/canvas2d-translator";
  import {
    getEffectsConfigContext,
    setEffectsConfigContext,
  } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import ViewerCompanionSurface from "./ViewerCompanionSurface.svelte";
  import ViewerMotionSurface from "./ViewerMotionSurface.svelte";
  import ViewerPracticeLane from "./ViewerPracticeLane.svelte";
  import PracticeCountInOverlay from "./PracticeCountInOverlay.svelte";
  import {
    resolveViewerPanelDirection,
    resolveViewerPanelLayout,
    resolveViewerPaneRevealReady,
    type ViewerFocusedPane,
    type ViewerPanelDirection,
  } from "./viewer-panel-layout";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { ViewerSplitPaneProps } from "./viewer-split-pane-types";
  import { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import { createViewerTunnelStageState } from "../state/viewer-tunnel-stage-state.svelte";
  import { setViewerTunnelStageContext } from "../context/viewer-tunnel-stage-context";
  import "./viewer-split-pane.css";

  let {
    sequence,
    playback,
    imageComposition,
    propRendering,
    layout,
    bpm = 60,
    onBpmChange = () => {},
    onSaveToLibrary,
    onPropChange,
    onRenderProgress,
    onUnfocusPane,
    onStepClick,
    onQrPlayClick,
    onCanvasReady,
    onChoreoCardContextMenu,
    cardAutoLayoutOverride,
    cardContainSizeMotion = null,
    onAutoLayoutResolved,
    onPlaybackToggle,
    onSystemPlaybackChange,
    onProgressBarSeek,
    onProgressBarScrubStart,
    onProgressBarScrubEnd,
    playbackMode,
    onPlaybackModeChange,
    onSceneReadyChange,
    rerenderTrigger = 0,
    splitConfig = { leftPane: "animation", rightPane: "card" },
    isLoggedIn = false,
    onVideoUpload,
    onArtExport,
    onArtShare,
    artShareActive = false,
    onArtExportEvent,
    onArtSettingChange,
    onArtAction,
    onViewer3DSettingChange,
    onViewer3DAction,
    suppressProgress = false,
    practiceActive = false,
    practiceCellSize = 72,
    practiceCanvasFraction = 0.38,
    practiceRunning = false,
    practiceCountdown = 0,
    practiceMirrorEnabled = false,
    tunnelComposition = null,
    tunnelSaveTarget = null,
    onTunnelSaved,
  }: ViewerSplitPaneProps = $props();

  // The tunnel's controls, renderer, and export path all steer this one
  // controller. Keeping it above both pane surfaces lets the already-mounted 2D
  // canvas adopt the tunnel without growing a second controller or render loop.
  const tunnelController = new TunnelViewController({
    getSequence: () => playback.animationState.sequenceData ?? sequence,
    getComposition: () => tunnelComposition,
  });
  const tunnelStage = createViewerTunnelStageState(tunnelController);
  setViewerTunnelStageContext(tunnelStage);

  // Both canvas renderers share one effects state. The orchestrator normally
  // provides it; standalone shell consumers receive the same local fallback.
  const inheritedEffectsConfig = getEffectsConfigContext();
  const effectsConfigState =
    inheritedEffectsConfig ?? createEffectsConfigState();
  if (!inheritedEffectsConfig) {
    setEffectsConfigContext(effectsConfigState);
  }

  const inheritedScene3DRender = getScene3DRenderContext();
  if (!inheritedScene3DRender) {
    setScene3DRenderContext(createScene3DRenderState());
  }

  const trailSettings = $derived.by(() => {
    const animationTrail = animationSettings.trail;
    void animationTrail.mode;
    void animationTrail.fadeDurationMs;
    void animationTrail.trackingMode;
    void animationTrail.effect;
    void animationTrail.tailLength;

    const trailIntent = effectsConfigState.trails;
    void trailIntent.thickness;
    void trailIntent.brightness;
    void trailIntent.blueColor;
    void trailIntent.redColor;

    const settings = foldTrailIntentIntoSettings(animationTrail, trailIntent);
    if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
      const blue = propRendering.bluePropType;
      const red = propRendering.redPropType;
      const hasBilateral =
        (blue != null && isBilateralProp(String(blue))) ||
        (red != null && isBilateralProp(String(red)));
      if (!hasBilateral) settings.trackingMode = TrackingMode.RIGHT_END;
    }

    return settings;
  });

  let splitWidth = $state(
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  let splitHeight = $state(
    typeof window !== "undefined" ? window.innerHeight : 0
  );
  let animationPanelWidth = $state(0);
  let animationPanelHeight = $state(0);
  let previewPanelWidth = $state(0);
  let previewPanelHeight = $state(0);
  let animationPanelReady = $state(false);
  let previewPanelReady = $state(false);
  const viewerFocusedPane = $derived<"animation" | "image" | null>(
    layout.focusedPane === "animation" || layout.focusedPane === "image"
      ? layout.focusedPane
      : null
  );
  const adaptiveVerticalSplit = $derived(
    !practiceActive &&
      layout.focusedPane === null &&
      !layout.isMobile &&
      !layout.isFullscreen &&
      splitHeight > splitWidth
  );
  const responsivePanelLayout = $derived(
    resolveViewerPanelLayout({
      isFullscreen: layout.isFullscreen,
      fullscreenStackVertical: layout.fullscreenStackVertical,
      isMobile: layout.isMobile,
      isLandscapeMobile: layout.isLandscapeMobile,
      adaptiveVerticalSplit,
      focusedPane: viewerFocusedPane,
      practiceActive,
      practiceCanvasFraction,
    })
  );
  let retainedSplitDirection = $state<ViewerPanelDirection | null>(null);
  let focusReleasePending = $state(false);
  let previousFocusedPane: ViewerFocusedPane = viewerFocusedPane;
  let directionReleaseTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const focusedPane = viewerFocusedPane;
    const responsiveDirection = responsivePanelLayout.direction;

    if (practiceActive) {
      clearTimeout(directionReleaseTimer);
      directionReleaseTimer = undefined;
      focusReleasePending = false;
      retainedSplitDirection = responsiveDirection;
    } else if (retainedSplitDirection === null) {
      retainedSplitDirection = responsiveDirection;
    }

    if (!practiceActive && focusedPane !== null) {
      clearTimeout(directionReleaseTimer);
      directionReleaseTimer = undefined;
      focusReleasePending = false;
    } else if (
      !practiceActive &&
      previousFocusedPane !== null &&
      focusedPane === null
    ) {
      clearTimeout(directionReleaseTimer);
      const duration = motionDuration(DURATION.emphasis);
      focusReleasePending = duration > 0;
      if (duration > 0) {
        directionReleaseTimer = setTimeout(() => {
          directionReleaseTimer = undefined;
          focusReleasePending = false;
        }, duration);
      }
    } else if (!practiceActive && !focusReleasePending) {
      retainedSplitDirection = responsiveDirection;
    }

    previousFocusedPane = focusedPane;
  });

  $effect(() => () => clearTimeout(directionReleaseTimer));

  const panelDirection = $derived(
    resolveViewerPanelDirection({
      responsiveDirection: responsivePanelLayout.direction,
      retainedSplitDirection,
      focusedPane: practiceActive ? null : viewerFocusedPane,
      focusReleasePending: !practiceActive && focusReleasePending,
    })
  );
  const panelLayout = $derived({
    ...responsivePanelLayout,
    direction: panelDirection,
  });
  $effect.pre(() => {
    // Clear the covered pane's bound measurements before focus is released.
    // Its first split-mode measurement is therefore guaranteed to be fresh,
    // rather than the large value it had before the focus transition began.
    if (viewerFocusedPane === "image") {
      animationPanelWidth = 0;
      animationPanelHeight = 0;
    } else if (viewerFocusedPane === "animation") {
      previewPanelWidth = 0;
      previewPanelHeight = 0;
    }
  });
  $effect(() => {
    animationPanelReady = resolveViewerPaneRevealReady({
      pane: "animation",
      focusedPane: viewerFocusedPane,
      direction: panelLayout.direction,
      width: animationPanelWidth,
      height: animationPanelHeight,
    });
    previewPanelReady = resolveViewerPaneRevealReady({
      pane: "image",
      focusedPane: viewerFocusedPane,
      direction: panelLayout.direction,
      width: previewPanelWidth,
      height: previewPanelHeight,
    });
  });

  // During the practice layout glide, CSS scales the current canvas buffer.
  // Resume rasterization once the 300ms workspace transition has settled.
  let practiceResizePaused = $state(false);
  let previousPracticeActive = practiceActive;
  let resizeResumeTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const active = practiceActive;
    if (active === previousPracticeActive) return;
    previousPracticeActive = active;
    const reduceMotion =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    practiceResizePaused = true;
    clearTimeout(resizeResumeTimer);
    resizeResumeTimer = setTimeout(() => (practiceResizePaused = false), 340);
  });
  $effect(() => () => clearTimeout(resizeResumeTimer));

  const needs3D = $derived(
    splitConfig.leftPane === "animation-3d" ||
      splitConfig.rightPane === "animation-3d"
  );
  $effect(() => {
    if (needs3D) startSceneAssetPreload();
  });
  const needsTunnel = $derived(
    splitConfig.leftPane === "tunnel" || splitConfig.rightPane === "tunnel"
  );
  let tunnelReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    clearTimeout(tunnelReleaseTimer);
    tunnelReleaseTimer = undefined;

    if (needsTunnel) {
      tunnelController.active = true;
      return;
    }

    const releaseDelay = motionDuration(DURATION.emphasis);
    if (releaseDelay === 0) {
      tunnelController.active = false;
      return;
    }

    // The shared canvas fades its tunnel layers away after the mode changes.
    // Keep the controller's rendered layers alive for that final envelope so
    // leaving Tunnel never collapses into an abrupt one-frame disappearance.
    tunnelReleaseTimer = setTimeout(() => {
      tunnelReleaseTimer = undefined;
      tunnelController.active = false;
    }, releaseDelay);
  });
  $effect(() => () => clearTimeout(tunnelReleaseTimer));
</script>

{#snippet animationPanel()}
  <div
    class="split-column animation-column"
    class:focused={layout.focusedPane === "animation"}
    data-hidden={layout.focusedPane === "image"}
    data-readable={animationPanelReady}
    inert={layout.focusedPane === "image"}
    aria-hidden={layout.focusedPane === "image"}
    bind:clientWidth={animationPanelWidth}
    bind:clientHeight={animationPanelHeight}
  >
    <ViewerMotionSurface
      side="left"
      {sequence}
      {playback}
      {propRendering}
      {layout}
      {splitConfig}
      {trailSettings}
      {bpm}
      {onBpmChange}
      {onSaveToLibrary}
      {onUnfocusPane}
      {onCanvasReady}
      {onPlaybackToggle}
      {onSystemPlaybackChange}
      {onProgressBarSeek}
      {onProgressBarScrubStart}
      {onProgressBarScrubEnd}
      {playbackMode}
      {onPlaybackModeChange}
      {onSceneReadyChange}
      {onViewer3DSettingChange}
      {onViewer3DAction}
      {suppressProgress}
      {practiceActive}
      {practiceMirrorEnabled}
      {practiceResizePaused}
    />
    <ViewerCompanionSurface
      side="left"
      {sequence}
      {playback}
      {imageComposition}
      {propRendering}
      {layout}
      {splitConfig}
      {bpm}
      {onBpmChange}
      {onSaveToLibrary}
      {onPropChange}
      {onRenderProgress}
      {onUnfocusPane}
      {onStepClick}
      {onQrPlayClick}
      {onChoreoCardContextMenu}
      {cardAutoLayoutOverride}
      {cardContainSizeMotion}
      {onAutoLayoutResolved}
      {onPlaybackToggle}
      {playbackMode}
      {onPlaybackModeChange}
      {rerenderTrigger}
      {isLoggedIn}
      {onVideoUpload}
      {onArtExport}
      {onArtShare}
      {artShareActive}
      {onArtExportEvent}
      {onArtSettingChange}
      {onArtAction}
      {tunnelComposition}
      {tunnelSaveTarget}
      {onTunnelSaved}
    />
    <PracticeCountInOverlay count={practiceCountdown} />
  </div>
{/snippet}

{#snippet previewPanel()}
  <div
    class="split-column preview-column"
    class:focused={layout.focusedPane === "image"}
    data-hidden={layout.focusedPane === "animation"}
    data-readable={previewPanelReady}
    inert={layout.focusedPane === "animation"}
    aria-hidden={layout.focusedPane === "animation"}
    bind:clientWidth={previewPanelWidth}
    bind:clientHeight={previewPanelHeight}
  >
    <div
      class="preview-column-inner"
      class:focused={layout.focusedPane === "image"}
    >
      <ViewerMotionSurface
        side="right"
        {sequence}
        {playback}
        {propRendering}
        {layout}
        {splitConfig}
        {trailSettings}
        {bpm}
        {onBpmChange}
        {onSaveToLibrary}
        {onUnfocusPane}
        {onCanvasReady}
        {onPlaybackToggle}
        {onSystemPlaybackChange}
        {onProgressBarSeek}
        {onProgressBarScrubStart}
        {onProgressBarScrubEnd}
        {playbackMode}
        {onPlaybackModeChange}
        {onSceneReadyChange}
        {onViewer3DSettingChange}
        {onViewer3DAction}
        {suppressProgress}
        {practiceActive}
        {practiceMirrorEnabled}
        {practiceResizePaused}
      />
      <ViewerCompanionSurface
        side="right"
        {sequence}
        {playback}
        {imageComposition}
        {propRendering}
        {layout}
        {splitConfig}
        {bpm}
        {onBpmChange}
        {onSaveToLibrary}
        {onPropChange}
        {onRenderProgress}
        {onUnfocusPane}
        {onStepClick}
        {onQrPlayClick}
        {onChoreoCardContextMenu}
        {cardAutoLayoutOverride}
        {cardContainSizeMotion}
        {onAutoLayoutResolved}
        {onPlaybackToggle}
        {playbackMode}
        {onPlaybackModeChange}
        {rerenderTrigger}
        {isLoggedIn}
        {onVideoUpload}
        {onArtExport}
        {onArtShare}
        {artShareActive}
        {onArtExportEvent}
        {onArtSettingChange}
        {onArtAction}
        {tunnelComposition}
        {tunnelSaveTarget}
        {onTunnelSaved}
      />
      {#if practiceActive}
        <ViewerPracticeLane
          {playback}
          {propRendering}
          {bpm}
          cellSize={practiceCellSize}
          running={practiceRunning}
          countdown={practiceCountdown}
          onSeek={onProgressBarSeek}
        />
      {/if}
    </div>
  </div>
{/snippet}

<div
  class="split-view view-container"
  class:practice={practiceActive}
  bind:clientWidth={splitWidth}
  bind:clientHeight={splitHeight}
  data-panel-direction={panelLayout.direction}
  data-focused={layout.focusedPane}
>
  <PanelGroup
    direction={panelLayout.direction}
    sizes={panelLayout.sizes}
    gap={0}
    panels={[
      { id: "animation", content: animationPanel, resizable: false },
      {
        id: "preview",
        content: previewPanel,
        resizable: false,
        preferredSize: panelLayout.previewPreferredSize,
      },
    ]}
  />
</div>
