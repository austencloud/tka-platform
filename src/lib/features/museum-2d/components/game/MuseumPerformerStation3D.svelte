<script lang="ts">
  /**
   * MuseumPerformerStation3D
   *
   * A 3D mannequin at a museum performer station that plays a TKA sequence
   * with spinning staves. Follows the exact same composition pattern as
   * PerformerPlatform.svelte (the proven working implementation).
   */
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Staff3D from "$lib/shared/3d/components/Staff3D.svelte";
  import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { MUSEUM_EXHIBIT_SEQUENCES, type MuseumSequenceData } from "../../data/museum-exhibit-sequences";
  import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    facingAngle: number;
    sequenceId?: string;
    autoPlay?: boolean;
  }

  let { stationId, worldX, worldZ, facingAngle, sequenceId, autoPlay = false }: Props = $props();

  // The 3D avatar system uses Y=0 as grid center (shoulder height).
  // The stage floor is at groundY (≈ -1.56). For the museum (floor at Y=0),
  // we lift the avatar by -groundY so its feet land on the museum floor.
  //
  // We pass world positions directly to Avatar3D and Staff3D (no Group wrapper)
  // because Avatar3D's toWorldPosition() adds position.x/y/z to convert
  // grid-local prop coordinates to world space for the IK solver. If we used
  // a Group wrapper with position={0,0,0}, the IK targets would be at grid-local
  // coordinates while the GLTF skeleton sits at the Group's world position,
  // causing hands to miss the staves.
  const STAGE_LIFT = -userProportionsState.groundY; // ≈ 1.56m

  // World position passed directly to Avatar3D and Staff3D — matches
  // the working PerformerPlatform.svelte pattern exactly.
  const avatarWorldPosition = $derived({ x: worldX, y: STAGE_LIFT, z: worldZ });

  // Build a minimal SequenceData from the museum manifest
  function buildSequenceData(museumSeq: MuseumSequenceData): SequenceData {
    return {
      id: `museum-performer-${stationId}`,
      word: museumSeq.word,
      steps: museumSeq.steps as readonly StepData[],
      isCircular: true,
    } as SequenceData;
  }

  const museumSeq = sequenceId ? MUSEUM_EXHIBIT_SEQUENCES[sequenceId] ?? null : null;
  const sequence = museumSeq ? buildSequenceData(museumSeq) : null;

  // Only create animation state if we have a sequence to play
  // (avoids errors from DI services when no sequence data exists)
  let performerState: ReturnType<typeof createAvatarInstanceState> | null = null;

  if (sequence && container.items.propStateInterpolator && container.items.sequenceConverter) {
    try {
      performerState = createAvatarInstanceState(
        {
          id: `museum-station-${stationId}`,
          positionX: worldX,
          positionZ: worldZ,
        },
        {
          propInterpolator: container.items.propStateInterpolator,
          sequenceConverter: container.items.sequenceConverter,
        }
      );

      performerState.loadSequence(sequence);
      performerState.loop = true;
      if (autoPlay) {
        performerState.play();
      }
    } catch (err) {
      console.warn(`[MuseumPerformer] Failed to init ${stationId}:`, err);
      performerState = null;
    }
  }

  const platformColor = new THREE.Color(0x3a3028);
</script>

<!-- Circular platform under the performer (stays at world floor level) -->
<T.Mesh
  position.x={worldX}
  position.y={0.15}
  position.z={worldZ}
  receiveShadow
>
  <T.CylinderGeometry args={[0.8, 0.9, 0.3, 24]} />
  <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
</T.Mesh>

<!--
  Performer positioning (proven via console.log diagnostics):

  Problem: Avatar3D.position.y serves TWO purposes:
    1. Where to render the model (groupY = position.y - feetOffset)
    2. Y offset for IK target calculation (toWorldPosition adds position.y)

  With position.y = STAGE_LIFT (1.562):
    - IK targets: correct (1.562 + propWorldY ≈ 2.08) ✓
    - Staff positions: correct (1.562 + propWorldY ≈ 2.08) ✓
    - Model feet: WRONG (at Y=1.562 instead of floor Y=0) ✗

  Fix: Keep position.y = STAGE_LIFT for correct IK math, but wrap
  Avatar3D in a Group at Y = -STAGE_LIFT to push the visual model
  down to floor level. Staff3D stays OUTSIDE the Group (it renders
  at the correct world Y already).

  Result:
    - Model feet: 1.562 - 1.562 = 0 (floor) ✓
    - IK targets: 1.562 + propWorldY (world space, correct) ✓
    - Staff visual: 1.562 + propWorldY (same, matches IK) ✓
-->
{#if performerState}
  <!-- Avatar wrapped in offset Group: -STAGE_LIFT puts feet at floor, +0.3 lifts onto platform -->
  <T.Group position.y={-STAGE_LIFT + 0.3}>
    <Avatar3D
      id={`museum-${stationId}`}
      bluePropState={performerState.bluePropState}
      redPropState={performerState.redPropState}
      position={avatarWorldPosition}
      {facingAngle}
      isActive={false}
      isMoving={false}
    />
  </T.Group>

  <!-- Staves OUTSIDE the Group — already at correct world Y -->
  {#if performerState.bluePropState}
    <Staff3D
      propState={performerState.bluePropState}
      color="blue"
      avatarPosition={avatarWorldPosition}
      {facingAngle}
      gridOffset={0.3}
      isActivePlayer={false}
    />
  {/if}

  {#if performerState.redPropState}
    <Staff3D
      propState={performerState.redPropState}
      color="red"
      avatarPosition={avatarWorldPosition}
      {facingAngle}
      gridOffset={0.3}
      isActivePlayer={false}
    />
  {/if}
{/if}
