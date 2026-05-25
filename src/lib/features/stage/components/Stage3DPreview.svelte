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
</script>

<div class="preview-3d">
  <Canvas>
    <!-- Camera -->
    <T.PerspectiveCamera
      makeDefault
      position={[choreography.stageWidth / 2, 12, choreography.stageDepth + 5]}
      fov={50}
    >
      <OrbitControls
        target={[choreography.stageWidth / 2, 0, choreography.stageDepth / 2]}
        enableDamping
      />
    </T.PerspectiveCamera>

    <!-- Lighting -->
    <T.AmbientLight intensity={0.4} />
    <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} castShadow />

    <!-- Stage floor -->
    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[choreography.stageWidth, choreography.stageDepth]} />
      <T.MeshStandardMaterial color="#1e2a3a" />
    </T.Mesh>

    <!-- Stage grid lines -->
    <T.GridHelper
      args={[Math.max(choreography.stageWidth, choreography.stageDepth), 10, "#3a5a7a", "#2a3a4a"]}
      position={[choreography.stageWidth / 2, 0.01, choreography.stageDepth / 2]}
    />

    <!-- Performers -->
    {#each interpolatedPositions as pose, i (choreography.performers[i]?.id)}
      <LocomotingPerformer
        {pose}
        {avatarPath}
        facing={pose.facing}
      />
    {/each}
  </Canvas>

  <div class="overlay-hint">
    <span>Orbit: drag | Zoom: scroll | Pan: right-drag</span>
  </div>
</div>

<style>
  .preview-3d {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
  }
  .overlay-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: #0008;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    color: #8888aa;
    pointer-events: none;
  }
</style>
