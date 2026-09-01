<script lang="ts">
  import { onDestroy } from "svelte";
  import { T, useTask } from "@threlte/core";
  import {
    AVATAR_DEFINITIONS,
    PerformerRig,
    Plane,
    PlaneMode,
    PropType,
    STAGE,
    userProportionsState,
  } from "@austencloud/scene-3d";
  import type {
    AvatarDefinition,
    AvatarId,
    PropState3D,
  } from "@austencloud/scene-3d";
  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import {
    calculatePropQuaternion,
    planeAngleToWorldPosition,
  } from "$lib/shared/3d/domain/constants/plane-transforms";
  import {
    createCharacterInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/character-instance-state.svelte";

  interface Props {
    playing: boolean;
    onready?: () => void;
  }

  let { playing, onready }: Props = $props();

  const INTAKE_CHARACTER_ID = "intake-current" as AvatarId;
  const INTAKE_CHARACTER: AvatarDefinition = {
    id: INTAKE_CHARACTER_ID,
    name: "Current intake",
    modelPath: "/models/avatars/bakeoff/intake-current.glb",
    description: "Latest locally staged character intake",
    availability: "local-evaluation",
  };

  // The intake slot intentionally stays out of the deployable character
  // catalog. This local-only route registers it with the existing catalog
  // owner so PerformerRig can exercise the exact production load path.
  if (!AVATAR_DEFINITIONS.some(({ id }) => id === INTAKE_CHARACTER_ID)) {
    AVATAR_DEFINITIONS.push(INTAKE_CHARACTER);
  }

  const WALL_PLANE = new Set([Plane.WALL]);
  const BLUE_HOME_ANGLE = 0;
  const RED_HOME_ANGLE = Math.PI;
  const PATH_SWING = Math.PI / 10;
  const STAFF_SWING = Math.PI / 9;
  const MOTION_RATE = (Math.PI * 2) / 7;

  let phase = $state(0);
  let characterState = $state<ReturnType<
    typeof createCharacterInstanceState
  > | null>(null);

  try {
    characterState = createCharacterInstanceState(
      { id: "staff-grip-performer", positionX: 0, positionZ: 0 },
      makeStandaloneDeps()
    );
  } catch (error) {
    console.warn("[StaffGrip] Character state failed to initialize:", error);
  }

  function makeStaffState(pathAngle: number, staffAngle: number): PropState3D {
    return {
      plane: Plane.WALL,
      centerPathAngle: pathAngle,
      staffRotationAngle: staffAngle,
      worldPosition: planeAngleToWorldPosition(
        Plane.WALL,
        pathAngle,
        userProportionsState.handPointRadius
      ),
      worldRotation: calculatePropQuaternion(Plane.WALL, staffAngle),
    };
  }

  // Each hand travels over a short arc on the canonical hand-point ring while
  // the staff rocks through the same beat. Nothing here invents a second IK or
  // prop system; these are the two PropState3D inputs production playback owns.
  const bluePropState = $derived.by(() => {
    const travel = Math.sin(phase) * PATH_SWING;
    const staff = Math.sin(phase + Math.PI / 2) * STAFF_SWING;
    return makeStaffState(BLUE_HOME_ANGLE - travel, staff);
  });
  const redPropState = $derived.by(() => {
    const travel = Math.sin(phase) * PATH_SWING;
    const staff = -Math.sin(phase + Math.PI / 2) * STAFF_SWING;
    return makeStaffState(RED_HOME_ANGLE + travel, staff);
  });

  const groundOffset = $derived(-userProportionsState.groundY);

  useTask((delta) => {
    if (!playing) return;
    phase = (phase + Math.min(delta, 0.05) * MOTION_RATE) % (Math.PI * 2);
  });

  onDestroy(() => {
    characterState?.destroy();
  });
</script>

<T.AmbientLight intensity={1.15} />
<T.DirectionalLight position={[2.4, 4.5, 3.8]} intensity={1.7} castShadow />
<T.DirectionalLight position={[-3, 2.2, 1]} intensity={0.65} color="#99c7ff" />

{#if characterState}
  <PerformerRig
    position={{ x: 0, z: 0 }}
    facingAngle={0}
    planeMode={PlaneMode.WALL}
    avatarState={characterState}
    avatarId={INTAKE_CHARACTER_ID}
    {bluePropState}
    {redPropState}
    bluePropType={PropType.STAFF}
    redPropType={PropType.STAFF}
    visiblePlanes={WALL_PLANE}
    gridMode="diamond"
    {groundOffset}
    enableLocomotion={false}
    enableRootMotion={false}
    enableFootPlanting={true}
    weldGrip={true}
    headDodge={true}
    isPlaying={playing}
    onAvatarSwapped={() => onready?.()}
  >
    {#snippet gridSlot()}
      <T.Group position.z={STAGE.AVATAR_GRID_OFFSET}>
        <Grid3D
          visiblePlanes={WALL_PLANE}
          gridMode="diamond"
          planeMode={PlaneMode.WALL}
          showLabels={true}
          showOrientationHelpers={false}
        />
      </T.Group>
    {/snippet}
  </PerformerRig>
{/if}
