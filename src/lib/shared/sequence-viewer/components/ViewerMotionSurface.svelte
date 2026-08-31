<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import CameraPreview from "$lib/shared/train/components/CameraPreview.svelte";
  import type { ViewerMotionSurfaceProps } from "./viewer-split-pane-types";
  import SceneControlWorkspace from "$lib/shared/3d/components/controls/SceneControlWorkspace.svelte";
  import type { SceneControlLayout } from "$lib/shared/3d/domain/scene-control-layout";
  import ContactViewerRequired from "$lib/shared/3d/components/ContactViewerRequired.svelte";
  import { sceneNeedsContactViewer } from "$lib/shared/3d/domain/prop-motion-discipline";
  import VisualSequenceSaveContextMenuHost from "$lib/shared/library/components/VisualSequenceSaveContextMenuHost.svelte";
  import Viewer3DRailHint from "$lib/shared/3d/components/onboarding/Viewer3DRailHint.svelte";
  import { warmSelectedSceneAssets } from "$lib/shared/3d/scene-boot/scene-prefetch";
  import {
    isViewer3DIntroReplayRequested,
    shouldShowViewer3DIntro,
  } from "$lib/shared/onboarding/state/viewer3d-intro-state";
  import {
    flyFade,
    motionDuration,
    reducedMotion,
  } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { Tween } from "svelte/motion";
  import { cubicInOut } from "svelte/easing";
  import { getViewerTunnelStageContext } from "../context/viewer-tunnel-stage-context";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import { resolveTunnelLayerOpacity } from "../tunnel/tunnel-layer-reveal";

  let {
    side,
    sequence,
    playback,
    propRendering,
    layout,
    splitConfig,
    trailSettings,
    bpm,
    onBpmChange,
    onSaveToLibrary,
    onUnfocusPane,
    onCanvasReady,
    onPlaybackToggle,
    onSystemPlaybackChange,
    onProgressBarSeek,
    onProgressBarScrubStart,
    onProgressBarScrubEnd,
    playbackMode,
    onPlaybackModeChange,
    onSceneReadyChange,
    onViewer3DSettingChange,
    onViewer3DAction,
    suppressProgress,
    practiceActive,
    practiceMirrorEnabled,
    practiceResizePaused,
  }: ViewerMotionSurfaceProps = $props();

  const selectedPane = $derived(
    side === "left" ? splitConfig.leftPane : splitConfig.rightPane
  );
  const is2DActive = $derived(selectedPane === "animation");
  const is3DActive = $derived(selectedPane === "animation-3d");
  const isTunnelActive = $derived(selectedPane === "tunnel");
  const isAnimatorActive = $derived(is2DActive || isTunnelActive);
  const tunnelStage = getViewerTunnelStageContext();
  const tunnelController = tunnelStage.controller;
  const effectsConfig = getEffectsConfigContext();
  const requiresContactViewer = $derived(
    sceneNeedsContactViewer(
      propRendering.bluePropType,
      propRendering.redPropType
    )
  );

  // Both 2D canvases and the primary 3D stage are keep-alive surfaces. The
  // companion-side 3D stage preserves its prior conditional-mount contract.
  let is2DMounted = $state(
    selectedPane === "animation" || selectedPane === "tunnel"
  );
  let is3DMounted = $state(selectedPane === "animation-3d");
  let retainedMotionPane = $state<"animation" | "animation-3d">(
    selectedPane === "animation-3d" ? "animation-3d" : "animation"
  );
  $effect(() => {
    if (isAnimatorActive) {
      is2DMounted = true;
      if (is2DActive) retainedMotionPane = "animation";
    }
    if (is3DActive) {
      is3DMounted = true;
      retainedMotionPane = "animation-3d";
    }
  });
  const shouldRender3D = $derived(side === "left" ? is3DMounted : is3DActive);

  const loadViewer3DCanvas = () =>
    import("$lib/shared/3d/components/Viewer3DCanvas.svelte");

  // 3D is one click away from here, and its models are the slowest thing in the
  // app to arrive. Pull them into the browser cache while it is idle so the
  // first open spends its curtain on compiling rather than downloading.
  $effect(() => {
    warmSelectedSceneAssets();
  });
  let scene3DReady = $state(false);
  let animatorReady = $state(false);
  let animatorReadyFrame = 0;
  const tunnelReveal = new Tween(isTunnelActive ? 1 : 0, {
    easing: cubicInOut,
  });
  let tunnelRevealResetTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    clearTimeout(tunnelRevealResetTimer);
    tunnelRevealResetTimer = undefined;

    if (isTunnelActive) {
      // 2D and Tunnel are one renderer, so their change reads as layers
      // blooming onto the live base. 3D is a distinct renderer: arrive at a
      // fully composed Tunnel before the canonical surface crossfade begins,
      // keeping that handoff to one opacity owner.
      void tunnelReveal.set(1, {
        duration:
          retainedMotionPane === "animation-3d"
            ? 0
            : motionDuration(DURATION.emphasis),
        easing: cubicInOut,
      });
      return;
    }

    if (is3DActive && tunnelReveal.current > 0.001) {
      const resetDelay = motionDuration(DURATION.emphasis);
      if (resetDelay === 0) {
        void tunnelReveal.set(0, { duration: 0 });
      } else {
        // Hold the outgoing Tunnel intact until 3D has finished crossing over.
        // The hidden canvas can then reset without creating a second fade.
        tunnelRevealResetTimer = setTimeout(() => {
          tunnelRevealResetTimer = undefined;
          void tunnelReveal.set(0, { duration: 0 });
        }, resetDelay);
      }
      return;
    }

    void tunnelReveal.set(0, {
      duration: motionDuration(DURATION.emphasis),
      easing: cubicInOut,
    });
  });
  $effect(() => () => clearTimeout(tunnelRevealResetTimer));
  const tunnelVisualActive = $derived(tunnelReveal.current > 0.001);
  const tunnelLayers = $derived.by(() => {
    if (!tunnelVisualActive) return [];
    const layers = tunnelController.additionalLayersAt(playback.currentStep);
    return layers.map((layer, index) => ({
      ...layer,
      opacity: resolveTunnelLayerOpacity(
        tunnelReveal.current,
        index,
        layers.length
      ),
    }));
  });
  const activeEffect = $derived(effectsConfig?.activeEffect ?? "none");
  const tunnelTipEffectMap = $derived<TipEffectMap | undefined>(
    tunnelVisualActive && activeEffect !== "none"
      ? { "*": { effect: activeEffect } }
      : undefined
  );
  const tunnelFireConfig = { disableFrameCache: true } as const;
  const keep3DUntilTunnelPaints = $derived(
    isTunnelActive && retainedMotionPane === "animation-3d" && !animatorReady
  );
  // First activation loads the 3D stage behind the live 2D frame. Repeated
  // switches use the same presentation gate, but the latched ready state makes
  // them immediate. A direct 3D page load has no prior 2D frame to preserve,
  // so it keeps the scene's own loading curtain.
  const is3DPresented = $derived(
    (is3DActive && (scene3DReady || !is2DMounted)) || keep3DUntilTunnelPaints
  );
  const is2DPresented = $derived(
    is2DActive ||
      (isTunnelActive && !keep3DUntilTunnelPaints) ||
      (is3DActive && is2DMounted && !scene3DReady)
  );
  const is2DRailPresented = $derived(isAnimatorActive);
  const is3DRailPresented = $derived(is3DActive && scene3DReady);
  const is3DPreparing = $derived(
    side === "left" && is3DActive && is2DMounted && !scene3DReady
  );
  const presentedPane = $derived<"animation" | "animation-3d" | null>(
    is3DPresented ? "animation-3d" : is2DPresented ? "animation" : null
  );
  // The viewer can never be unconfigured, so its first-open guidance points at
  // the rail rather than walking a setup it already completed to draw a frame.
  // Building a scene from nothing lives in the 3D Studio (Scene3DSetupGuide).
  // `?intro=replay` forces the hint back on a profile that has dismissed it,
  // and `force` keeps that replay from re-marking it seen.
  const replayViewer3DIntro = isViewer3DIntroReplayRequested();
  let showViewer3DIntro = $state(
    replayViewer3DIntro || shouldShowViewer3DIntro()
  );
  let pane2D: HTMLDivElement | undefined = $state();
  let pane2DWidth = $state(0);
  let lastReadable2DWidth = $state(0);
  let pane3D: HTMLDivElement | undefined = $state();
  let rail2D: HTMLDivElement | undefined = $state();
  let rail3D: HTMLDivElement | undefined = $state();
  let previousPresentedPane = $state(presentedPane);
  let presentationWidthReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  let preparationCanvasWidth = $state<number | null>(null);
  let preparationCanvasWidthReleaseTimer:
    | ReturnType<typeof setTimeout>
    | undefined;
  let contactBoundaryReportedReady = $state(false);
  let saveMenuHost: VisualSequenceSaveContextMenuHost | undefined = $state();
  let sceneControlLayout = $state<SceneControlLayout>({
    presentation: "overlay",
    panelWidth: 520,
    reservedWidth: 0,
  });

  // Remember the last width while 2D/Tunnel genuinely owns the stage. Once a
  // 3D selection starts, PanelGroup may publish a transient narrow width before
  // this component's pre-effect runs; that departure geometry is exactly what
  // the preparation lease must not capture.
  $effect(() => {
    const width = pane2DWidth;
    if (isAnimatorActive && width > 0) lastReadable2DWidth = width;
  });

  function handle3DContextMenu(event: MouseEvent): void {
    if (event.defaultPrevented || !is3DActive) return;
    event.preventDefault();
    saveMenuHost?.openContextMenu(event.clientX, event.clientY);
  }

  // The contact boundary is an intentional ready state, not a failed scene
  // load. Reporting ready keeps shared playback from being held behind a
  // curtain for a stage that must never mount.
  $effect(() => {
    if (side !== "left" || !is3DActive) return;

    if (requiresContactViewer) {
      contactBoundaryReportedReady = true;
      scene3DReady = true;
      onSceneReadyChange?.(true);
    } else if (contactBoundaryReportedReady) {
      contactBoundaryReportedReady = false;
      scene3DReady = false;
      onSceneReadyChange?.(false);
    }
  });

  // Freeze the outgoing primary surface for the crossfade so its canvas and
  // rail do not remeasure while their replacement becomes active.
  $effect(() => {
    const current = presentedPane;
    if (current === previousPresentedPane) return;
    const from = previousPresentedPane;
    previousPresentedPane = current;
    if (side !== "left" || !from || !current) return;

    const outgoingPane =
      from === "animation" ? pane2D : from === "animation-3d" ? pane3D : null;
    const outgoingRail =
      from === "animation" ? rail2D : from === "animation-3d" ? rail3D : null;
    if (!outgoingPane) return;

    const width = `${outgoingPane.getBoundingClientRect().width}px`;
    outgoingPane.style.width = width;
    if (outgoingRail) outgoingRail.style.width = width;

    const releaseWidth = () => {
      presentationWidthReleaseTimer = undefined;
      if (outgoingPane.isConnected) outgoingPane.style.width = "";
      if (outgoingRail?.isConnected) outgoingRail.style.width = "";
    };
    clearTimeout(presentationWidthReleaseTimer);
    const duration = motionDuration(DURATION.emphasis);
    if (duration === 0) {
      releaseWidth();
    } else {
      presentationWidthReleaseTimer = setTimeout(releaseWidth, duration);
    }
  });

  $effect(() => () => clearTimeout(presentationWidthReleaseTimer));

  // The first 3D boot can take several seconds. The surrounding workspace is
  // already moving from its inspector allocation to the full scene during
  // that time, but the inert outgoing canvas deliberately retains its old
  // backing store. Letting its DOM box stretch with the workspace magnifies
  // that raster and makes otherwise crisp prop artwork look badly compressed.
  //
  // Capture the last authored 2D width before the mode update paints. The live
  // canvas then glides to the center at that exact size while 3D prepares
  // behind it. Keep the lease through the surface dissolve and release only
  // after 2D is fully covered.
  $effect.pre(() => {
    if (side !== "left" || !is3DPreparing) return;

    // A reversal may have armed the release while the 3D boot continues in
    // the keep-alive layer. Re-entering 3D renews the existing lease instead
    // of letting that stale timer drop it halfway through preparation.
    clearTimeout(preparationCanvasWidthReleaseTimer);
    preparationCanvasWidthReleaseTimer = undefined;
    if (preparationCanvasWidth !== null || !pane2D) return;

    const width = lastReadable2DWidth || pane2D.getBoundingClientRect().width;
    if (width <= 0) return;
    preparationCanvasWidth = width;
  });

  $effect(() => {
    if (is3DPreparing || preparationCanvasWidth === null) return;

    clearTimeout(preparationCanvasWidthReleaseTimer);
    const releaseWidth = () => {
      preparationCanvasWidthReleaseTimer = undefined;
      preparationCanvasWidth = null;
    };
    // Reduced motion still owns one quiet opacity dissolve between these two
    // co-located surfaces, so its sharp frame lease follows that CSS clock.
    const duration = reducedMotion()
      ? DURATION.normal
      : motionDuration(DURATION.emphasis);
    if (duration === 0) {
      releaseWidth();
    } else {
      preparationCanvasWidthReleaseTimer = setTimeout(releaseWidth, duration);
    }
  });

  $effect(() => () => {
    clearTimeout(preparationCanvasWidthReleaseTimer);
  });

  function handleCloseClick(event: MouseEvent | KeyboardEvent): void {
    event.stopPropagation();
    onUnfocusPane();
  }

  function handleAnimatorCanvasReady(canvas: HTMLCanvasElement | null): void {
    cancelAnimationFrame(animatorReadyFrame);
    if (side === "left") onCanvasReady(canvas);
    if (!canvas) {
      animatorReady = false;
      if (side === "left") tunnelStage.setCanvas(null);
      return;
    }

    animatorReadyFrame = requestAnimationFrame(() => {
      animatorReadyFrame = requestAnimationFrame(() => {
        animatorReady = true;
        if (side === "left") tunnelStage.setCanvas(canvas);
      });
    });
  }

  $effect(() => () => cancelAnimationFrame(animatorReadyFrame));
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

{#if shouldRender3D}
  <div
    bind:this={pane3D}
    class="media-pane animation-pane"
    class:persistent-3d={side === "left"}
    class:content-overlay={side === "right"}
    class:persistent-3d-hidden={side === "left" && !is3DPresented}
    data-motion-surface="3d"
    data-presented={is3DPresented}
    data-scene-ready={scene3DReady}
    inert={!is3DActive}
    aria-hidden={!is3DActive}
    data-scene-inspector-docked={sceneControlLayout.reservedWidth > 0 ||
      undefined}
    style:--scene-control-reserved-width="{sceneControlLayout.reservedWidth}px"
  >
    {#if side === "left" && is3DActive && layout.focusedPane === "animation" && !layout.isMobile && !layout.suppressCloseButton}
      <div
        class="pane-close-btn"
        role="button"
        tabindex="0"
        onclick={handleCloseClick}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            handleCloseClick(event);
        }}
        aria-label="Exit focus mode"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </div>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="canvas-layer canvas-3d-layer"
      style="opacity:1;pointer-events:auto;"
      oncontextmenu={handle3DContextMenu}
    >
      {#if requiresContactViewer}
        <ContactViewerRequired compact={side === "right"} />
      {:else}
        <LazyMount
          loader={loadViewer3DCanvas}
          active={is3DActive}
          prefetch
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
            fullScreen: side === "left" && layout.focusedPane === "animation",
            onExitFullScreen: onUnfocusPane,
            onPlaybackToggle,
            onSystemPlaybackChange,
            onProgressBarSeek,
            playbackMode,
            onPlaybackModeChange,
            onSettingChange: onViewer3DSettingChange,
            onSceneReadyChange: (ready: boolean) => {
              if (side !== "left") return;
              scene3DReady = ready;
              onSceneReadyChange?.(ready);
            },
            initialRevealMode:
              side === "left" && is2DMounted ? "streaming" : "gated",
          }}
        />
      {/if}
    </div>
  </div>
{/if}

{#if is2DMounted}
  <div
    bind:this={pane2D}
    bind:clientWidth={pane2DWidth}
    class="media-pane animation-pane persistent-2d"
    class:persistent-2d-hidden={!is2DPresented}
    data-motion-surface="2d"
    data-persistent-animator
    data-renderer-mode={isTunnelActive ? "tunnel" : "2d"}
    data-tunnel-blend={tunnelReveal.current.toFixed(3)}
    data-presented={is2DPresented}
    inert={!isAnimatorActive}
    aria-hidden={!isAnimatorActive}
  >
    {#if side === "left" && is2DActive && layout.focusedPane === "animation" && !layout.isMobile && !layout.suppressCloseButton}
      <div
        class="pane-close-btn"
        role="button"
        tabindex="0"
        onclick={handleCloseClick}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            handleCloseClick(event);
        }}
        aria-label="Exit focus mode"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </div>
    {/if}

    {#if side === "left" && playback.animationLoading}
      <div class="loading-state">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
      </div>
    {:else if side === "left" && playback.animationState.error}
      <div class="error-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{playback.animationState.error}</span>
      </div>
    {:else}
      {#if side === "left" && practiceActive && practiceMirrorEnabled}
        <div class="practice-mirror-layer">
          <CameraPreview mirrored={true} />
        </div>
      {/if}
      <div
        class="canvas-layer canvas-2d-layer"
        class:canvas-2d-preparation-held={preparationCanvasWidth !== null}
        data-3d-preparation-held={preparationCanvasWidth !== null || undefined}
        style:--preparation-canvas-width={preparationCanvasWidth === null
          ? undefined
          : `${preparationCanvasWidth}px`}
        style="opacity:1;pointer-events:auto;"
      >
        <!-- Focused 2D and Tunnel keep the same full transport. In the phone's
             split view the card already owns seeking and the canvas owns
             play/pause, so the duplicate transport disappears and its height
             returns to the stage. Practice keeps the transport because its
             read-ahead lane is not a card navigator. -->
        <AnimatorCanvas
          sequenceData={playback.animationState.sequenceData}
          currentStep={playback.currentStep}
          isPlaying={playback.isPlaying}
          virtualTime={playback.animationState.virtualTime}
          blueProp={playback.animationState.bluePropState}
          redProp={playback.animationState.redPropState}
          additionalLayers={tunnelLayers}
          tunnelSpectrum={tunnelController.spectrum}
          tunnelPropColors={tunnelController.exactPropColors}
          tunnelSelectedLayer={tunnelVisualActive
            ? tunnelController.spotlightLayers
            : null}
          gridMode={sequence?.gridMode}
          gridVisible={tunnelVisualActive ? tunnelController.gridVisible : true}
          letter={playback.currentLetter}
          stepData={playback.currentStepData}
          word={sequence?.word}
          bluePropType={propRendering.bluePropType}
          redPropType={propRendering.redPropType}
          fanAppearance={propRendering.fanAppearance}
          backgroundAlpha={side === "left" &&
          practiceActive &&
          practiceMirrorEnabled
            ? 0
            : 1}
          {trailSettings}
          onCanvasReady={handleAnimatorCanvasReady}
          {onPlaybackToggle}
          onProgressBarSeek={onProgressBarSeek ?? null}
          onProgressBarScrubStart={onProgressBarScrubStart ?? null}
          onProgressBarScrubEnd={onProgressBarScrubEnd ?? null}
          focused={side === "left" && layout.focusedPane === "animation"}
          suppress2DOverlays={false}
          fillContainer
          hideProgressBar={side === "left"
            ? suppressProgress ||
              (!practiceActive &&
                layout.isMobile &&
                layout.focusedPane === null)
            : true}
          hideHeader
          hideTkaGlyph={tunnelVisualActive}
          hideStepNumbers={tunnelVisualActive}
          hidePathLines={tunnelVisualActive}
          tapToToggle={side === "left"}
          hoverHint={isTunnelActive ? "badge" : undefined}
          cornerToggle={isTunnelActive}
          hidePlay={false}
          progressLine={false}
          bpm={side === "left" ? bpm : undefined}
          onBpmChange={side === "left" ? onBpmChange : undefined}
          playbackMode={side === "left" ? playbackMode : undefined}
          onPlaybackModeChange={side === "left"
            ? onPlaybackModeChange
            : undefined}
          resizePaused={practiceResizePaused}
          tipEffectMap={tunnelTipEffectMap}
          fireConfig={tunnelVisualActive ? tunnelFireConfig : undefined}
          extraContextMenuItems={isTunnelActive
            ? tunnelStage.saveMenuItems
            : []}
          {onSaveToLibrary}
        />
      </div>
      {#if is3DPreparing}
        <div class="viewer-3d-handoff-anchor">
          <div
            class="viewer-3d-handoff-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            transition:flyFade={{ duration: DURATION.fast, y: -4 }}
          >
            <ProgressRing percent={-1} size={18} strokeWidth={2.5} />
            <span>Preparing 3D</span>
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<VisualSequenceSaveContextMenuHost
  bind:this={saveMenuHost}
  {sequence}
  {onSaveToLibrary}
/>

{#if side === "left" && is2DMounted}
  <div
    bind:this={rail2D}
    class="persistent-rail"
    class:persistent-rail-hidden={!is2DRailPresented}
    inert={!is2DActive}
    aria-hidden={!is2DActive}
  ></div>
{/if}

{#if side === "left" && is3DMounted && !requiresContactViewer}
  <div
    bind:this={rail3D}
    class="persistent-rail"
    class:persistent-rail-hidden={!is3DRailPresented}
    inert={!is3DActive}
    aria-hidden={!is3DActive}
  >
    <SceneControlWorkspace
      {bpm}
      onSettingChange={onViewer3DSettingChange}
      onAction={onViewer3DAction}
      onLayoutChange={(next) => (sceneControlLayout = next)}
    />
    {#if is3DActive && scene3DReady && showViewer3DIntro}
      <Viewer3DRailHint
        onSettingChange={onViewer3DSettingChange}
        force={replayViewer3DIntro}
        onDismiss={() => (showViewer3DIntro = false)}
      />
    {/if}
  </div>
{/if}
