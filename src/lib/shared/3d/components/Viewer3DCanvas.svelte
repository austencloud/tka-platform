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
  import Viewer3DScene from "./Viewer3DScene.svelte";
  import Viewer3DCamera from "./Viewer3DCamera.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    bluePropType?: string | null;
    redPropType?: string | null;
    onRendererReady?: (renderer: unknown) => void;
    onCameraStateChange?: (state: CameraStateSnapshot) => void;
  }

  let { sequenceData, currentStep, isPlaying, onCameraStateChange }: Props =
    $props();

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.avatarState);
</script>

<div class="viewer-3d-canvas">
  {#if avatarState && sequenceData}
    <Canvas>
      <Viewer3DCamera />
      <Viewer3DScene
        {sequenceData}
        {currentStep}
        {isPlaying}
        {avatarState}
      />
    </Canvas>
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

  .viewer-3d-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-min, 14px);
  }
</style>
