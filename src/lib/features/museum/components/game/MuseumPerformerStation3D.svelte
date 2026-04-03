<script lang="ts">
  /**
   * MuseumPerformerStation3D
   *
   * A 3D mannequin at a museum performer station that plays a TKA sequence
   * with spinning staves. Follows the exact same composition pattern as
   * PerformerPlatform.svelte (the proven working implementation).
   */
  import { untrack } from "svelte";
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import Prop3D from "$lib/shared/3d/components/props/Prop3D.svelte";
  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import { Plane } from "$lib/shared/3d/domain/enums/Plane";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { GridMode } from "$lib/shared/3d/domain/constants/grid-layout";
  import { MUSEUM_EXHIBIT_SEQUENCES, type MuseumSequenceData } from "../../data/museum-exhibit-sequences";
  import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    facingAngle: number;
    sequenceId?: string;
    autoPlay?: boolean;
    showGrid?: boolean;
  }

  let { stationId, worldX, worldZ, facingAngle, sequenceId, autoPlay = false, showGrid = false }: Props = $props();

  // The 3D avatar system uses Y=0 as grid center (shoulder height).
  // The stage floor is at groundY (≈ -1.56). For the museum (floor at Y=0),
  // we lift the avatar by -groundY so its feet land on the museum floor.
  //
  // STAGE_LIFT = shoulder height above floor. PLATFORM_HEIGHT = the pedestal
  // the performer stands on. avatarLocalPosition.y includes both so that
  // the IK targets, prop orbit center, and grid all align with the avatar's
  // visual shoulder height on top of the platform.
  const PLATFORM_HEIGHT = 0.3; // matches cylinder geometry (height 0.3, center at 0.15)
  const STAGE_LIFT = -userProportionsState.groundY; // ≈ 1.56m

  // World position includes platform height so IK, props, and grid all
  // sit at shoulder height above the platform — not 0.3m below it.
  // Avatar position is relative to the station group (which is at worldX, 0, worldZ)
  const avatarLocalPosition = $derived({ x: 0, y: STAGE_LIFT + PLATFORM_HEIGHT, z: 0 });

  // Build a minimal SequenceData from the museum manifest
  function buildSequenceData(museumSeq: MuseumSequenceData): SequenceData {
    return {
      id: `museum-performer-${stationId}`,
      word: museumSeq.word,
      steps: museumSeq.steps as readonly StepData[],
      isCircular: true,
    } as SequenceData;
  }

  // Create the avatar instance once — it persists across sequence swaps.
  // loadSequence() is called reactively whenever sequenceId changes.
  let performerState = $state<ReturnType<typeof createAvatarInstanceState> | null>(null);

  // Resolved sequence data (from hardcoded exhibits or Firestore)
  let resolvedSequence = $state<SequenceData | null>(null);

  // One-time init: create the avatar instance with DI services
  if (container.items.propStateInterpolator && container.items.sequenceConverter) {
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
    } catch (err) {
      console.warn(`[MuseumPerformer] Failed to init ${stationId}:`, err);
    }
  }

  // Resolve sequence whenever sequenceId changes — checks hardcoded
  // exhibits first, then falls back to loading from Firestore.
  // Mutations (loadSequence, play) are wrapped in untrack so the effect
  // only re-runs when sequenceId changes, not when internal state updates.
  $effect(() => {
    const id = sequenceId; // subscribe to sequenceId
    untrack(() => {
      if (!id || !performerState) return;

      const museumSeq = MUSEUM_EXHIBIT_SEQUENCES[id] ?? null;
      if (museumSeq) {
        resolvedSequence = buildSequenceData(museumSeq);
        performerState.loadSequence(resolvedSequence);
        performerState.loop = true;
        if (autoPlay) performerState.play();
        return;
      }

      // Not a hardcoded exhibit — try loading from Firestore
      const loader = container.items.browseLoader;
      if (!loader) return;

      loader.loadFullSequenceData(id, id).then((seq: SequenceData | null) => {
        if (!seq || !performerState) return;
        resolvedSequence = seq;
        performerState.loadSequence(seq);
        performerState.loop = true;
        if (autoPlay) performerState.play();
      }).catch((err: unknown) => {
        console.warn(`[MuseumPerformer] Failed to load sequence ${id}:`, err);
      });
    });
  });

  // Prop type: prefer the sequence's intended prop, fall back to global settings.
  // This way Shift+P cycles the museum performers too.
  const bluePropType = $derived.by((): PropType => {
    if (resolvedSequence?.intendedProp?.bluePropType) return resolvedSequence.intendedProp.bluePropType;
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    if (resolvedSequence?.intendedProp?.redPropType) return resolvedSequence.intendedProp.redPropType;
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });

  const platformColor = new THREE.Color(0x3a3028);
</script>

<!-- Station root group — positioned at world coords, children use local coords -->
<T.Group name={`performer-station-${stationId}`} position.x={worldX} position.z={worldZ}>

<!-- Circular platform (local y=0.15, x/z=0 since group handles world position) -->
<T.Mesh
  position.y={0.15}
  receiveShadow
>
  <T.CylinderGeometry args={[0.8, 0.9, 0.3, 24]} />
  <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
</T.Mesh>

<!--
  Performer positioning:

  avatarLocalPosition.y = STAGE_LIFT + PLATFORM_HEIGHT (≈ 1.86m)
    → IK targets and prop orbit at shoulder height above the platform ✓
    → Grid3D center at the same point ✓

  Avatar visual model needs feet at PLATFORM_HEIGHT (0.3m, platform top).
  Avatar3D internally computes groupY = position.y - feetOffset.
  The outer Group at -(STAGE_LIFT + PLATFORM_HEIGHT) + PLATFORM_HEIGHT = -STAGE_LIFT
  cancels the stage lift, leaving feet at PLATFORM_HEIGHT.
-->
{#if performerState}
  <!-- Visual offset: cancel STAGE_LIFT so feet land on platform top -->
  <T.Group position.y={-STAGE_LIFT}>
    <Avatar3D
      id={`museum-${stationId}`}
      bluePropState={performerState.bluePropState}
      redPropState={performerState.redPropState}
      position={avatarLocalPosition}
      {facingAngle}
      isActive={false}
      isMoving={false}
    />
  </T.Group>

  <!-- Props OUTSIDE the Group — already at correct world Y -->
  {#if performerState.bluePropState}
    <Prop3D propType={bluePropType}
      propState={performerState.bluePropState}
      color="blue"
      avatarPosition={avatarLocalPosition}
      {facingAngle}
      gridOffset={0.3}
      isActivePlayer={false}
    />
  {/if}

  {#if performerState.redPropState}
    <Prop3D propType={redPropType}
      propState={performerState.redPropState}
      color="red"
      avatarPosition={avatarLocalPosition}
      {facingAngle}
      gridOffset={0.3}
      isActivePlayer={false}
    />
  {/if}

  <!-- Grid planes at shoulder height — same centerPosition as props -->
  {#if showGrid}
    <Grid3D
      visiblePlanes={new Set([Plane.WALL])}
      centerPosition={avatarLocalPosition}
      {facingAngle}
      gridOffset={0.3}
      planeOpacity={0.12}
      showLabels={false}
      gridMode={(resolvedSequence?.gridMode ?? "diamond") as GridMode}
    />
  {/if}
{/if}
</T.Group>
