<script lang="ts">
  /**
   * Viewer3DCanvas
   *
   * Drop-in replacement for AnimatorCanvas in 3D render mode.
   * Wraps a Threlte <Canvas> with Viewer3DScene (scene geometry + puppet loop)
   * and Viewer3DCamera (orbit controls). Reads avatarState from the shared
   * viewer-3d context — the parent must have called setViewer3DContext() before
   * mounting this component.
   *
   * Rendering is gated on avatarState being non-null AND sequenceData being
   * present. Until both are ready a lightweight loading placeholder is shown
   * so the Canvas (and its WebGL context) only initialize once.
   */

  import { Canvas } from "@threlte/core";
  import { WebGLRenderer } from "three";
  import Viewer3DScene from "./Viewer3DScene.svelte";
  import Viewer3DCamera from "./Viewer3DCamera.svelte";
  import Viewer3DCanvasRef from "./Viewer3DCanvasRef.svelte";
  import Viewer3DGearPopover from "./Viewer3DGearPopover.svelte";
  import BeatPlaneStrip from "./controls/BeatPlaneStrip.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { createSceneFeatureState } from "../scene-features/state/scene-feature-state.svelte";
  import { setSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import SceneLoadingCurtain from "../scene-features/components/SceneLoadingCurtain.svelte";
  import { createViewerCameraPlayerState } from "../state/viewer-camera-player-state.svelte";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import RightRail from "$lib/shared/sequence-viewer/components/RightRail.svelte";
  import ViewerTransportBar from "$lib/shared/sequence-viewer/components/ViewerTransportBar.svelte";

  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    bluePropType?: string | null;
    redPropType?: string | null;
    hideOverlays?: boolean;
    fullScreen?: boolean;
    onExitFullScreen?: () => void;
    onRendererReady?: (renderer: unknown) => void;
    onCameraStateChange?: (state: CameraStateSnapshot) => void;
  }

  let { sequenceData, currentStep, isPlaying, hideOverlays = false, fullScreen = false, onExitFullScreen, onCameraStateChange }: Props =
    $props();

  const viewer3DState = getViewer3DContext();
  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  // Primary performer — gates the Canvas on performer[0] existing. Multi-
  // performer rendering iterates inside Viewer3DScene itself, but the Canvas
  // still waits on this to avoid mounting WebGL before any performer exists.
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);

  // Camera-player state for fly mode. This is the VIEWER's avatar (what WASD
  // moves), not the performer. Created once per canvas mount so fly-mode
  // position survives mode toggles within the same session.
  const cameraPlayer = createViewerCameraPlayerState();

  // Fly mode only makes sense when the canvas owns the full viewport AND the
  // user has a mouse + keyboard. Side-by-side with the choreo card: pointer
  // lock on half a screen is disorienting and there's no WASD on touch.
  const inputCaps = getInputCapabilities();
  const navToggleVisible = $derived(
    fullScreen && inputCaps.canUsePointerLock()
  );

  // If the nav toggle hides while the user is in fly/walk mode (e.g. they
  // collapsed to side-by-side, or resized to mobile), snap back to orbit so
  // they're not stranded in a mode whose toggle isn't reachable.
  $effect(() => {
    if (!navToggleVisible && viewer3DState.navMode !== "orbit") {
      viewer3DState.setNavMode("orbit");
    }
  });


</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="viewer-3d-canvas">
  {#if avatarState && sequenceData}
    <Canvas
      createRenderer={(canvas) => new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
    >
      <Viewer3DCanvasRef />
      <Viewer3DCamera
        cameraPlayerAvatar={cameraPlayer.avatarState}
        cameraPlayerPhysics={cameraPlayer.physicsProvider}
      />
      <Viewer3DScene
        {sequenceData}
        {currentStep}
        {isPlaying}
        {avatarState}
      />
    </Canvas>
    <SceneLoadingCurtain />
    {#if !hideOverlays}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="top-controls" role="presentation" onclick={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()}>
        <Viewer3DGearPopover />
      </div>
      <RightRail />
      <ViewerTransportBar />
      {#if avatarState && avatarState.totalSteps > 1 && avatarState.beatEditMode}
        <div class="beat-strip-container">
          <BeatPlaneStrip
            totalBeats={avatarState.totalSteps}
            currentBeatIndex={avatarState.currentStepIndex}
            beatPlaneOverrides={avatarState.beatPlaneOverrides}
            onBeatClick={(i) => avatarState.goToStep(i)}
          />
        </div>
      {/if}
    {/if}
  {:else}
    <div class="viewer-3d-loading">Loading 3D viewer...</div>
  {/if}
</div>

<style>
  .viewer-3d-canvas {
    width: 100%;
    height: 100%;
    position: relative;
    background: #1a1a2e;
  }

  .top-controls {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .beat-strip-container {
    position: absolute;
    bottom: 80px;
    left: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .beat-strip-container :global(.beat-plane-strip) {
    pointer-events: auto;
  }

  .viewer-3d-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-min, 14px);
  }
</style>
