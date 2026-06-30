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
  import type { SplitConfig } from '../services/viewer-state-persistence';
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
  import { createAnimatorPlaybackAdapter } from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import RightRail from "./RightRail.svelte";
  import VideoGallery from './VideoGallery.svelte';
  import ArtPane from './ArtPane.svelte';
  import PracticeLanePane from "./PracticeLanePane.svelte";
  import PracticeCountInOverlay from "./PracticeCountInOverlay.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { foldTrailIntentIntoSettings } from "$lib/shared/effects/translators/canvas2d-translator";
  import { setEffectsConfigContext, getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext, getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { startSceneAssetPreload } from "$lib/shared/3d/services/scene-asset-preloader.svelte";

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
  const effectsConfigState = inheritedEffectsConfig ?? createEffectsConfigState();
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
    renderMode?: '2d' | '3d';
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
    onRenderProgress?: (loaded: number, total: number) => void;
    onFocusPane: (pane: "animation" | "image") => void;
    onUnfocusPane: () => void;
    onStepClick: (stepIndex: number) => void;
    /** Provided only by the interactive viewer: click the QR play badge in a
        Card pane to switch to 2D animation and start playback. */
    onQrPlayClick?: () => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
    onChoreoCardContextMenu?: (x: number, y: number) => void;
    onPlaybackToggle?: () => void;
    onProgressBarSeek?: (targetStep: number) => void;
    onProgressBarScrubStart?: () => void;
    onProgressBarScrubEnd?: () => void;
    playbackMode?: "continuous" | "step";
    onPlaybackModeChange?: (mode: "continuous" | "step") => void;
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
    /**
     * Hide ALL playback transport (the canvas scrubber AND the portrait mobile
     * transport bar). For surfaces where another pane already indicates progress
     * — e.g. the QR scan page's Side-by-Side, where the choreo card's highlighted
     * step is the progress readout, so a scrubber under the animation is noise.
     */
    suppressProgress?: boolean;
    /** When true, renders PracticeLanePane in the right pane instead of the normal preview. */
    practiceActive?: boolean;
    /** Cell size (px) forwarded to PracticeLanePane / BeatStrip. */
    practiceCellSize?: number;
    /** Fraction of total width given to the animation canvas column in practice mode. */
    practiceCanvasFraction?: number;
    /** True while the ramp is actually running (vs. the setup screen). */
    practiceRunning?: boolean;
    /** Count-in value over the canvas: 3/2/1 while counting in, 0 = hidden. */
    practiceCountdown?: number;
  }

  let {
    sequence,
    playback,
    imageComposition,
    propRendering,
    layout,
    bpm = 60,
    onBpmChange = () => {},
    onRenderProgress,
    onUnfocusPane,
    onStepClick,
    onQrPlayClick,
    onCanvasReady,
    onChoreoCardContextMenu,
    onPlaybackToggle,
    onProgressBarSeek,
    onProgressBarScrubStart,
    onProgressBarScrubEnd,
    playbackMode,
    onPlaybackModeChange,
    rerenderTrigger = 0,
    isExporting = false,
    splitConfig = { leftPane: 'animation', rightPane: 'card' },
    isLoggedIn = false,
    onVideoUpload,
    onArtExport,
    suppressProgress = false,
    practiceActive = false,
    practiceCellSize = 72,
    practiceCanvasFraction = 0.38,
    practiceRunning = false,
    practiceCountdown = 0,
  }: Props = $props();


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
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // reduced motion snaps instantly → single resize, nothing to pause
    _practiceResizePaused = true;
    clearTimeout(_resizeResumeTimer);
    // --ws-dur (300ms) + a frame of slack so resume lands after the layout settles.
    _resizeResumeTimer = setTimeout(() => (_practiceResizePaused = false), 340);
  });
  $effect(() => () => clearTimeout(_resizeResumeTimer));

  // Three.js / Threlte is multi-MB. The 3D canvas + performer hub are only
  // imported once a 3D pane is actually activated, so any chunk that touches
  // ViewerSplitPane (e.g. the lightweight QR landing page, which never sets a
  // 3D pane) stays Three-free until/unless the user opens a 3D view.
  let Viewer3DCanvas = $state<
    typeof import("$lib/shared/3d/components/Viewer3DCanvas.svelte").default | null
  >(null);
  let PerformerHub = $state<
    typeof import("$lib/shared/3d/components/controls/PerformerHub.svelte").default | null
  >(null);
  const needs3D = $derived(
    splitConfig.leftPane === "animation-3d" ||
      splitConfig.rightPane === "animation-3d",
  );
  $effect(() => {
    if (needs3D && !Viewer3DCanvas) {
      void Promise.all([
        import("$lib/shared/3d/components/Viewer3DCanvas.svelte"),
        import("$lib/shared/3d/components/controls/PerformerHub.svelte"),
      ]).then(([canvas, hub]) => {
        Viewer3DCanvas = canvas.default;
        PerformerHub = hub.default;
      });
    }
  });

  // Preload heavy 3D scene assets only when a 3D pane is in play — keeps the
  // 3D asset-loader import path off 2D-only pages.
  $effect(() => {
    if (needs3D) startSceneAssetPreload();
  });

  function handleCloseClick(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    onUnfocusPane();
  }

  // Persist canvases once activated — avoids full teardown+rebuild on pane switch.
  let _3dLeftMounted = $state(false);
  const _3dLeftActive = $derived(splitConfig.leftPane === 'animation-3d');
  $effect(() => {
    if (_3dLeftActive) _3dLeftMounted = true;
  });

  let _2dLeftMounted = $state(false);
  const _2dLeftActive = $derived(splitConfig.leftPane === 'animation');
  $effect(() => {
    if (_2dLeftActive) _2dLeftMounted = true;
  });

  // Portrait-mobile relocates the 2D canvas transport to a full-width bar above
  // the bottom nav, freeing the canvas to fill its row. Applies to split AND to
  // the single-animation (focused 2D) view — the canvas-attached scrubber is
  // suppressed in both via hideProgressBar={showMobileTransport}.
  const showMobileTransport = $derived(
    layout.isMobile &&
      !layout.isLandscapeMobile &&
      _2dLeftActive &&
      (!layout.focusedPane || layout.focusedPane === "animation")
  );
  const mobileTransportAdapter = createAnimatorPlaybackAdapter({
    getCurrentStep: () => playback.currentStep,
    getSteps: () => playback.animationState.sequenceData?.steps ?? [],
    getIsPlaying: () => playback.isPlaying,
    onSeek: (target) => onProgressBarSeek?.(target),
    onTogglePlay: () => onPlaybackToggle?.(),
  });

  let _2dRightMounted = $state(false);
  const _2dRightActive = $derived(splitConfig.rightPane === 'animation');
  $effect(() => {
    if (_2dRightActive) _2dRightMounted = true;
  });

  let _cardLeftMounted = $state(false);
  let _cardLeftShown = $state(false);
  const _cardLeftActive = $derived(splitConfig.leftPane === 'card');
  $effect(() => {
    if (_cardLeftActive) {
      if (!_cardLeftMounted) {
        _cardLeftMounted = true;
        requestAnimationFrame(() => { _cardLeftShown = true; });
      } else {
        _cardLeftShown = true;
      }
    } else {
      _cardLeftShown = false;
    }
  });

  let _videosLeftMounted = $state(false);
  let _videosLeftShown = $state(false);
  const _videosLeftActive = $derived(splitConfig.leftPane === 'videos');
  $effect(() => {
    if (_videosLeftActive) {
      if (!_videosLeftMounted) {
        _videosLeftMounted = true;
        requestAnimationFrame(() => { _videosLeftShown = true; });
      } else {
        _videosLeftShown = true;
      }
    } else {
      _videosLeftShown = false;
    }
  });

  let _mandalaLeftMounted = $state(false);
  let _mandalaLeftShown = $state(false);
  const _mandalaLeftActive = $derived(splitConfig.leftPane === 'mandala');
  $effect(() => {
    if (_mandalaLeftActive) {
      if (!_mandalaLeftMounted) {
        _mandalaLeftMounted = true;
        requestAnimationFrame(() => { _mandalaLeftShown = true; });
      } else {
        _mandalaLeftShown = true;
      }
    } else {
      _mandalaLeftShown = false;
    }
  });

  let _tunnelLeftMounted = $state(false);
  let _tunnelLeftShown = $state(false);
  const _tunnelLeftActive = $derived(splitConfig.leftPane === 'tunnel');
  $effect(() => {
    if (_tunnelLeftActive) {
      if (!_tunnelLeftMounted) {
        _tunnelLeftMounted = true;
        requestAnimationFrame(() => { _tunnelLeftShown = true; });
      } else {
        _tunnelLeftShown = true;
      }
    } else {
      _tunnelLeftShown = false;
    }
  });

  let _cardRightMounted = $state(false);
  let _cardRightShown = $state(false);
  const _cardRightActive = $derived(splitConfig.rightPane === 'card');
  $effect(() => {
    if (_cardRightActive) {
      if (!_cardRightMounted) {
        _cardRightMounted = true;
        requestAnimationFrame(() => { _cardRightShown = true; });
      } else {
        _cardRightShown = true;
      }
    } else {
      _cardRightShown = false;
    }
  });

  let _videosRightMounted = $state(false);
  let _videosRightShown = $state(false);
  const _videosRightActive = $derived(splitConfig.rightPane === 'videos');
  $effect(() => {
    if (_videosRightActive) {
      if (!_videosRightMounted) {
        _videosRightMounted = true;
        requestAnimationFrame(() => { _videosRightShown = true; });
      } else {
        _videosRightShown = true;
      }
    } else {
      _videosRightShown = false;
    }
  });

  let _mandalaRightMounted = $state(false);
  let _mandalaRightShown = $state(false);
  const _mandalaRightActive = $derived(splitConfig.rightPane === 'mandala');
  $effect(() => {
    if (_mandalaRightActive) {
      if (!_mandalaRightMounted) {
        _mandalaRightMounted = true;
        requestAnimationFrame(() => { _mandalaRightShown = true; });
      } else {
        _mandalaRightShown = true;
      }
    } else {
      _mandalaRightShown = false;
    }
  });

  let _tunnelRightMounted = $state(false);
  let _tunnelRightShown = $state(false);
  const _tunnelRightActive = $derived(splitConfig.rightPane === 'tunnel');
  $effect(() => {
    if (_tunnelRightActive) {
      if (!_tunnelRightMounted) {
        _tunnelRightMounted = true;
        requestAnimationFrame(() => { _tunnelRightShown = true; });
      } else {
        _tunnelRightShown = true;
      }
    } else {
      _tunnelRightShown = false;
    }
  });

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

    const outPane = from === 'animation' ? _pane2d : from === 'animation-3d' ? _pane3d : null;
    const outRail = from === 'animation' ? _rail2d : from === 'animation-3d' ? _rail3d : null;
    if (!outPane) return;

    const w = outPane.getBoundingClientRect().width + 'px';
    outPane.style.width = w;
    if (outRail) outRail.style.width = w;

    setTimeout(() => {
      if (outPane.isConnected) outPane.style.width = '';
      if (outRail?.isConnected) outRail.style.width = '';
    }, 250);
  });

</script>

<div
  class="split-view view-container"
  class:practice={practiceActive}
  style="--canvas-frac: {practiceCanvasFraction};"
  data-fullscreen-stack={layout.isFullscreen ? (layout.fullscreenStackVertical ? "vertical" : "horizontal") : undefined}
  data-landscape={layout.isLandscapeMobile || undefined}
  data-focused={layout.focusedPane}
  data-mobile-transport={(showMobileTransport && !suppressProgress) || undefined}
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
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") handleCloseClick(e); }}
            aria-label="Exit focus mode"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </div>
        {/if}

        <div
          class="canvas-layer canvas-3d-layer"
          style="opacity:1;pointer-events:auto;"
        >
          {#if Viewer3DCanvas}
            <Viewer3DCanvas
              sequenceData={playback.animationState.sequenceData}
              currentStep={playback.currentStep}
              isPlaying={playback.isPlaying}
              {bpm}
              {onBpmChange}
              bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : null}
              redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : null}
              hideOverlays={false}
              fullScreen={layout.focusedPane === "animation"}
              onExitFullScreen={onUnfocusPane}
              {onPlaybackToggle}
              {onProgressBarSeek}
              {playbackMode}
              {onPlaybackModeChange}
            />
          {/if}
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
              {onCanvasReady}
              {onPlaybackToggle}
              onProgressBarSeek={onProgressBarSeek ?? null}
              onProgressBarScrubStart={onProgressBarScrubStart ?? null}
              onProgressBarScrubEnd={onProgressBarScrubEnd ?? null}
              focused={layout.focusedPane === "animation"}
              suppress2DOverlays={false}
              hideProgressBar={showMobileTransport}
              hideHeader={showMobileTransport}
              tapToToggle={showMobileTransport}
              resizePaused={_practiceResizePaused}
            />
          </div>
        {/if}

      </div>
    {/if}

    {#if _2dLeftMounted}
      <div bind:this={_rail2d} class="persistent-rail" class:persistent-rail-hidden={!_2dLeftActive}>
        <RightRail renderMode="2d" />
      </div>
    {/if}
    {#if _3dLeftMounted}
      <div bind:this={_rail3d} class="persistent-rail" class:persistent-rail-hidden={!_3dLeftActive}>
        <RightRail renderMode="3d" />
        {#if PerformerHub}
          <PerformerHub />
        {/if}
      </div>
    {/if}

    {#if _cardLeftMounted}
      <div class="media-pane preview-pane content-overlay" class:content-overlay-hidden={!_cardLeftShown}>
        <ChoreoCard
          {sequence}
          highlightedStepIndex={playback.highlightedStepIndex}
          showHighlight={playback.isPlaying || playback.highlightedStepIndex !== null}
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
        />
      </div>
    {/if}
    {#if _videosLeftMounted}
      <div class="media-pane content-overlay" class:content-overlay-hidden={!_videosLeftShown}>
        <VideoGallery {sequence} isOwned={false} {isLoggedIn} onUpload={onVideoUpload} />
      </div>
    {/if}
    {#if _mandalaLeftMounted}
      <div class="media-pane content-overlay" class:content-overlay-hidden={!_mandalaLeftShown}>
        <ArtPane
          artType="mandala"
          {sequence}
          {playback}
          bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
          redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
          {bpm}
          {onBpmChange}
          {playbackMode}
          {onPlaybackModeChange}
          onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          {onArtExport}
        />
      </div>
    {/if}
    {#if _tunnelLeftMounted}
      <div class="media-pane content-overlay" class:content-overlay-hidden={!_tunnelLeftShown}>
        <ArtPane
          artType="tunnel"
          {sequence}
          {playback}
          bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
          redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
          {bpm}
          {onBpmChange}
          {playbackMode}
          {onPlaybackModeChange}
          onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          {onArtExport}
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

    <div class="preview-column-inner" class:focused={layout.focusedPane === "image"}>
      {#if _2dRightMounted}
        <div
          class="media-pane animation-pane persistent-2d"
          class:persistent-2d-hidden={!_2dRightActive}
        >
          <div class="canvas-layer canvas-2d-layer" style="opacity:1;pointer-events:auto;">
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
              trailSettings={trailSettings}
              onCanvasReady={() => {}}
              onPlaybackToggle={onPlaybackToggle}
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

      {#if _cardRightMounted}
        <div class="media-pane preview-pane content-overlay" class:content-overlay-hidden={!_cardRightShown}>
          {#if _cardRightActive && layout.focusedPane === "image" && !layout.isMobile && !layout.suppressCloseButton}
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
          />
        </div>
      {/if}
      {#if splitConfig.rightPane === 'animation-3d'}
        <div class="media-pane animation-pane content-overlay">
          <div
            class="canvas-layer canvas-3d-layer"
            style="opacity:1;pointer-events:auto;"
          >
            {#if Viewer3DCanvas}
              <Viewer3DCanvas
                sequenceData={playback.animationState.sequenceData}
                currentStep={playback.currentStep}
                isPlaying={playback.isPlaying}
                {bpm}
                {onBpmChange}
                bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : null}
                redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : null}
                hideOverlays={false}
                fullScreen={false}
                onExitFullScreen={onUnfocusPane}
                {onPlaybackToggle}
                {onProgressBarSeek}
                {playbackMode}
                {onPlaybackModeChange}
              />
            {/if}
          </div>
        </div>
      {/if}
      {#if _videosRightMounted}
        <div class="media-pane content-overlay" class:content-overlay-hidden={!_videosRightShown}>
          <VideoGallery {sequence} isOwned={false} {isLoggedIn} onUpload={onVideoUpload} />
        </div>
      {/if}
      {#if _mandalaRightMounted}
        <div class="media-pane content-overlay" class:content-overlay-hidden={!_mandalaRightShown}>
          <ArtPane
            artType="mandala"
            {sequence}
            {playback}
            bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
            redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
            {bpm}
            {onBpmChange}
            {playbackMode}
            {onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
            {onArtExport}
          />
        </div>
      {/if}
      {#if _tunnelRightMounted}
        <div class="media-pane content-overlay" class:content-overlay-hidden={!_tunnelRightShown}>
          <ArtPane
            artType="tunnel"
            {sequence}
            {playback}
            bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : undefined}
            redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : undefined}
            {bpm}
            {onBpmChange}
            {playbackMode}
            {onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
            {onArtExport}
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
          />
        </div>
      {/if}
    </div>
  </div>

  {#if showMobileTransport && !suppressProgress}
    <div class="mobile-transport-bar" data-swipe-block>
      <UnifiedTimeline playback={mobileTransportAdapter} hidePlay />
    </div>
  {/if}
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

  /* Portrait-mobile split: canvas + card share the flexible space, transport
     pins to a full-width auto row below the card. */
  .split-view[data-mobile-transport] {
    grid-template-rows: 1fr 1fr auto;
  }
  /* Single-animation (focused 2D) portrait: collapse the image row so the
     canvas fills, and give the relocated transport bar its own auto row. */
  .split-view[data-focused="animation"][data-mobile-transport] {
    grid-template-rows: 1fr 0% auto;
  }

  .mobile-transport-bar {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
    z-index: 10;
  }

  /* Match the viewer's solid dark panel surface (preview-column uses the same
     token) instead of the floating-overlay glass the pill wears inside a canvas,
     and shave vertical padding so the bar stays compact on short phones. */
  .mobile-transport-bar :global(.transport-pill) {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    backdrop-filter: none;
    border-top-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .media-pane.persistent-3d,
  .media-pane.persistent-2d {
    position: absolute;
    inset: 0;
    opacity: 1;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
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
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
                visibility 0s linear 0s;
  }

  .media-pane.content-overlay-hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
                visibility 0s linear 200ms;
  }

  .media-pane.persistent-3d-hidden,
  .media-pane.persistent-2d-hidden {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
                visibility 0s linear 200ms;
  }

  .persistent-rail {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 9;
    opacity: 1;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
                visibility 0s linear 0s;
  }

  .persistent-rail > :global(*) {
    pointer-events: auto;
  }

  .persistent-rail-hidden {
    opacity: 0;
    visibility: hidden;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
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
    transition: transform var(--ws-dur, 300ms) var(--ws-ease, cubic-bezier(0.2, 0, 0, 1));
    will-change: transform;
  }
  .practice-deck.lane-in {
    transform: translateX(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .practice-deck { transition: none; }
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

  /* ========================================
     PRACTICE MODE: layout adapts to aspect.

     Portrait / narrow (default): canvas fills the top, the read-ahead strip is
     a full-width "foot" pinned to the bottom (the landing Infinite Spinner
     model). The strip row is `auto` so it sizes to BeatStrip's intrinsic
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
