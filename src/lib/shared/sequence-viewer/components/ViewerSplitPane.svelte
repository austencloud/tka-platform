<!--
  ViewerSplitPane.svelte

  Split view pane for the sequence viewer modal.
  Shows animation on one side, choreo card preview on the other.
  Supports focus mode (tap to expand one pane).
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type {
    ViewerPlaybackState,
    ImageCompositionProps,
    PropRenderingProps,
    ViewerLayoutState,
  } from "../domain/viewer-prop-groups";
  import type { SplitConfig } from "../services/viewer-state-persistence";
  import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import RightRail from "./RightRail.svelte";
  import VideoGallery from "./VideoGallery.svelte";
  import ArtPane from "./ArtPane.svelte";
  import PracticeLanePane from "./PracticeLanePane.svelte";
  import PracticeCountInOverlay from "./PracticeCountInOverlay.svelte";
  import CameraPreview from "$lib/shared/train/components/CameraPreview.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { foldTrailIntentIntoSettings } from "$lib/shared/effects/translators/canvas2d-translator";
  import {
    setEffectsConfigContext,
    getEffectsConfigContext,
  } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import {
    setScene3DRenderContext,
    getScene3DRenderContext,
  } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { startSceneAssetPreload } from "$lib/shared/3d/services/scene-asset-preloader.svelte";
  import { createPaneKeepAlive } from "./pane-keep-alive.svelte";
  import type { ArtExportEventSink } from "../domain/art-export-analytics";
  import type {
    ViewerActionSink,
    ViewerControlSink,
  } from "../domain/viewer-control-analytics";

  // Derive trail settings from the global singleton so canvas settings changes
  // (e.g. switching from "one end" to "both ends") propagate to this canvas.
  // Also enforces unilateral prop constraint: props with one meaningful endpoint
  // (fan, club, minihoop, etc.) always use RIGHT_END regardless of stored preference.
  const trailSettings = $derived.by(() => {
    // Visual dials (thickness/brightness/colors) live on effectsConfig.trails;
    // rendering params (mode/fade/tracking/tailLength) stay on animationSettings.
    // The 2D overlay reads only TrailSettings, so fold both stores here — else the
    // trail thickness/brightness/colour dials mutate a store the renderer never reads.
    const t = animationSettings.trail;
    void t.mode;
    void t.fadeDurationMs;
    void t.trackingMode;
    void t.effect;
    void t.tailLength;
    const intent = effectsConfigState.trails;
    void intent.thickness;
    void intent.brightness;
    void intent.blueColor;
    void intent.redColor;

    const settings = foldTrailIntentIntoSettings(t, intent);

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

  // Canonical effects config - single source of truth for both 2D canvas
  // and 3D viewer effect parameters. Reuse the parent context if one is set
  // (SequenceViewerOrchestrator owns this so ExportVideoDrawer's EffectsPanel
  // can read the same state). Fall back to creating our own when standalone.
  const inheritedEffectsConfig = getEffectsConfigContext();
  const effectsConfigState =
    inheritedEffectsConfig ?? createEffectsConfigState();
  if (!inheritedEffectsConfig) {
    setEffectsConfigContext(effectsConfigState);
  }

  // Scene-wide 3D render modifiers (motion blur + speed lines).
  // Inherit from parent context when present; otherwise own it.
  const inheritedScene3DRender = getScene3DRenderContext();
  if (!inheritedScene3DRender) {
    setScene3DRenderContext(createScene3DRenderState());
  }

  interface Props {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    imageComposition: ImageCompositionProps;
    propRendering: PropRenderingProps;
    layout: ViewerLayoutState;
    renderMode?: "2d" | "3d";
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
    /** Change the prop type from the tunnel/mandala Props rail. Threaded down to
     *  ArtPane → ArtSettingsPanel. */
    onPropChange?: (
      propType: import("$lib/shared/pictograph/prop/domain/enums/prop-type").PropType
    ) => void;
    onRenderProgress?: (loaded: number, total: number) => void;
    onFocusPane: (pane: "animation" | "image") => void;
    onUnfocusPane: () => void;
    onStepClick: (stepIndex: number) => void;
    /** Provided only by the interactive viewer: click the QR play badge in a
        Card pane to switch to 2D animation and start playback. */
    onQrPlayClick?: () => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    onChoreoCardContextMenu?: (x: number, y: number) => void;
    /** Receives Auto geometry from whichever card pane is currently visible. */
    onAutoLayoutResolved?: (layout: ResolvedAutoLayout | null) => void;
    onPlaybackToggle?: () => void;
    onSystemPlaybackChange?: (
      playing: boolean,
      source: "system_3d_loading"
    ) => void;
    onProgressBarSeek?: (targetStep: number) => void;
    onProgressBarScrubStart?: () => void;
    onProgressBarScrubEnd?: () => void;
    playbackMode?: "continuous" | "step";
    onPlaybackModeChange?: (mode: "continuous" | "step") => void;
    /** Forwarded from the 3D canvas load gate (first-load latched). Lets the host
        withhold sibling chrome — e.g. the Record Scene pill — until the stage is
        set, matching the in-pane rail gate. */
    onSceneReadyChange?: (ready: boolean) => void;
    rerenderTrigger?: number;
    /**
     * When true, the tap-to-focus handlers on both panes are suppressed
     * so the user can't accidentally resize the canvas mid-export. Resizing
     * the 3D canvas during a recording causes the source shape to change
     * under the frame grabber, producing a squished/expanding video.
     */
    isExporting?: boolean;
    splitConfig?: SplitConfig;
    isLoggedIn?: boolean;
    onVideoUpload?: () => void;
    /**
     * Art-mode video export entry. Resolved by the orchestrator (it owns the
     * live panelState / playbackController / canvas the offscreen renderer
     * needs). Omitted on surfaces without those (e.g. QR landing) — the Art
     * rail's Export button is then inert.
     */
    onArtExport?: (args: {
      artType: "mandala" | "tunnel";
      controller: import("../tunnel/tunnel-view-controller.svelte").TunnelViewController;
      mandalaController: import("../state/mandala-viewer-controller.svelte").MandalaViewerController;
    }) => void;
    onArtExportEvent?: ArtExportEventSink;
    /** Semantic settings sink supplied by the scan host through the shared shell. */
    onArtSettingChange?: (
      group: string,
      setting: string,
      previousValue: string | number | boolean | null,
      value: string | number | boolean | null,
      coalesce?: boolean,
      source?: string
    ) => void;
    onArtAction?: ViewerActionSink;
    /** Optional QR-only semantic sink for shared 3D rail controls. */
    onViewer3DSettingChange?: ViewerControlSink;
    onViewer3DAction?: ViewerActionSink;
    /**
     * Hide ALL playback transport (the canvas scrubber AND the portrait mobile
     * transport bar). For surfaces where another pane already indicates progress
     * — e.g. the QR scan page's Side-by-Side, where the choreo card's highlighted
     * step is the progress readout, so a scrubber under the animation is noise.
     */
    suppressProgress?: boolean;
    /** When true, renders PracticeLanePane in the right pane instead of the normal preview. */
    practiceActive?: boolean;
    /** Cell size (px) forwarded to PracticeLanePane / StepStrip. */
    practiceCellSize?: number;
    /** Fraction of total width given to the animation canvas column in practice mode. */
    practiceCanvasFraction?: number;
    /** True while the ramp is actually running (vs. the setup screen). */
    practiceRunning?: boolean;
    /** Count-in value over the canvas: 3/2/1 while counting in, 0 = hidden. */
    practiceCountdown?: number;
    /** Passive AR mirror: webcam feed behind a transparent practice canvas. */
    practiceMirrorEnabled?: boolean;
  }

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
    isExporting = false,
    splitConfig = { leftPane: "animation", rightPane: "card" },
    isLoggedIn = false,
    onVideoUpload,
    onArtExport,
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
  }: Props = $props();

  // Two square-first previews fit the available area best when their split
  // follows the stage's shape. The viewport breakpoint alone misses embedded
  // viewers and portrait desktop windows, where a horizontal split creates two
  // tall slivers. Element-size bindings track the real stage after the rail and
  // export panels have claimed their space.
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

  // The canvas glide on practice enter/exit is owned by CSS, not JS: the drawer
  // host animates the content rail's `max-width` collapse over --ws-dur, so the
  // split-view (and the canvas column inside it) grows smoothly into the freed
  // space. A composited layout transition reads as one continuous motion — no
  // FLIP needed. (A JS re-measuring FLIP lived here; it fought the layout instead
  // of removing the snap and is gone.)
  //
  // The glide resizes the canvas continuously for --ws-dur. Left live, the 2D
  // engine's ResizeObserver would re-rasterize the canvas every frame (clearing +
  // redrawing the buffer) — the same cost the disassemble transition avoids. So
  // pause the engine's resize for the duration of the toggle: the canvas
  // CSS-scales its existing buffer on the compositor (60fps), then re-rasterizes
  // ONCE at the settled size when we resume. Mirrors AnimatorCanvas's own
  // pauseResize/resumeResize around the disassemble width transition.
  let _practiceResizePaused = $state(false);
  let _prevPracticeActive = practiceActive;
  let _resizeResumeTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const active = practiceActive;
    if (active === _prevPracticeActive) return; // skip initial mount; only react to toggles
    _prevPracticeActive = active;
    const reduce =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // reduced motion snaps instantly → single resize, nothing to pause
    _practiceResizePaused = true;
    clearTimeout(_resizeResumeTimer);
    // --ws-dur (300ms) + a frame of slack so resume lands after the layout settles.
    _resizeResumeTimer = setTimeout(() => (_practiceResizePaused = false), 340);
  });
  $effect(() => () => clearTimeout(_resizeResumeTimer));

  // Pre-roll latch for the read-ahead lane's start tile. `showStartCell` must stay
  // true while the canvas is parked on the start pose and flip only once the canvas
  // actually LEAVES it (first reaches beat 1). A bare `practiceCountdown > 0` flips
  // at the GO tick while currentStep is still 0 — at a 15-BPM start tempo the canvas
  // then holds the start pose for ~4s while the lane has already popped to beat 1.
  // One-way: never flips back on a loop wrap (start ≡ end, dropped each loop).
  let _laneAtStart = $state(true);
  $effect(() => {
    if (practiceCountdown > 0) {
      _laneAtStart = true; // count-in: canvas parked at start → lane focuses the start tile
    } else if (practiceRunning && playback.currentStep >= 1) {
      _laneAtStart = false; // canvas reached beat 1 → lane switches to beats, in sync
    } else if (!practiceActive) {
      _laneAtStart = true; // reset out of practice so the next Start begins parked
    }
  });

  // Three.js / Threlte is multi-MB. The 3D canvas + performer hub are only
  // imported once a 3D pane is actually activated, so any chunk that touches
  // ViewerSplitPane (e.g. the lightweight QR landing page, which never sets a
  // 3D pane) stays Three-free until/unless the user opens a 3D view.
  const loadViewer3DCanvas = () =>
    import("$lib/shared/3d/components/Viewer3DCanvas.svelte");
  const loadPerformerHub = () =>
    import("$lib/shared/3d/components/controls/PerformerHub.svelte");
  const needs3D = $derived(
    splitConfig.leftPane === "animation-3d" ||
      splitConfig.rightPane === "animation-3d"
  );

  // Preload heavy 3D scene assets only when a 3D pane is in play — keeps the
  // 3D asset-loader import path off 2D-only pages.
  $effect(() => {
    if (needs3D) startSceneAssetPreload();
  });

  function handleCloseClick(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    onUnfocusPane();
  }

  // Scene load gate: the 3D viewer surface (canvas + transport + rail) stays
  // behind the loading curtain until every enabled async scene feature is ready.
  // The canvas owns the curtain + transport hold; this gates the sibling rail
  // chrome (RightRail + PerformerHub) that lives outside the canvas pane. Latched
  // true by the child on first load — never re-hides on pane switches.
  let _scene3dReady = $state(false);

  // Persist canvases once activated — avoids full teardown+rebuild on pane switch.
  let _3dLeftMounted = $state(false);
  const _3dLeftActive = $derived(splitConfig.leftPane === "animation-3d");
  $effect(() => {
    if (_3dLeftActive) _3dLeftMounted = true;
  });

  let _2dLeftMounted = $state(false);
  const _2dLeftActive = $derived(splitConfig.leftPane === "animation");
  $effect(() => {
    if (_2dLeftActive) _2dLeftMounted = true;
  });

  // Portrait-mobile still hides the 2D canvas word-header to reclaim vertical
  // space (the transport itself is now the in-canvas tap-to-play + thin seekable
  // line on every size — no relocated transport bar).
  const showMobileTransport = $derived(
    layout.isMobile &&
      !layout.isLandscapeMobile &&
      _2dLeftActive &&
      (!layout.focusedPane || layout.focusedPane === "animation")
  );

  let _2dRightMounted = $state(false);
  const _2dRightActive = $derived(splitConfig.rightPane === "animation");
  $effect(() => {
    if (_2dRightActive) _2dRightMounted = true;
  });

  // Companion panes (Card / Videos / Mandala / Tunnel) stay mounted after first
  // activation and toggle via a hidden class — see createPaneKeepAlive for the
  // reveal timing (and the stale-frame guard that keeps a pane deselected
  // during boot from painting over the split view).
  const _cardLeft = createPaneKeepAlive(() => splitConfig.leftPane === "card");
  const _videosLeft = createPaneKeepAlive(
    () => splitConfig.leftPane === "videos"
  );
  const _mandalaLeft = createPaneKeepAlive(
    () => splitConfig.leftPane === "mandala"
  );
  const _tunnelLeft = createPaneKeepAlive(
    () => splitConfig.leftPane === "tunnel"
  );
  const _cardRight = createPaneKeepAlive(
    () => splitConfig.rightPane === "card"
  );
  const _videosRight = createPaneKeepAlive(
    () => splitConfig.rightPane === "videos"
  );
  const _mandalaRight = createPaneKeepAlive(
    () => splitConfig.rightPane === "mandala"
  );
  const _tunnelRight = createPaneKeepAlive(
    () => splitConfig.rightPane === "tunnel"
  );

  let _pane2d: HTMLDivElement | undefined = $state();
  let _pane3d: HTMLDivElement | undefined = $state();
  let _rail2d: HTMLDivElement | undefined = $state();
  let _rail3d: HTMLDivElement | undefined = $state();
  let _prevLeftPane = $state(splitConfig.leftPane);

  $effect(() => {
    const cur = splitConfig.leftPane;
    if (cur === _prevLeftPane) return;
    const from = _prevLeftPane;
    _prevLeftPane = cur;

    const outPane =
      from === "animation" ? _pane2d : from === "animation-3d" ? _pane3d : null;
    const outRail =
      from === "animation" ? _rail2d : from === "animation-3d" ? _rail3d : null;
    if (!outPane) return;

    const w = outPane.getBoundingClientRect().width + "px";
    outPane.style.width = w;
    if (outRail) outRail.style.width = w;

    setTimeout(() => {
      if (outPane.isConnected) outPane.style.width = "";
      if (outRail?.isConnected) outRail.style.width = "";
    }, 250);
  });
</script>

{#snippet viewer3DLoading()}
  <div
    class="loading-state viewer-3d-load-state"
    role="status"
    aria-label="Loading 3D viewer"
  >
    <ProgressRing percent={-1} size={32} strokeWidth={3} />
  </div>
{/snippet}

{#snippet viewer3DError(_error: unknown, retry: () => void)}
  <div class="error-state viewer-3d-load-state" role="alert">
    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
    <span>3D viewer couldn't load. Check your connection and try again.</span>
    <PanelButton variant="secondary" onclick={retry}>
      <i class="fas fa-rotate-right" aria-hidden="true"></i>
      <span>Try again</span>
    </PanelButton>
  </div>
{/snippet}

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
  <!-- Animation pane -->
  <div
    class="split-column animation-column"
    class:focused={layout.focusedPane === "animation"}
    data-hidden={layout.focusedPane === "image"}
  >
    <!-- Persistent 3D canvas — stays mounted after first activation to preserve
         WebGL context, loaded GLBs, and generated SDF textures across pane switches. -->
    {#if _3dLeftMounted}
      <div
        bind:this={_pane3d}
        class="media-pane animation-pane persistent-3d"
        class:persistent-3d-hidden={!_3dLeftActive}
      >
        {#if _3dLeftActive && layout.focusedPane === "animation" && !layout.isMobile && !layout.suppressCloseButton}
          <div
            class="pane-close-btn"
            role="button"
            tabindex="0"
            onclick={handleCloseClick}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleCloseClick(e);
            }}
            aria-label="Exit focus mode"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </div>
        {/if}

        <div
          class="canvas-layer canvas-3d-layer"
          style="opacity:1;pointer-events:auto;"
        >
          <LazyMount
            loader={loadViewer3DCanvas}
            active={_3dLeftActive}
            debugName="3D viewer canvas"
            placeholder={viewer3DLoading}
            error={viewer3DError}
            props={{
              sequenceData: playback.animationState.sequenceData,
              currentStep: playback.currentStep,
              isPlaying: playback.isPlaying,
              bpm,
              onBpmChange,
              bluePropType:
                propRendering.bluePropType != null
                  ? String(propRendering.bluePropType)
                  : null,
              redPropType:
                propRendering.redPropType != null
                  ? String(propRendering.redPropType)
                  : null,
              hideOverlays: false,
              fullScreen: layout.focusedPane === "animation",
              onExitFullScreen: onUnfocusPane,
              onPlaybackToggle,
              onSystemPlaybackChange,
              onProgressBarSeek,
              playbackMode,
              onPlaybackModeChange,
              onSettingChange: onViewer3DSettingChange,
              onSceneReadyChange: (ready: boolean) => {
                _scene3dReady = ready;
                onSceneReadyChange?.(ready);
              },
            }}
          />
        </div>
      </div>
    {/if}

    {#if _2dLeftMounted}
      <div
        bind:this={_pane2d}
        class="media-pane animation-pane persistent-2d"
        class:persistent-2d-hidden={!_2dLeftActive}
      >
        {#if _2dLeftActive && layout.focusedPane === "animation" && !layout.isMobile && !layout.suppressCloseButton}
          <div
            class="pane-close-btn"
            role="button"
            tabindex="0"
            onclick={handleCloseClick}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleCloseClick(e);
            }}
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
          {#if practiceActive && practiceMirrorEnabled}
            <div class="practice-mirror-layer">
              <CameraPreview mirrored={true} />
            </div>
          {/if}
          <div
            class="canvas-layer canvas-2d-layer"
            style="opacity:1;pointer-events:auto;"
          >
            <AnimatorCanvas
              sequenceData={playback.animationState.sequenceData}
              currentStep={playback.currentStep}
              isPlaying={playback.isPlaying}
              virtualTime={playback.animationState.virtualTime}
              blueProp={playback.animationState.bluePropState}
              redProp={playback.animationState.redPropState}
              gridMode={sequence?.gridMode}
              letter={playback.currentLetter}
              stepData={playback.currentStepData}
              word={sequence?.word}
              bluePropType={propRendering.bluePropType}
              redPropType={propRendering.redPropType}
              backgroundAlpha={practiceActive && practiceMirrorEnabled ? 0 : 1}
              {trailSettings}
              {onCanvasReady}
              {onPlaybackToggle}
              onProgressBarSeek={onProgressBarSeek ?? null}
              onProgressBarScrubStart={onProgressBarScrubStart ?? null}
              onProgressBarScrubEnd={onProgressBarScrubEnd ?? null}
              focused={layout.focusedPane === "animation"}
              suppress2DOverlays={false}
              hideProgressBar={suppressProgress}
              hideHeader={showMobileTransport}
              tapToToggle={true}
              progressLine={true}
              resizePaused={_practiceResizePaused}
            />
          </div>
        {/if}
      </div>
    {/if}

    {#if _2dLeftMounted}
      <div
        bind:this={_rail2d}
        class="persistent-rail"
        class:persistent-rail-hidden={!_2dLeftActive}
      >
        <RightRail renderMode="2d" />
      </div>
    {/if}
    {#if _3dLeftMounted}
      <!-- Rail withheld until the scene load gate opens, so it fades in with the
           curtain lift instead of showing over a black "Setting the stage" pane. -->
      <div
        bind:this={_rail3d}
        class="persistent-rail"
        class:persistent-rail-hidden={!_3dLeftActive || !_scene3dReady}
      >
        <RightRail
          renderMode="3d"
          {bpm}
          onSettingChange={onViewer3DSettingChange}
          onAction={onViewer3DAction}
        />
        <LazyMount
          loader={loadPerformerHub}
          active={_3dLeftActive}
          debugName="3D performer controls"
          props={{ onSettingChange: onViewer3DSettingChange }}
        />
      </div>
    {/if}

    {#if _cardLeft.mounted}
      <div
        class="media-pane preview-pane content-overlay"
        class:content-overlay-hidden={!_cardLeft.shown}
      >
        <ChoreoCard
          {sequence}
          highlightedStepIndex={playback.highlightedStepIndex}
          showHighlight={playback.isPlaying ||
            playback.highlightedStepIndex !== null}
          {onStepClick}
          {onQrPlayClick}
          clickableStart
          {onRenderProgress}
          showWord={imageComposition.showWord}
          showStepNumbers={imageComposition.showStepNumbers}
          showDifficultyLevel={imageComposition.showDifficulty}
          includeStartPosition={imageComposition.showStartPos}
          showCreatorName={imageComposition.showCreatorName}
          showNotes={imageComposition.showNotes}
          showQRCode={imageComposition.showQRCode}
          showMandala={imageComposition.showMandala ?? false}
          showBirthday={imageComposition.showBirthday}
          showLoopGlyph={imageComposition.showLoopGlyph ?? true}
          handPathMode={imageComposition.handPathMode}
          darkMode={imageComposition.darkMode}
          columnCount={imageComposition.columnCount}
          forceContain={imageComposition.forceContain}
          fitWidth={false}
          userName={imageComposition.userName}
          bluePropType={propRendering.bluePropType}
          redPropType={propRendering.redPropType}
          catDogModeEnabled={propRendering.catDogModeEnabled}
          {rerenderTrigger}
          onContextMenu={onChoreoCardContextMenu}
          onAutoLayoutResolved={_cardLeft.shown
            ? onAutoLayoutResolved
            : undefined}
        />
      </div>
    {/if}
    {#if _videosLeft.mounted}
      <div
        class="media-pane content-overlay"
        class:content-overlay-hidden={!_videosLeft.shown}
      >
        <VideoGallery
          {sequence}
          isOwned={false}
          {isLoggedIn}
          onUpload={onVideoUpload}
        />
      </div>
    {/if}
    {#if _mandalaLeft.mounted}
      <div
        class="media-pane content-overlay"
        class:content-overlay-hidden={!_mandalaLeft.shown}
      >
        <ArtPane
          artType="mandala"
          {sequence}
          {playback}
          bluePropType={propRendering.bluePropType != null
            ? String(propRendering.bluePropType)
            : undefined}
          redPropType={propRendering.redPropType != null
            ? String(propRendering.redPropType)
            : undefined}
          {bpm}
          {onBpmChange}
          {playbackMode}
          {onPlaybackModeChange}
          onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          layout={layout.isMobile ? "bottom" : "sidebar"}
          {onPropChange}
          {onArtExport}
          {onArtExportEvent}
          {onArtSettingChange}
          {onArtAction}
        />
      </div>
    {/if}
    {#if _tunnelLeft.mounted}
      <div
        class="media-pane content-overlay"
        class:content-overlay-hidden={!_tunnelLeft.shown}
      >
        <ArtPane
          artType="tunnel"
          {sequence}
          {playback}
          bluePropType={propRendering.bluePropType != null
            ? String(propRendering.bluePropType)
            : undefined}
          redPropType={propRendering.redPropType != null
            ? String(propRendering.redPropType)
            : undefined}
          {bpm}
          {onBpmChange}
          {playbackMode}
          {onPlaybackModeChange}
          onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          layout={layout.isMobile ? "bottom" : "sidebar"}
          {onPropChange}
          {onArtExport}
          {onArtExportEvent}
          {onArtSettingChange}
          {onArtAction}
        />
      </div>
    {/if}

    <PracticeCountInOverlay count={practiceCountdown} />
  </div>

  <!-- Image/Preview pane -->
  <div
    class="split-column preview-column"
    class:focused={layout.focusedPane === "image"}
    data-hidden={layout.focusedPane === "animation"}
  >
    <div
      class="preview-column-inner"
      class:focused={layout.focusedPane === "image"}
    >
      {#if _2dRightMounted}
        <div
          class="media-pane animation-pane persistent-2d"
          class:persistent-2d-hidden={!_2dRightActive}
        >
          <div
            class="canvas-layer canvas-2d-layer"
            style="opacity:1;pointer-events:auto;"
          >
            <AnimatorCanvas
              sequenceData={playback.animationState.sequenceData}
              currentStep={playback.currentStep}
              isPlaying={playback.isPlaying}
              virtualTime={playback.animationState.virtualTime}
              blueProp={playback.animationState.bluePropState}
              redProp={playback.animationState.redPropState}
              gridMode={sequence?.gridMode}
              letter={playback.currentLetter}
              stepData={playback.currentStepData}
              word={sequence?.word}
              bluePropType={propRendering.bluePropType}
              redPropType={propRendering.redPropType}
              {trailSettings}
              onCanvasReady={() => {}}
              {onPlaybackToggle}
              onProgressBarSeek={onProgressBarSeek ?? null}
              onProgressBarScrubStart={onProgressBarScrubStart ?? null}
              onProgressBarScrubEnd={onProgressBarScrubEnd ?? null}
              focused={false}
              suppress2DOverlays={false}
              hideProgressBar={true}
              resizePaused={_practiceResizePaused}
            />
          </div>
        </div>
      {/if}

      {#if _cardRight.mounted}
        <div
          class="media-pane preview-pane content-overlay"
          class:content-overlay-hidden={!_cardRight.shown}
        >
          {#if _cardRight.active && layout.focusedPane === "image" && !layout.isMobile && !layout.suppressCloseButton}
            <div
              class="pane-close-btn"
              role="button"
              tabindex="0"
              onclick={handleCloseClick}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleCloseClick(e);
              }}
              aria-label="Exit focus mode"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </div>
          {/if}

          <ChoreoCard
            {sequence}
            highlightedStepIndex={layout.focusedPane === "image"
              ? null
              : playback.highlightedStepIndex}
            showHighlight={layout.focusedPane === "image"
              ? false
              : playback.isPlaying || playback.highlightedStepIndex !== null}
            {onStepClick}
            {onQrPlayClick}
            clickableStart
            {onRenderProgress}
            showWord={imageComposition.showWord}
            showStepNumbers={imageComposition.showStepNumbers}
            showDifficultyLevel={imageComposition.showDifficulty}
            includeStartPosition={imageComposition.showStartPos}
            showCreatorName={imageComposition.showCreatorName}
            showNotes={imageComposition.showNotes}
            showQRCode={imageComposition.showQRCode}
            showMandala={imageComposition.showMandala ?? false}
            showBirthday={imageComposition.showBirthday}
            showLoopGlyph={imageComposition.showLoopGlyph ?? true}
            handPathMode={imageComposition.handPathMode}
            darkMode={imageComposition.darkMode}
            columnCount={imageComposition.columnCount}
            forceContain={imageComposition.forceContain}
            fitWidth={layout.isMobile && layout.focusedPane === "image"}
            userName={imageComposition.userName}
            bluePropType={propRendering.bluePropType}
            redPropType={propRendering.redPropType}
            catDogModeEnabled={propRendering.catDogModeEnabled}
            {rerenderTrigger}
            onContextMenu={onChoreoCardContextMenu}
            onAutoLayoutResolved={_cardRight.shown
              ? onAutoLayoutResolved
              : undefined}
          />
        </div>
      {/if}
      {#if splitConfig.rightPane === "animation-3d"}
        <div class="media-pane animation-pane content-overlay">
          <div
            class="canvas-layer canvas-3d-layer"
            style="opacity:1;pointer-events:auto;"
          >
            <LazyMount
              loader={loadViewer3DCanvas}
              active={splitConfig.rightPane === "animation-3d"}
              debugName="3D viewer canvas"
              placeholder={viewer3DLoading}
              error={viewer3DError}
              props={{
                sequenceData: playback.animationState.sequenceData,
                currentStep: playback.currentStep,
                isPlaying: playback.isPlaying,
                bpm,
                onBpmChange,
                bluePropType:
                  propRendering.bluePropType != null
                    ? String(propRendering.bluePropType)
                    : null,
                redPropType:
                  propRendering.redPropType != null
                    ? String(propRendering.redPropType)
                    : null,
                hideOverlays: false,
                fullScreen: false,
                onExitFullScreen: onUnfocusPane,
                onPlaybackToggle,
                onSystemPlaybackChange,
                onProgressBarSeek,
                playbackMode,
                onPlaybackModeChange,
                onSettingChange: onViewer3DSettingChange,
              }}
            />
          </div>
        </div>
      {/if}
      {#if _videosRight.mounted}
        <div
          class="media-pane content-overlay"
          class:content-overlay-hidden={!_videosRight.shown}
        >
          <VideoGallery
            {sequence}
            isOwned={false}
            {isLoggedIn}
            onUpload={onVideoUpload}
          />
        </div>
      {/if}
      {#if _mandalaRight.mounted}
        <div
          class="media-pane content-overlay"
          class:content-overlay-hidden={!_mandalaRight.shown}
        >
          <ArtPane
            artType="mandala"
            active={_mandalaRight.shown}
            {sequence}
            {playback}
            bluePropType={propRendering.bluePropType != null
              ? String(propRendering.bluePropType)
              : undefined}
            redPropType={propRendering.redPropType != null
              ? String(propRendering.redPropType)
              : undefined}
            {bpm}
            {onBpmChange}
            {playbackMode}
            {onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
            layout={layout.isMobile ? "bottom" : "sidebar"}
            {onPropChange}
            {onArtExport}
            {onArtExportEvent}
            {onArtSettingChange}
            {onArtAction}
          />
        </div>
      {/if}
      {#if _tunnelRight.mounted}
        <div
          class="media-pane content-overlay"
          class:content-overlay-hidden={!_tunnelRight.shown}
        >
          <ArtPane
            artType="tunnel"
            active={_tunnelRight.shown}
            {sequence}
            {playback}
            bluePropType={propRendering.bluePropType != null
              ? String(propRendering.bluePropType)
              : undefined}
            redPropType={propRendering.redPropType != null
              ? String(propRendering.redPropType)
              : undefined}
            {bpm}
            {onBpmChange}
            {playbackMode}
            {onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
            layout={layout.isMobile ? "bottom" : "sidebar"}
            {onPropChange}
            {onArtExport}
            {onArtExportEvent}
            {onArtSettingChange}
            {onArtAction}
          />
        </div>
      {/if}

      <!-- Practice deck OVERLAYS the persistent companion panes (card / 2D /
           mandala / etc.) instead of replacing them. Entering practice used to
           sit inside `{:else}` of these panes, which UNMOUNTED the ChoreoCard —
           exiting then rebuilt it from scratch, flashing every pictograph back
           to a loading spinner. As an opaque overlay it keeps them mounted: the
           card stays rendered behind it and is revealed intact as the deck
           slides out on exit (no re-render). -->
      {#if practiceActive}
        <!-- Read-ahead lane: parked off-screen right during SETUP so the
             side-by-side choreo card shows through (you preview the sequence while
             configuring). It slides in to cover the card only once the ramp starts.
             Stays mounted across setup↔running so the strip never re-renders or
             flickers on Start. -->
        <div class="practice-deck lane" class:lane-in={practiceRunning}>
          <PracticeLanePane
            sequence={playback.animationState.sequenceData}
            currentStep={playback.currentStep}
            {bpm}
            cellSize={practiceCellSize}
            bluePropType={propRendering.bluePropType}
            redPropType={propRendering.redPropType}
            onSeek={onProgressBarSeek ?? null}
            showStartCell={_laneAtStart}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /*
   * Unified Motion Language
   *
   * One curve:  cubic-bezier(0.2, 0, 0, 1)  - Material 3 "emphasized decelerate"
   * Micro:      120ms  - button press, hover
   * Standard:   250ms  - layout shifts, panel transitions, focus/unfocus
   * Spring:     cubic-bezier(0.34, 1.56, 0.64, 1) - close button pop only
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
    /* No grid transition — animated grid-template-columns causes ChoreoCard's
       ResizeObserver to fire on every frame, producing a tiny→expand resize cascade. */
  }

  .media-pane.persistent-3d,
  .media-pane.persistent-2d {
    position: absolute;
    inset: 0;
    opacity: 1;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 0s;
  }

  /* Qualified with `.media-pane` so `position:absolute` beats the later
     `.media-pane { position:relative; flex:1 }` rule (equal specificity → source
     order would otherwise win). Without this, two mounted overlays (e.g. Mandala
     + Tunnel after the mode split) become flex siblings and split the column
     50/50 instead of overlapping. */
  .media-pane.content-overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 1;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 0s;
  }

  .media-pane.content-overlay-hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 200ms;
  }

  .media-pane.persistent-3d-hidden,
  .media-pane.persistent-2d-hidden {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 200ms;
  }

  .persistent-rail {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 9;
    opacity: 1;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 0s;
  }

  .persistent-rail > :global(*) {
    pointer-events: auto;
  }

  .persistent-rail-hidden {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      visibility 0s linear 200ms;
  }

  .persistent-rail-hidden > :global(*) {
    pointer-events: none;
  }

  /* Split columns - tappable focus targets */
  .split-column {
    position: relative; /* anchor for non-scaling overlays like RightRail */
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    -webkit-tap-highlight-color: transparent;
    /* visible so overlay scaling isn't clipped at the column edge.
       .media-pane keeps its own overflow:hidden to clip canvas content. */
    overflow: visible;
  }

  .animation-column {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .preview-column {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .preview-column-inner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    /* Positioning context for the practice deck (absolute, slides over the
       normal companion content during enter/exit). */
    position: relative;
  }

  /* Practice deck — the read-ahead lane, mounted on practice enter and parked
     off-screen right (translateX 100%). Slides in on Start (.lane-in) and back
     out on exit, while the still-mounted card / 2D / art sit hidden behind it.
     overflow:hidden clips the lane's own content. */
  .practice-deck {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Above the persistent companion panes (content-overlay is z-index 3) so the
       still-mounted card/2D/art sit hidden behind it during practice and are
       revealed intact as the deck slides out on exit. FULLY opaque: the theme
       panel bg is ~75% alpha, so layer it over a solid base or the card ghosts
       through. */
    z-index: 4;
    background-color: var(--theme-bg-deep, #0a0a14);
    background-image: linear-gradient(
      var(--theme-panel-bg, rgba(18, 18, 28, 0.98)),
      var(--theme-panel-bg, rgba(18, 18, 28, 0.98))
    );
    /* Parked off-screen right during setup (card shows through); slides in on Start. */
    transform: translateX(100%);
    transition: transform var(--ws-dur, 300ms)
      var(--ws-ease, cubic-bezier(0.2, 0, 0, 1));
    will-change: transform;
  }
  .practice-deck.lane-in {
    transform: translateX(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .practice-deck {
      transition: none;
    }
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

  .canvas-2d-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    transition: opacity 250ms ease;
  }

  /* Passive AR mirror — webcam behind the practice canvas. Fills the pane,
     sits under the transparent canvas. z-index below .canvas-2d-layer. */
  .practice-mirror-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
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

  /* Close button - spring pop-in, staggered 100ms after grid starts moving */
  .pane-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
    animation: closeButtonPopIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms
      both;
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
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .pane-close-btn:active {
    transform: scale(0.92);
  }

  .pane-close-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Hidden column fades out - same 250ms as the grid, so everything lands together */
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

    /* Preview pane needs less padding - the ChoreoCard
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

  .viewer-3d-load-state {
    width: 100%;
    height: 100%;
    padding: var(--spacing-lg, 24px);
    text-align: center;
  }

  /* ========================================
     PRACTICE MODE: layout adapts to aspect.

     Portrait / narrow (default): canvas fills the top, the read-ahead strip is
     a full-width "foot" pinned to the bottom (the landing Infinite Spinner
     model). The strip row is `auto` so it sizes to StepStrip's intrinsic
     height; the canvas takes everything above.

     Wide (desktop ≥768) + landscape mobile: side-by-side — canvas | strip
     column. A full-width vertical layout wastes a wide screen (the square
     canvas leaves big side margins), and the goal is to read the strip from
     afar — so on wide aspects the strip lives beside the canvas. `--canvas-frac`
     sets the split. Wins over the generic desktop 50/50 rule on specificity
     (.split-view.practice = two classes) + later source order.
     ======================================== */
  .split-view.practice {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    /* No --canvas-frac transition. Animating the grid column re-lays-out + re-renders
       the live animator canvas every frame (the ResizeObserver cascade documented on
       .split-view above — measured at ~11fps). The fraction is constant across setup
       and running, so the canvas resizes exactly ONCE on enter/exit; Start/Stop never
       touch it. The visible Start/Stop motion is the companion deck + cockpit bar,
       both composited transforms. */
  }

  @media (min-width: 768px) {
    .split-view.practice {
      grid-template-columns: calc(var(--canvas-frac) * 100%) 1fr;
      grid-template-rows: 1fr;
    }
  }

  /* A desktop-width stage can still be portrait after the content rail claims
     its column. Follow the component's measured shape so both previews receive
     the larger square instead of inheriting the viewport's orientation. */
  @media (min-width: 768px) {
    .split-view[data-adaptive-stack="true"] {
      grid-template-columns: 1fr;
      grid-template-rows: 50% 50%;
    }

    .split-view[data-adaptive-stack="true"] .preview-column {
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .split-view[data-adaptive-stack="true"][data-focused="animation"] {
      grid-template-columns: 1fr;
      grid-template-rows: 100% 0%;
    }

    .split-view[data-adaptive-stack="true"][data-focused="image"] {
      grid-template-columns: 1fr;
      grid-template-rows: 0% 100%;
    }
  }

  .split-view.practice[data-landscape="true"] {
    grid-template-columns: calc(var(--canvas-frac) * 100%) 1fr;
    grid-template-rows: 1fr;
  }

  @media (prefers-reduced-motion: reduce) {
    .split-view,
    .split-column,
    .preview-column,
    .pane-close-btn,
    .media-pane.persistent-3d,
    .media-pane.persistent-2d,
    .media-pane.persistent-3d-hidden,
    .media-pane.persistent-2d-hidden,
    .persistent-rail,
    .persistent-rail-hidden,
    .content-overlay,
    .content-overlay-hidden {
      transition: none !important;
    }

    .pane-close-btn {
      animation: none !important;
    }
  }
</style>
