<script lang="ts">
  /**
   * PoseViewport
   *
   * Renders the current collision-lab pose inside the shared Scene3D —
   * the same scene used by the sequence viewer, so we get the forest
   * environment, grid planes, orbit controls, and lighting for free.
   *
   * The scene graph mirrors PerformerRig's structure:
   *
   *   Scene3D (owns camera, environment, grid visual)
   *     rig T.Group [footOffset, facing]
   *       Avatar3D (rig-local position=0)
   *       grid-forward T.Group [z=gridOffset]
   *         blue PropAnchor T.Group [grid-local pos]
   *           Prop3D (blue)
   *         red PropAnchor T.Group [grid-local pos]
   *           Prop3D (red)
   *
   * This nesting is the whole trick for correct IK. Avatar3D reads the
   * PropAnchor refs' world positions as IK targets, and Three.js computes
   * those via the transform chain — so the props always sit on the visible
   * grid regardless of where the avatar is standing or which way it faces.
   *
   * Scene3D also gets `avatarPositions=[footOffset]` so its internal Grid3D
   * visual is rendered at the same rig-root offset we use for props.
   */

  import { T } from "@threlte/core";
  import { Group } from "three";
  import Scene3D from "$lib/shared/3d/components/Scene3D.svelte";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Prop3D from "$lib/shared/3d/components/props/Prop3D.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
  import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { STAGE } from "$lib/shared/3d/scale/scale-constants";
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

  const labCtx = getCollisionLabContext();
  const planeMapper = new PlaneCoordinateMapper();
  const orientationMapper = new OrientationMapper();

  /**
   * Wall-plane grid sits 30cm forward of the performer's body. This is the
   * standard TKA convention: when you spin in wall plane, the plane is in
   * front of your eyes, not slicing through you. Matches Scene3D + PerformerRig.
   */
  const GRID_FORWARD_OFFSET = STAGE.AVATAR_GRID_OFFSET; // 0.3 m

  const POSITION_TO_GRID: Record<DiamondPosition, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
  };

  /**
   * Build a PropState3D for a hand target. The worldPosition is in
   * GRID-LOCAL space (the parent T.Group adds the grid-forward offset).
   *
   * The staff rotation is derived from the OrientationMapper:
   *   in  (radial)     → staffAngle = centerPathAngle + π
   *   out (antiradial) → staffAngle = centerPathAngle
   *
   * centerPathAngle comes from LOCATION_ANGLES for the cardinal position
   * (e.g. NORTH = -π/2). This is the same pipeline the sequence viewer
   * uses, so staff visuals match everywhere.
   */
  function buildPropState(
    plane: Plane,
    position: DiamondPosition,
    orientation: "in" | "out"
  ): PropState3D {
    const loc = POSITION_TO_GRID[position];
    const centerPathAngle = LOCATION_ANGLES[loc];
    const staffAngle = orientationMapper.mapOrientationToAngle(
      orientation === "in" ? Orientation.IN : Orientation.OUT,
      centerPathAngle
    );
    const worldPosition = planeMapper.gridLocationToPosition3D(plane, loc);
    const worldRotation = planeMapper.calculatePropRotation(plane, staffAngle);
    return {
      centerPathAngle,
      staffRotationAngle: staffAngle,
      plane,
      worldPosition,
      worldRotation,
    };
  }

  const bluePropState = $derived.by<PropState3D | null>(() => {
    const pose = labCtx.state.currentPose;
    if (!pose) return null;
    return buildPropState(
      pose.blueHand.plane,
      pose.blueHand.position,
      pose.blueHand.orientation
    );
  });

  const redPropState = $derived.by<PropState3D | null>(() => {
    const pose = labCtx.state.currentPose;
    if (!pose) return null;
    return buildPropState(
      pose.redHand.plane,
      pose.redHand.position,
      pose.redHand.orientation
    );
  });

  /**
   * Show the grid for both hands' planes. For same-plane poses this is
   * a single plane; for cross-plane poses (the main reason this lab
   * exists) it's two planes — a wall + wheel intersection, for example.
   */
  const visiblePlanes = $derived.by<Set<Plane>>(() => {
    const pose = labCtx.state.currentPose;
    if (!pose) return new Set();
    return new Set([pose.blueHand.plane, pose.redHand.plane]);
  });

  // The reviewer drives these live via sliders in StanceControls. Because
  // foot IK is disabled, translating the rig root moves the whole body
  // rigidly (feet, hips, torso, arms). The props and grid stay fixed in
  // world space, so the performer walks around them.
  const footOffset = $derived({
    x: labCtx.state.footOffsetX,
    y: 0,
    z: labCtx.state.footOffsetZ,
  });
  const facingAngle = $derived(labCtx.state.rootYawRad);
  const spinePitchOffset = $derived(labCtx.state.spinePitchRad);

  // Scene3D's avatarPositions drives where its Grid3D visual is rendered.
  // We pass the footOffset so the grid moves with the performer... wait no.
  // Actually we want the opposite: grid stays in world space, performer
  // moves around it. So we pass a SINGLE grid position at (0,0,0) and
  // leave the avatar to drift via the rig root.
  const gridAnchorPositions = [{ x: 0, y: 0, z: 0, facingAngle: 0 }];

  // PropAnchor refs — Avatar3D reads world positions from these for IK.
  let bluePropAnchorRef = $state<Group | undefined>(undefined);
  let redPropAnchorRef = $state<Group | undefined>(undefined);

  const SEVERITY_RANK: Record<"graze" | "clip" | "penetrate", number> = {
    graze: 1,
    clip: 2,
    penetrate: 3,
  };

  function handleCollisionEvents(events: CollisionEvent[]) {
    if (!events || events.length === 0) {
      labCtx.state.updateCollision({ severity: "clear", zones: [] });
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
    labCtx.state.updateCollision(snapshot);
  }
</script>

<div class="pose-viewport">
  <Scene3D
    cameraPreset="perspective"
    showGrid={true}
    showLabels={false}
    {visiblePlanes}
    avatarPositions={gridAnchorPositions}
    backgroundType={BackgroundType.FIREFLY_FOREST}
  >
    {#snippet children()}
      <!-- Rig root: positions the performer at the stance's footOffset. -->
      <T.Group
        position={[footOffset.x, footOffset.y, footOffset.z]}
        rotation.y={facingAngle}
      >
        {#if bluePropState && redPropState}
          <Avatar3D
            {bluePropState}
            {redPropState}
            position={{ x: 0, y: 0, z: 0 }}
            facingAngle={0}
            {spinePitchOffset}
            visible={true}
            isActive={false}
            enableLocomotion={false}
            {bluePropAnchorRef}
            {redPropAnchorRef}
            onCollisionEvents={handleCollisionEvents}
          />
        {/if}

        <!--
          Grid-forward offset group: everything beneath this is in
          "grid-local" space, matching Scene3D's internal grid positioning.
          Props placed at plane-mapper local coordinates end up on the
          visible grid because this group is at +gridOffset from the rig.

          BUT: since Scene3D renders its grid at its own origin (not at
          rig root + gridOffset), we'd double up the offset if we nested
          our props under the rig. So instead, we keep this group at the
          SAME world position as Scene3D's grid — by NOT applying the rig
          transform. That means props at grid-local coordinates line up.
        -->
      </T.Group>

      <!--
        Props live in WORLD space (not inside the rig) so they stay fixed
        relative to Scene3D's grid as the performer walks around.
        Scene3D's grid is rendered at z=gridOffset from its avatar anchor
        (0,0,0), so our prop anchors use the same base offset.
      -->
      <T.Group position.z={GRID_FORWARD_OFFSET}>
        {#if bluePropState}
          <T.Group
            bind:ref={bluePropAnchorRef}
            position.x={bluePropState.worldPosition.x}
            position.y={bluePropState.worldPosition.y}
            position.z={bluePropState.worldPosition.z}
          >
            <Prop3D propType={PropType.STAFF} propState={bluePropState} color="blue" />
          </T.Group>
        {/if}
        {#if redPropState}
          <T.Group
            bind:ref={redPropAnchorRef}
            position.x={redPropState.worldPosition.x}
            position.y={redPropState.worldPosition.y}
            position.z={redPropState.worldPosition.z}
          >
            <Prop3D propType={PropType.STAFF} propState={redPropState} color="red" />
          </T.Group>
        {/if}
      </T.Group>
    {/snippet}
  </Scene3D>
</div>

<style>
  .pose-viewport {
    width: 100%;
    height: 100%;
    /* No min-height: the parent grid cell dictates size so the viewer
       shares vertical space with the candidate grid in split-screen
       layout. The Scene3D container also needs its default min-height
       override so this constraint actually takes effect. */
    background: var(--theme-panel-bg);
    border-radius: 8px;
    overflow: hidden;
  }
  .pose-viewport :global(.scene-container) {
    min-height: 0;
    height: 100%;
  }
</style>
