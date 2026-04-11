<script lang="ts">
  /**
   * PoseViewport
   *
   * Renders the current collision-lab pose in a Threlte canvas with a
   * single avatar and both props. Receives collision events from the
   * avatar and forwards them to state.
   *
   * The stance variant's root yaw is applied via the `facingAngle` prop
   * on Avatar3D. Spine pitch is NOT applied in Phase 1 — there is no
   * existing hook to inject spine bone offsets without modifying the
   * skeleton service. For now the "leaned forward" variant is visually
   * identical to "neutral"; when spine override lands, wire it here.
   */

  import { Canvas, T } from "@threlte/core";
  import { Quaternion, Vector3 } from "three";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropState3D } from "$lib/shared/3d/domain/models/PropState3D";
  import type { CollisionEvent } from "$lib/shared/3d/services/contracts/ICollisionDetector";
  import type { Plane } from "$lib/shared/3d/domain/enums/Plane";
  import type {
    DiamondPosition,
    CollisionSnapshot,
    CollisionSnapshotZone,
    SnapshotSeverity,
  } from "../domain/types";
  import { getCollisionLabContext } from "../context/collision-lab-context";

  const { state } = getCollisionLabContext();
  const planeMapper = new PlaneCoordinateMapper();

  const POSITION_TO_GRID: Record<DiamondPosition, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
  };

  /**
   * Build a PropState3D for a hand target. Avatar3D's IK uses worldPosition
   * for hand placement; orientation is stored in PropDefinition but has no
   * Phase 1 effect on IK — Phase 2 will use it when elbow routing is wired.
   */
  function buildPropState(
    plane: Plane,
    position: DiamondPosition,
    _orientation: "in" | "out"
  ): PropState3D {
    const loc = POSITION_TO_GRID[position];
    const worldPosition = planeMapper.gridLocationToPosition3D(plane, loc);
    const worldRotation = planeMapper.calculatePropRotation(plane, 0);
    return {
      centerPathAngle: 0,
      staffRotationAngle: 0,
      plane,
      worldPosition,
      worldRotation,
    };
  }

  const bluePropState = $derived.by<PropState3D | null>(() => {
    const pose = state.currentPose;
    if (!pose) return null;
    return buildPropState(pose.plane, pose.blueHand.position, pose.blueHand.orientation);
  });

  const redPropState = $derived.by<PropState3D | null>(() => {
    const pose = state.currentPose;
    if (!pose) return null;
    return buildPropState(pose.plane, pose.redHand.position, pose.redHand.orientation);
  });

  const facingAngle = $derived(state.currentStanceVariant.rootYawRad);
  const spinePitchOffset = $derived(state.currentStanceVariant.spinePitchRad);

  const SEVERITY_RANK: Record<"graze" | "clip" | "penetrate", number> = {
    graze: 1,
    clip: 2,
    penetrate: 3,
  };

  function handleCollisionEvents(events: CollisionEvent[]) {
    if (!events || events.length === 0) {
      state.updateCollision({ severity: "clear", zones: [] });
      return;
    }
    let worst = events[0]!;
    for (const e of events) {
      if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[worst.severity]) worst = e;
    }
    const zones: CollisionSnapshotZone[] = events.map((e) => ({
      type: e.zone,
      depthCm: e.penetrationDepth * 100,
      description: e.description,
    }));
    const snapshot: CollisionSnapshot = {
      severity: worst.severity as SnapshotSeverity,
      zones,
    };
    state.updateCollision(snapshot);
  }
</script>

<div class="pose-viewport">
  <Canvas>
    <T.Color attach="background" args={["#1a1f2e"]} />
    <T.PerspectiveCamera makeDefault position={[0, 1.4, 3.5]} fov={35}>
      <T.Object3D position={[0, 1.2, 0]} />
    </T.PerspectiveCamera>
    <T.AmbientLight intensity={0.6} />
    <T.DirectionalLight position={[3, 5, 4]} intensity={0.8} />

    {#if bluePropState && redPropState}
      <!--
        isActive={false} is important here: isActive={true} assigns the
        avatar to LAYER_PLAYER_BODY (layer 1), which is the first-person
        viewmodel layer — hidden from the default camera (layer 0). We
        want a third-person demo figure, so we leave it on LAYER_WORLD.
      -->
      <Avatar3D
        {bluePropState}
        {redPropState}
        {facingAngle}
        {spinePitchOffset}
        visible={true}
        isActive={false}
        enableLocomotion={false}
        onCollisionEvents={handleCollisionEvents}
      />
    {/if}
  </Canvas>
</div>

<style>
  .pose-viewport {
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--theme-panel-bg);
    border-radius: 8px;
    overflow: hidden;
  }
</style>
