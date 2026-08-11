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
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import ViewerCompanionSurface from "./ViewerCompanionSurface.svelte";
  import ViewerMotionSurface from "./ViewerMotionSurface.svelte";
  import ViewerPracticeLane from "./ViewerPracticeLane.svelte";
  import PracticeCountInOverlay from "./PracticeCountInOverlay.svelte";
  import type { ViewerSplitPaneProps } from "./viewer-split-pane-types";
  import "./viewer-split-pane.css";

  let {
    sequence,
    playback,
    imageComposition,
    propRendering,
    layout,
    bpm = 60,
    onBpmChange = () => {},
    onPropChange,
    onRenderProgress,
    onUnfocusPane,
    onStepClick,
    onQrPlayClick,
    onCanvasReady,
    onChoreoCardContextMenu,
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
    onSceneShare,
    suppressProgress = false,
    practiceActive = false,
    practiceCellSize = 72,
    practiceCanvasFraction = 0.38,
    practiceRunning = false,
    practiceCountdown = 0,
    practiceMirrorEnabled = false,
  }: ViewerSplitPaneProps = $props();

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
  const adaptiveVerticalSplit = $derived(
    !practiceActive &&
      layout.focusedPane === null &&
      !layout.isMobile &&
      !layout.isFullscreen &&
      splitHeight > splitWidth
  );

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
</script>

<div
  class="split-view view-container"
  class:practice={practiceActive}
  bind:clientWidth={splitWidth}
  bind:clientHeight={splitHeight}
  style="--canvas-frac: {practiceCanvasFraction};"
  data-fullscreen-stack={layout.isFullscreen
    ? layout.fullscreenStackVertical
      ? "vertical"
      : "horizontal"
    : undefined}
  data-landscape={layout.isLandscapeMobile || undefined}
  data-adaptive-stack={adaptiveVerticalSplit || undefined}
  data-focused={layout.focusedPane}
>
  <div
    class="split-column animation-column"
    class:focused={layout.focusedPane === "animation"}
    data-hidden={layout.focusedPane === "image"}
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
      {onSceneShare}
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
      {onPropChange}
      {onRenderProgress}
      {onUnfocusPane}
      {onStepClick}
      {onQrPlayClick}
      {onChoreoCardContextMenu}
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
    />
    <PracticeCountInOverlay count={practiceCountdown} />
  </div>

  <div
    class="split-column preview-column"
    class:focused={layout.focusedPane === "image"}
    data-hidden={layout.focusedPane === "animation"}
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
        {onSceneShare}
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
        {onPropChange}
        {onRenderProgress}
        {onUnfocusPane}
        {onStepClick}
        {onQrPlayClick}
        {onChoreoCardContextMenu}
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
</div>
