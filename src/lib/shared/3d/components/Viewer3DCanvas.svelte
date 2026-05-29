<script lang="ts">
  /**
   * Viewer3DCanvas
   *
   * Drop-in replacement for AnimatorCanvas in 3D render mode.
   * Wraps a Threlte <Canvas> with Viewer3DScene (scene geometry + puppet loop)
   * and Viewer3DCamera (orbit controls). Reads avatarState from the shared
   * viewer-3d context - the parent must have called setViewer3DContext() before
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
  import PerfMonitor from "./PerfMonitor.svelte";
  import ScenePostProcessing from "../effects/post-processing/ScenePostProcessing.svelte";
  import StepPlaneStrip from "./controls/StepPlaneStrip.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { createSceneFeatureState } from "../scene-features/state/scene-feature-state.svelte";
  import { setSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import SceneLoadingCurtain from "../scene-features/components/SceneLoadingCurtain.svelte";
  import { createViewerCameraPlayerState } from "@austencloud/camera-3d";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
  import SceneAudioPlayer from "./SceneAudioPlayer.svelte";
  import { createAvatarPlaybackAdapter } from "$lib/shared/timeline/adapters/avatar-playback-adapter.svelte";
  import type { PlaybackMode } from "$lib/shared/timeline/unified-playback-context";

  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CameraStateSnapshot } from "@austencloud/scene-3d";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
    bluePropType?: string | null;
    redPropType?: string | null;
    hideOverlays?: boolean;
    fullScreen?: boolean;
    onExitFullScreen?: () => void;
    onRendererReady?: (renderer: unknown) => void;
    onCameraStateChange?: (state: CameraStateSnapshot) => void;
    onPlaybackToggle?: () => void;
    onProgressBarSeek?: (targetStep: number) => void;
    playbackMode?: PlaybackMode;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
  }

  let {
    sequenceData,
    currentStep,
    isPlaying,
    bpm = 60,
    onBpmChange = () => {},
    bluePropType = null,
    redPropType = null,
    hideOverlays = false,
    fullScreen = false,
    onExitFullScreen,
    onCameraStateChange,
    onPlaybackToggle,
    onProgressBarSeek,
    playbackMode,
    onPlaybackModeChange,
  }: Props = $props();

  const viewer3DState = getViewer3DContext();
  const playbackAdapter = $derived.by(() => createAvatarPlaybackAdapter(
    () => viewer3DState.performerManager.performers[0] ?? null,
    onPlaybackToggle && onProgressBarSeek
      ? {
          onPlaybackToggle,
          onProgressBarSeek,
          getIsPlaying: () => isPlaying,
        }
      : undefined,
    onPlaybackModeChange
      ? {
          getBpm: () => bpm,
          onBpmChange,
          getPlaybackMode: () => playbackMode ?? "continuous",
          onPlaybackModeChange,
        }
      : undefined,
  ));
  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  // Primary performer - gates the Canvas on performer[0] existing. Multi-
  // performer rendering iterates inside Viewer3DScene itself, but the Canvas
  // still waits on this to avoid mounting WebGL before any performer exists.
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);

  // Defer Canvas mount by one frame so the loading curtain paints before
  // WebGL context creation blocks the main thread.
  let canvasMountReady = $state(false);
  $effect(() => {
    if (avatarState && sequenceData && !canvasMountReady) {
      requestAnimationFrame(() => {
        canvasMountReady = true;
      });
    }
    if (!avatarState || !sequenceData) {
      canvasMountReady = false;
    }
  });

  // Camera-player state for fly mode. This is the VIEWER's avatar (what WASD
  // moves), not the performer. Created once per canvas mount so fly-mode
  // position survives mode toggles within the same session.
  const cameraPlayer = createViewerCameraPlayerState({ spawnY: -1.5 });

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

  // Start safety timeout only after canvasMountReady - scene components
  // (Environment3D, SeatedAudience3D) can't reportReady until they mount.
  $effect(() => {
    if (!canvasMountReady) return;
    const features = sceneFeatureState.features.filter(
      (f) => f.requiresAsyncLoad && sceneFeatureState.isEnabled(f.key)
    );
    console.debug(
      `[Viewer3DCanvas] async features enabled: [${features.map((f) => f.key)}]`
    );

    const timer = setTimeout(() => {
      if (sceneFeatureState.allEnabledReady) return;
      const pending = features.filter(
        (f) => !sceneFeatureState.isReady(f.key)
      );
      console.warn(
        `[Viewer3DCanvas] 15s timeout - force-readying stuck features: [${pending.map((f) => f.key)}]`
      );
      for (const f of pending) {
        sceneFeatureState.reportReady(f.key);
      }
    }, 15_000);

    return () => clearTimeout(timer);
  });

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="viewer-3d-canvas" data-swipe-block>
  {#if avatarState && sequenceData}
    {#if canvasMountReady}
      <Canvas
        createRenderer={(canvas) => new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
      >
        <PerfMonitor visible={viewer3DState.showPerf} />
        <Viewer3DCanvasRef />
        <ScenePostProcessing>
          <Viewer3DCamera
            cameraPlayerAvatar={cameraPlayer.avatarState}
            cameraPlayerPhysics={cameraPlayer.physicsProvider}
          />
          <Viewer3DScene
            {sequenceData}
            {currentStep}
            {isPlaying}
            {avatarState}
            bluePropTypeOverride={bluePropType}
            redPropTypeOverride={redPropType}
          />
        </ScenePostProcessing>
      </Canvas>
    {/if}
    <SceneLoadingCurtain />
    {#if !hideOverlays}
      <SceneAudioPlayer />
      <div class="timeline-anchor">
        <UnifiedTimeline playback={playbackAdapter} />
      </div>
      {#if avatarState && avatarState.totalSteps > 1 && avatarState.beatEditMode}
        <div class="beat-strip-container">
          <StepPlaneStrip
            totalSteps={avatarState.totalSteps}
            currentStepIndex={avatarState.currentStepIndex}
            beatPlaneOverrides={avatarState.beatPlaneOverrides}
            onStepClick={(i) => avatarState.goToStep(i)}
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

  .timeline-anchor {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    pointer-events: auto;
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
