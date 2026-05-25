<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import LocomotingPerformer from "./LocomotingPerformer.svelte";

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const interpolatedPositions = $derived(stageState.interpolatedPositions);

  const avatarPath = "/models/avatars/ch01.glb";

  const halfW = $derived(choreography.stageWidth / 2);
  const halfD = $derived(choreography.stageDepth / 2);
</script>

<div class="preview-3d">
  <Canvas>
    <T.PerspectiveCamera
      makeDefault
      position={[halfW, 12, choreography.stageDepth + 5]}
      fov={50}
    >
      <OrbitControls
        target={[halfW, 0, halfD]}
        enableDamping
      />
    </T.PerspectiveCamera>

    <T.AmbientLight intensity={0.3} />
    <T.DirectionalLight position={[5, 10, 5]} intensity={0.7} castShadow />
    <T.DirectionalLight position={[-3, 8, -3]} intensity={0.3} />

    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow position={[halfW, 0, halfD]}>
      <T.PlaneGeometry args={[choreography.stageWidth, choreography.stageDepth]} />
      <T.MeshStandardMaterial color="#1a1a2e" />
    </T.Mesh>

    <T.GridHelper
      args={[Math.max(choreography.stageWidth, choreography.stageDepth), 10, "#444466", "#2a2a44"]}
      position={[halfW, 0.01, halfD]}
    />

    {#each interpolatedPositions as pose, i (choreography.performers[i]?.id)}
      <LocomotingPerformer
        {pose}
        {avatarPath}
        facing={pose.facing}
      />
    {/each}
  </Canvas>

  <div class="controls-hint">
    <span>Orbit: drag &middot; Zoom: scroll &middot; Pan: right-drag</span>
  </div>
</div>

<style>
  .preview-3d {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .controls-hint {
    position: absolute;
    bottom: var(--spacing-md, 12px);
    left: 50%;
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 80%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 4px 14px;
    border-radius: var(--border-radius-md, 8px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
</style>
