<script lang="ts">
  /**
   * MuseumPerformerStation3D
   *
   * A 3D mannequin at a museum performer station that plays a TKA sequence
   * with spinning staves. Uses PerformerRig for the unified transform hierarchy
   * — no manual STAGE_LIFT math, no sibling Avatar3D/Prop3D/Grid3D calls.
   */
  import { untrack } from "svelte";
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import PerformerRig from "$lib/shared/3d/components/PerformerRig.svelte";
  import { Plane } from "$lib/shared/3d/domain/enums/Plane";
  import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { GridMode } from "$lib/shared/3d/domain/constants/grid-layout";
  import { MUSEUM_EXHIBIT_SEQUENCES, type MuseumSequenceData } from "../../data/museum-exhibit-sequences";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    facingAngle: number;
    sequenceId?: string;
    autoPlay?: boolean;
    showGrid?: boolean;
  }

  const props: Props = $props();

  // Resolve defaults (plain consts for Three.js init; sequenceId is reactive via props access in $effect)
  const stationId = props.stationId;
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const facingAngle = props.facingAngle;
  const autoPlay = props.autoPlay ?? false;
  const showGrid = props.showGrid ?? false;

  // Platform height — passed as groundOffset to PerformerRig so the entire
  // transform hierarchy (avatar, props, grid) is lifted onto the pedestal.
  const PLATFORM_HEIGHT = 0.3; // matches cylinder geometry (height 0.3, center at 0.15)

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
    const id = props.sequenceId; // subscribe to sequenceId reactively via props object
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
  {#if performerState}
    <PerformerRig
      position={{ x: 0, z: 0 }}
      {facingAngle}
      planeMode={PlaneMode.WALL}
      avatarState={performerState}
      {showGrid}
      visiblePlanes={new Set([Plane.WALL])}
      gridMode={(resolvedSequence?.gridMode ?? "diamond") as GridMode}
      {bluePropType}
      {redPropType}
      groundOffset={PLATFORM_HEIGHT}
    >
      {#snippet extras()}
        <!-- Circular platform -->
        <T.Mesh position.y={0.15} castShadow receiveShadow>
          <T.CylinderGeometry args={[0.8, 0.9, 0.3, 24]} />
          <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
        </T.Mesh>
      {/snippet}
    </PerformerRig>
  {/if}
</T.Group>
