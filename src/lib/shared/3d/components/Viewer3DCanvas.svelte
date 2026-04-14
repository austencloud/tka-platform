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
  import Viewer3DContextMenuHost from "./context-menu/Viewer3DContextMenuHost.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";

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
  // Primary performer — gates the Canvas on performer[0] existing. Multi-
  // performer rendering iterates inside Viewer3DScene itself, but the Canvas
  // still waits on this to avoid mounting WebGL before any performer exists.
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);

  let contextMenuHost: ReturnType<typeof Viewer3DContextMenuHost> | undefined = $state();

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost?.openContextMenu(e.clientX, e.clientY);
  }

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="viewer-3d-canvas" oncontextmenu={handleContextMenu}>
  {#if avatarState && sequenceData}
    <Canvas
      createRenderer={(canvas) => new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
    >
      <Viewer3DCanvasRef />
      <Viewer3DCamera />
      <Viewer3DScene
        {sequenceData}
        {currentStep}
        {isPlaying}
        {avatarState}
      />
    </Canvas>
    <!-- Progress bar at very bottom of 3D viewport -->
    {#if sequenceData?.steps?.length}
      {@const totalSteps = sequenceData.steps.length}
      {@const progress = Math.min(Math.max(currentStep / totalSteps, 0), 1) * 100}
      <div class="viewer-progress-bar">
        <div class="viewer-progress-fill" style="width: {progress}%"></div>
        {#each Array(totalSteps) as _, i}
          <div
            class="viewer-progress-tick"
            class:past={currentStep >= i + 1}
            style="left: {((i + 1) / totalSteps) * 100}%"
          ></div>
        {/each}
      </div>
    {/if}
    {#if !hideOverlays}
      {#if fullScreen}
        <!-- Full-screen: back button + controls in one header row -->
        <!-- stopPropagation prevents clicks on controls from triggering tap-to-collapse -->
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="fullscreen-header" onclick={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()}>
          <button
            class="back-button"
            onclick={() => onExitFullScreen?.()}
            aria-label="Exit full-screen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="header-spacer"></div>
          <div class="top-controls">
            <Viewer3DGearPopover />
          </div>
        </div>
      {:else}
        <!-- Half-screen: gear icon only -->
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="top-controls" onclick={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()}>
          <Viewer3DGearPopover />
        </div>
      {/if}
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
  <Viewer3DContextMenuHost bind:this={contextMenuHost} />
</div>

<style>
  .viewer-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    z-index: 5;
    overflow: visible;
  }

  .viewer-progress-fill {
    height: 100%;
    background: rgba(139, 139, 255, 0.5);
    transition: width 0.15s ease;
  }

  .viewer-progress-tick {
    position: absolute;
    top: -1px;
    width: 1px;
    height: 5px;
    background: rgba(255, 255, 255, 0.12);
    transform: translateX(-0.5px);
  }

  .viewer-progress-tick.past {
    background: rgba(139, 139, 255, 0.35);
  }

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

  .fullscreen-header {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .header-spacer {
    flex: 1;
  }

  .back-button {
    flex-shrink: 0;
    width: var(--min-touch-target-compact, 32px);
    height: var(--min-touch-target-compact, 32px);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.95);
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
