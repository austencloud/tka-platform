<script lang="ts">
  /**
   * TelekineticFormation3D
   *
   * A ritual scene where acolytes stand around a center point with arms
   * outstretched, "telekinetically" controlling floating staffs that trace
   * the same sequence on all three primary planes simultaneously.
   *
   * Center: 3 PerformerRigs (one per plane) — props visible, no avatar, grid visible.
   * Perimeter: 4 acolytes — avatar visible, no props, no grid.
   * The acolytes load the same sequence so their IK-driven arms mime the motions,
   * creating the illusion of telekinetic manipulation.
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
    sequenceId?: string;
    autoPlay?: boolean;
  }

  const props: Props = $props();

  const stationId = props.stationId;
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const autoPlay = props.autoPlay ?? true;

  // Ritual platform — larger and more dramatic than standard performer platforms
  const PLATFORM_RADIUS = 2.5;
  const PLATFORM_HEIGHT = 0.3;
  const platformColor = new THREE.Color(0x2a1f18);
  const platformRingColor = new THREE.Color(0x4a3828);

  // Acolyte positions: 4 positions in a square around center, facing inward.
  // Distance from center in world units (meters).
  const ACOLYTE_DISTANCE = 1.8;
  const ACOLYTE_POSITIONS = [
    { x: -ACOLYTE_DISTANCE, z: -ACOLYTE_DISTANCE, facing: Math.PI / 4 },
    { x: ACOLYTE_DISTANCE, z: -ACOLYTE_DISTANCE, facing: -Math.PI / 4 },
    { x: ACOLYTE_DISTANCE, z: ACOLYTE_DISTANCE, facing: (-3 * Math.PI) / 4 },
    { x: -ACOLYTE_DISTANCE, z: ACOLYTE_DISTANCE, facing: (3 * Math.PI) / 4 },
  ];

  // The three primary planes for center rigs
  const CENTER_PLANES: { plane: Plane; blue: Plane; red: Plane }[] = [
    { plane: Plane.WALL, blue: Plane.WALL, red: Plane.WALL },
    { plane: Plane.WHEEL, blue: Plane.WHEEL, red: Plane.WHEEL },
    { plane: Plane.FLOOR, blue: Plane.FLOOR, red: Plane.FLOOR },
  ];

  type AvatarInstance = ReturnType<typeof createAvatarInstanceState>;

  // Create avatar instances: 3 for center planes + 4 for acolytes
  let centerInstances = $state<AvatarInstance[]>([]);
  let acolyteInstances = $state<AvatarInstance[]>([]);

  function buildSequenceData(museumSeq: MuseumSequenceData): SequenceData {
    return {
      id: `museum-formation-${stationId}`,
      word: museumSeq.word,
      steps: museumSeq.steps as readonly StepData[],
      isCircular: true,
    } as SequenceData;
  }

  // Initialize all avatar instances
  if (container.items.propStateInterpolator && container.items.sequenceConverter) {
    const deps = {
      propInterpolator: container.items.propStateInterpolator,
      sequenceConverter: container.items.sequenceConverter,
    };

    try {
      // 3 center instances (one per plane)
      centerInstances = CENTER_PLANES.map((cfg, i) =>
        createAvatarInstanceState(
          { id: `formation-${stationId}-center-${cfg.plane}`, positionX: 0, positionZ: 0 },
          deps
        )
      );

      // 4 acolyte instances
      acolyteInstances = ACOLYTE_POSITIONS.map((pos, i) =>
        createAvatarInstanceState(
          { id: `formation-${stationId}-acolyte-${i}`, positionX: 0, positionZ: 0 },
          deps
        )
      );
    } catch (err) {
      console.warn(`[TelekineticFormation] Failed to init ${stationId}:`, err);
    }
  }

  // Load sequence into all instances and set planes
  $effect(() => {
    const id = props.sequenceId;
    untrack(() => {
      if (!id) return;
      if (centerInstances.length === 0 && acolyteInstances.length === 0) return;

      const museumSeq = MUSEUM_EXHIBIT_SEQUENCES[id] ?? null;
      if (!museumSeq) {
        console.warn(`[TelekineticFormation] Sequence ${id} not found in exhibit manifest`);
        return;
      }

      const sequenceData = buildSequenceData(museumSeq);

      // Load into center instances and set each to its plane
      for (let i = 0; i < centerInstances.length; i++) {
        const instance = centerInstances[i];
        const planeCfg = CENTER_PLANES[i];
        if (!instance || !planeCfg) continue;

        instance.loadSequence(sequenceData);
        instance.loop = true;

        // For WALL plane, default mode works. For WHEEL and FLOOR, use
        // setHandPlane to force both hands onto the target plane.
        if (planeCfg.plane === Plane.WALL) {
          instance.setPlaneMode(PlaneMode.WALL);
        } else {
          // setHandPlane switches to CUSTOM mode and reconverts
          instance.setHandPlane("blue", planeCfg.blue);
          instance.setHandPlane("red", planeCfg.red);
        }

        if (autoPlay) instance.play();
      }

      // Load into acolyte instances (WALL plane — their arms will mime the motions)
      for (const instance of acolyteInstances) {
        instance.loadSequence(sequenceData);
        instance.loop = true;
        instance.setPlaneMode(PlaneMode.WALL);
        if (autoPlay) instance.play();
      }
    });
  });

  // Prop type from sequence or global settings
  const bluePropType = $derived.by((): PropType => {
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
</script>

<!-- Formation root — positioned at world coords -->
<T.Group name={`telekinetic-formation-${stationId}`} position.x={worldX} position.z={worldZ}>

  <!-- Ritual platform: large stone disc with engraved ring -->
  <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
    <T.CylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS + 0.1, PLATFORM_HEIGHT, 32]} />
    <T.MeshStandardMaterial color={platformColor} roughness={0.9} />
  </T.Mesh>
  <!-- Decorative ring on the platform surface -->
  <T.Mesh position.y={PLATFORM_HEIGHT + 0.005} rotation.x={-Math.PI / 2}>
    <T.RingGeometry args={[ACOLYTE_DISTANCE - 0.15, ACOLYTE_DISTANCE + 0.15, 32]} />
    <T.MeshStandardMaterial
      color={platformRingColor}
      roughness={0.7}
      transparent
      opacity={0.6}
    />
  </T.Mesh>

  <!-- Ambient point light for the formation -->
  <T.PointLight
    position.y={3}
    intensity={0.8}
    distance={8}
    color="#ffd4a0"
    castShadow={false}
  />

  <!-- CENTER RIGS: 3 planes, props + grid visible, no avatar -->
  {#each centerInstances as instance, i (instance.id)}
    {@const planeCfg = CENTER_PLANES[i]}
    {#if planeCfg}
      <PerformerRig
        position={{ x: 0, z: 0 }}
        facingAngle={0}
        planeMode={planeCfg.plane === Plane.WALL ? PlaneMode.WALL : PlaneMode.CUSTOM}
        avatarState={instance}
        showAvatar={false}
        showGrid={true}
        showProps={true}
        showEffects={false}
        visiblePlanes={new Set([planeCfg.plane])}
        gridMode={"diamond"}
        {bluePropType}
        {redPropType}
        groundOffset={PLATFORM_HEIGHT}
      />
    {/if}
  {/each}

  <!-- ACOLYTE RIGS: avatars with arms reaching, no props visible -->
  {#each acolyteInstances as instance, i (instance.id)}
    {@const acolytePos = ACOLYTE_POSITIONS[i]}
    {#if acolytePos}
      <PerformerRig
        position={{ x: acolytePos.x, z: acolytePos.z }}
        facingAngle={acolytePos.facing}
        planeMode={PlaneMode.WALL}
        avatarState={instance}
        showAvatar={true}
        showGrid={false}
        showProps={false}
        showEffects={false}
        {bluePropType}
        {redPropType}
        groundOffset={PLATFORM_HEIGHT}
      />
    {/if}
  {/each}
</T.Group>
