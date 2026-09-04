<script lang="ts">
  /**
   * One route, on one body, at one phase.
   *
   * Deliberately the same stage the grip lab uses — same lights, same wall
   * grid, same performer component with locomotion and foot planting off — so
   * that a difference between the two panes is a difference between the two
   * notations and not between two scenes. The only additions are the shoulder
   * probe and the measurement overlay, and neither writes anything back.
   *
   * The prop is fixed to a staff. The document describes a staff, and its
   * thumb end and pinky end are staff ends; offering a prop picker here would
   * invite a comparison the source material does not make.
   */

  import { T } from "@threlte/core";
  import { Plane, PlaneMode, STAGE } from "@austencloud/scene-3d";
  import type {
    AvatarGripDiagnostics,
    AvatarPoseDiagnostics,
    CollisionEvent,
  } from "@austencloud/scene-3d";

  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import LiveSequencePerformer3D from "$lib/shared/3d/performers/LiveSequencePerformer3D.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  import ReachOverlay from "./ReachOverlay.svelte";
  import ShoulderProbe from "./ShoulderProbe.svelte";
  import type { ReachFrame } from "./reach-telemetry";

  interface Props {
    id: string;
    phase: number;
    sequence: SequenceData;
    characterId: CharacterId;
    /** Full grid with point labels, or rings only where a hand works. */
    gridEmphasis?: "reference" | "muted";
    /**
     * The frame the page measured. Passed back in rather than measured here,
     * so both panes take their numbers from one function and the overlay can
     * never draw a geometry the readouts disagree with.
     */
    overlayFrame?: ReachFrame | null;
    onCollisionEvents?: (
      events: CollisionEvent[],
      diagnostics: AvatarPoseDiagnostics,
      gripDiagnostics: AvatarGripDiagnostics
    ) => void;
    onShoulder?: (point: { x: number; y: number; z: number } | null) => void;
  }

  let {
    id,
    phase,
    sequence,
    characterId,
    gridEmphasis = "muted",
    overlayFrame = null,
    onCollisionEvents,
    onShoulder,
  }: Props = $props();

  /**
   * The translucent plane surface washes out the contrast a hand pose needs
   * and draws an arbitrary lit rectangle behind the performer. The rings, the
   * points and the centre marker already say where the plane is.
   */
  const PLANE_SURFACE_OPACITY = 0;
  const WALL_PLANE = new Set([Plane.WALL]);

  const showLabels = $derived(gridEmphasis === "reference");
</script>

<T.AmbientLight intensity={1.15} />
<T.DirectionalLight position={[2.4, 4.5, 3.8]} intensity={1.7} castShadow />
<T.DirectionalLight position={[-3, 2.2, 1]} intensity={0.65} color="#99c7ff" />

<LiveSequencePerformer3D
  {id}
  position={{ x: 0, y: 0, z: 0 }}
  facingAngle={0}
  {characterId}
  propType={PropType.STAFF}
  propLengthCm={null}
  {sequence}
  effectId="led"
  phaseOffsetSteps={phase}
  active={false}
  weldGrip={true}
  showEffects={false}
  enableLocomotion={false}
  enableFootPlanting={false}
  {onCollisionEvents}
>
  {#snippet gridSlot()}
    <T.Group position.z={STAGE.AVATAR_GRID_OFFSET}>
      <Grid3D
        visiblePlanes={WALL_PLANE}
        gridMode="diamond"
        planeMode={PlaneMode.WALL}
        planeOpacity={PLANE_SURFACE_OPACITY}
        {showLabels}
        showOrientationHelpers={false}
      />
    </T.Group>
  {/snippet}
</LiveSequencePerformer3D>

{#if onShoulder}
  <ShoulderProbe {onShoulder} />
{/if}

{#if overlayFrame?.hasData}
  <ReachOverlay frame={overlayFrame} />
{/if}
