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
  const requiresContactViewer = $derived(
    sceneNeedsContactViewer(
      propRendering.bluePropType,
      propRendering.redPropType
    )
  );

  // Both 2D canvases and the primary 3D stage are keep-alive surfaces. The
  // companion-side 3D stage preserves its prior conditional-mount contract.
  let is2DMounted = $state(selectedPane === "animation");
  let is3DMounted = $state(selectedPane === "animation-3d");
  $effect(() => {
    if (is2DActive) is2DMounted = true;
    if (is3DActive) is3DMounted = true;
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
  let pane3D: HTMLDivElement | undefined = $state();
  let rail2D: HTMLDivElement | undefined = $state();
  let rail3D: HTMLDivElement | undefined = $state();
  let previousPane = $state(selectedPane);
  let contactBoundaryReportedReady = $state(false);
  let saveMenuHost: VisualSequenceSaveContextMenuHost | undefined = $state();
  let sceneControlLayout = $state<SceneControlLayout>({
    presentation: "overlay",
    panelWidth: 520,
    reservedWidth: 0,
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
    const current = selectedPane;
    if (side !== "left" || current === previousPane) return;
    const from = previousPane;
    previousPane = current;

    const outgoingPane =
      from === "animation" ? pane2D : from === "animation-3d" ? pane3D : null;
    const outgoingRail =
      from === "animation" ? rail2D : from === "animation-3d" ? rail3D : null;
    if (!outgoingPane) return;

    const width = `${outgoingPane.getBoundingClientRect().width}px`;
    outgoingPane.style.width = width;
    if (outgoingRail) outgoingRail.style.width = width;

    setTimeout(() => {
      if (outgoingPane.isConnected) outgoingPane.style.width = "";
      if (outgoingRail?.isConnected) outgoingRail.style.width = "";
    }, 250);
  });

  function handleCloseClick(event: MouseEvent | KeyboardEvent): void {
    event.stopPropagation();
    onUnfocusPane();
  }

  function ignoreCompanionCanvas(_canvas: HTMLCanvasElement | null): void {}
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
    class:persistent-3d-hidden={side === "left" && !is3DActive}
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
          }}
        />
      {/if}
    </div>
  </div>
{/if}

{#if is2DMounted}
  <div
    bind:this={pane2D}
    class="media-pane animation-pane persistent-2d"
    class:persistent-2d-hidden={!is2DActive}
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
        style="opacity:1;pointer-events:auto;"
      >
        <!-- Focused 2D keeps the full transport. In the phone's split view the
             card already owns seeking and the canvas owns play/pause, so the
             duplicate transport disappears and its height returns to the stage.
             Practice keeps the transport because its read-ahead lane is not a
             card navigator. -->
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
          backgroundAlpha={side === "left" &&
          practiceActive &&
          practiceMirrorEnabled
            ? 0
            : 1}
          {trailSettings}
          onCanvasReady={side === "left"
            ? onCanvasReady
            : ignoreCompanionCanvas}
          {onPlaybackToggle}
          onProgressBarSeek={onProgressBarSeek ?? null}
          onProgressBarScrubStart={onProgressBarScrubStart ?? null}
          onProgressBarScrubEnd={onProgressBarScrubEnd ?? null}
          focused={side === "left" && layout.focusedPane === "animation"}
          suppress2DOverlays={false}
          fillContainer
          hideProgressBar={side === "left"
            ? suppressProgress ||
              (!practiceActive && layout.isMobile && layout.focusedPane === null)
            : true}
          hideHeader
          tapToToggle={side === "left"}
          hidePlay={false}
          progressLine={false}
          bpm={side === "left" ? bpm : undefined}
          onBpmChange={side === "left" ? onBpmChange : undefined}
          playbackMode={side === "left" ? playbackMode : undefined}
          onPlaybackModeChange={side === "left"
            ? onPlaybackModeChange
            : undefined}
          resizePaused={practiceResizePaused}
          {onSaveToLibrary}
        />
      </div>
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
    class:persistent-rail-hidden={!is2DActive}
  ></div>
{/if}

{#if side === "left" && is3DMounted && !requiresContactViewer}
  <div
    bind:this={rail3D}
    class="persistent-rail"
    class:persistent-rail-hidden={!is3DActive || !scene3DReady}
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
