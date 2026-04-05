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
            onModeChange={(mode) => avatarState.setPlaneMode(mode)}
          />
        {/if}
      </div>
      <Viewer3DViewPresets />
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

  .viewer-3d-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-min, 14px);
  }
</style>
