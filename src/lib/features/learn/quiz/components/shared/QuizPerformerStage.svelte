<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import { untrack, onDestroy } from "svelte";
  import { PerformerRig, Plane, PlaneMode, userProportionsState } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { OrbitControls } from "@threlte/extras";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    createAvatarInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let { sequence }: { sequence: SequenceData | null } = $props();

  const PLATFORM_HEIGHT = 0.2;
  const groundOffset = $derived(-userProportionsState.groundY + PLATFORM_HEIGHT);

  let performerState = $state<ReturnType<typeof createAvatarInstanceState> | null>(null);

  try {
    performerState = createAvatarInstanceState(
      { id: "quiz-performer", positionX: 0, positionZ: 0 },
      makeStandaloneDeps()
    );
  } catch (err) {
    console.warn("[QuizPerformerStage] Failed to init:", err);
  }

  $effect(() => {
    const seq = sequence;
    untrack(() => {
      if (!seq || !performerState) return;
      performerState.loadSequence(seq);
      performerState.loop = true;
      performerState.play();
    });
  });

  onDestroy(() => {
    if (performerState) {
      performerState.stop();
      performerState.destroy();
    }
  });
</script>

<div class="stage-container">
  <Canvas>
    <T.AmbientLight intensity={0.5} />
    <T.DirectionalLight position={[3, 8, 5]} intensity={2} castShadow />

    <T.PerspectiveCamera makeDefault position={[0, 2.5, 5]} fov={40}>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate={false}
        target={[0, 1.2, 0]}
      />
    </T.PerspectiveCamera>

    <!-- Subtle platform disc -->
    <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
      <T.CylinderGeometry args={[0.7, 0.8, PLATFORM_HEIGHT, 24]} />
      <T.MeshStandardMaterial
        color="#2a2520"
        roughness={0.85}
      />
    </T.Mesh>

    {#if performerState}
      <PerformerRig
        position={{ x: 0, z: 0 }}
        facingAngle={0}
        planeMode={PlaneMode.WALL}
        avatarState={performerState}
        showGrid={false}
        visiblePlanes={new Set([Plane.WALL])}
        gridMode={((sequence?.gridMode ?? "diamond") as GridMode)}
        bluePropType={PropType.STAFF}
        redPropType={PropType.STAFF}
        {groundOffset}
        enableLocomotion={true}
        enableFootPlanting={true}
      />
    {/if}
  </Canvas>
</div>

<style>
  .stage-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
    border-radius: 16px;
    overflow: hidden;
    background: radial-gradient(
      ellipse at 50% 80%,
      color-mix(in srgb, var(--theme-panel-bg) 95%, var(--theme-accent)),
      var(--theme-panel-bg)
    );
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
</style>
