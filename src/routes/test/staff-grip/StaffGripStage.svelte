<script lang="ts">
  import { T } from "@threlte/core";
  import {
    AVATAR_DEFINITIONS,
    Plane,
    PlaneMode,
    STAGE,
  } from "@austencloud/scene-3d";
  import type { AvatarDefinition, AvatarId } from "@austencloud/scene-3d";
  import type {
    AvatarGripDiagnostics,
    AvatarPoseDiagnostics,
    CollisionEvent,
  } from "@austencloud/scene-3d";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import LiveSequencePerformer3D from "$lib/shared/3d/performers/LiveSequencePerformer3D.svelte";

  interface Props {
    id: string;
    phase: number;
    sequence: SequenceData;
    /** Catalog character to pose; defaults to the local intake rig. */
    characterId?: CharacterId;
    onCollisionEvents?: (
      events: CollisionEvent[],
      diagnostics: AvatarPoseDiagnostics,
      gripDiagnostics: AvatarGripDiagnostics
    ) => void;
  }

  let { id, phase, sequence, characterId, onCollisionEvents }: Props =
    $props();

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
</script>

<T.AmbientLight intensity={1.15} />
<T.DirectionalLight position={[2.4, 4.5, 3.8]} intensity={1.7} castShadow />
<T.DirectionalLight position={[-3, 2.2, 1]} intensity={0.65} color="#99c7ff" />

<T.Group position.z={STAGE.AVATAR_GRID_OFFSET}>
  <Grid3D
    visiblePlanes={WALL_PLANE}
    gridMode="diamond"
    planeMode={PlaneMode.WALL}
    showLabels={true}
    showOrientationHelpers={false}
  />
</T.Group>

<LiveSequencePerformer3D
  {id}
  position={{ x: 0, y: 0, z: 0 }}
  facingAngle={0}
  characterId={characterId ?? (INTAKE_CHARACTER_ID as CharacterId)}
  propType={PropType.STAFF}
  {sequence}
  effectId="led"
  phaseOffsetSteps={phase}
  active={false}
  weldGrip={true}
  showEffects={false}
  enableLocomotion={false}
  enableFootPlanting={false}
  {onCollisionEvents}
/>
