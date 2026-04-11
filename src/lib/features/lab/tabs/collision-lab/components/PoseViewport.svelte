<script lang="ts">
  /**
   * PoseViewport
   *
   * Renders the current collision-lab pose inside the shared Scene3D —
   * the same scene used by the sequence viewer, so we get the forest
   * environment, grid planes, orbit controls, and lighting for free.
   *
   * We add on top:
   *   - Two visible props (Prop3D) positioned at the hand grid targets
   *   - An Avatar3D whose root position is driven by the current stance
   *     variant's (footOffsetX, footOffsetZ) — translating the root
   *     moves the whole body as a rigid unit, which is what we want
   *     since foot IK is disabled
   *   - The animator's external spine pitch for lean-forward variants
   *   - A collision-event callback that pipes the detector's per-frame
   *     output into state
   */

  import { T } from "@threlte/core";
  import Scene3D from "$lib/shared/3d/components/Scene3D.svelte";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Prop3D from "$lib/shared/3d/components/props/Prop3D.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { BackgroundType } from "@austencloud/backgrounds";
  import type { PropState3D } from "$lib/shared/3d/domain/models/PropState3D";
  import type { CollisionEvent } from "$lib/shared/3d/services/contracts/ICollisionDetector";
  import { Plane } from "$lib/shared/3d/domain/enums/Plane";
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
   * for hand placement; orientation is stored in PoseDefinition but has no
   * Phase 1 effect on IK (Phase 2 will use it when elbow routing lands).
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

  /** Only show the grid for the pose's current plane — less visual clutter. */
  const visiblePlanes = $derived.by<Set<Plane>>(() => {
    const pose = state.currentPose;
    return new Set(pose ? [pose.plane] : []);
  });

  // Stance variant drives where the avatar actually stands on the floor.
  // Root position translation moves the whole body rigidly (feet, hips,
  // torso) which is exactly what we want for "the performer steps here."
  const avatarPosition = $derived({
    x: state.currentStanceVariant.footOffsetX,
    y: 0,
    z: state.currentStanceVariant.footOffsetZ,
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
  <Scene3D
    cameraPreset="perspective"
    showGrid={true}
    showLabels={false}
    {visiblePlanes}
    backgroundType={BackgroundType.FIREFLY_FOREST}
  >
    {#snippet children()}
      {#if bluePropState}
        <T.Group position={[bluePropState.worldPosition.x, bluePropState.worldPosition.y, bluePropState.worldPosition.z]}>
          <Prop3D propType={PropType.STAFF} propState={bluePropState} color="blue" />
        </T.Group>
      {/if}
      {#if redPropState}
        <T.Group position={[redPropState.worldPosition.x, redPropState.worldPosition.y, redPropState.worldPosition.z]}>
          <Prop3D propType={PropType.STAFF} propState={redPropState} color="red" />
        </T.Group>
      {/if}
      {#if bluePropState && redPropState}
        <!--
          isActive={false} keeps the avatar on LAYER_WORLD so the
          third-person camera can see it (isActive={true} assigns the
          first-person viewmodel layer which is hidden here).
        -->
        <Avatar3D
          {bluePropState}
          {redPropState}
          position={avatarPosition}
          {facingAngle}
          {spinePitchOffset}
          visible={true}
          isActive={false}
          enableLocomotion={false}
          onCollisionEvents={handleCollisionEvents}
        />
      {/if}
    {/snippet}
  </Scene3D>
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
