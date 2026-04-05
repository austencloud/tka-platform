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
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
  import Viewer3DGridPopover from "./Viewer3DGridPopover.svelte";
  import PlaneModeToggle from "./controls/PlaneModeToggle.svelte";
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
    onRendererReady?: (renderer: unknown) => void;
    onCameraStateChange?: (state: CameraStateSnapshot) => void;
  }

  let { sequenceData, currentStep, isPlaying, hideOverlays = false, onCameraStateChange }: Props =
    $props();

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.avatarState);

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
    {#if !hideOverlays}
      <div class="top-controls">
        <Viewer3DGridPopover {sequenceData} />
        {#if avatarState}
          <PlaneModeToggle
            mode={avatarState.planeMode}
            bluePlane={avatarState.currentBeatBluePlane}
            redPlane={avatarState.currentBeatRedPlane}
            currentBeatIndex={avatarState.currentStepIndex}
            totalBeats={avatarState.totalSteps}
            hasBeatOverrides={avatarState.hasBeatOverrides}
            onModeChange={(mode) => avatarState.setPlaneMode(mode)}
            onHandPlaneChange={(hand, plane) => avatarState.setBeatHandPlane(avatarState.currentStepIndex, hand, plane)}
          />
          {#if avatarState.planeMode === 'dual-wheel'}
            <button
              class="rotation-variant-btn"
              onclick={() => avatarState.cycleRotationVariant()}
              title="Cycle rotation axis variant"
            >
              {avatarState.rotationVariantLabel}
            </button>
          {/if}
        {/if}
      </div>
      <Viewer3DViewPresets />
      {#if avatarState && avatarState.totalSteps > 1}
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

  .rotation-variant-btn {
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #f59e0b;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .rotation-variant-btn:hover {
    background: rgba(245, 158, 11, 0.15);
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
