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
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
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
    <button
      class="exit-3d-button"
      onclick={(e) => { e.stopPropagation(); viewer3DState.exit3D(); }}
      aria-label="Exit 3D view"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Exit 3D
    </button>
    <button
      class="grid-toggle"
      class:active={viewer3DState.showGrid}
      onclick={(e) => { e.stopPropagation(); viewer3DState.toggleGrid(); }}
      aria-label={viewer3DState.showGrid ? 'Hide grid planes' : 'Show grid planes'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
      Grid
    </button>
    <Viewer3DViewPresets />
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

  .exit-3d-button {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 0.2s ease;
  }
  .exit-3d-button:hover {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
  }

  .grid-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }
  .grid-toggle:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.9);
  }
  .grid-toggle.active {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
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
