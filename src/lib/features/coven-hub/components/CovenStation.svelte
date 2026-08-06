<script lang="ts">

// propInterpolator and sequenceConverter are now module-level functions
  /**
   * CovenStation
   *
   * A ritual scene where 6 acolytes stand in a circle around a center point,
   * arms dynamically reaching toward floating staffs that trace the same
   * sequence on all three primary planes simultaneously.
   *
   * Center: 6 PerformerRigs (3 planes × original/mirror) - props visible,
   * no avatar, grid visible. Perimeter: 6 acolytes - avatar visible, no
   * props, no grid. Each acolyte's IK targets track the actual center prop
   * positions every frame, creating a dynamic "telekinetic control" effect
   * where arms subtly shift as the floating staffs move through the sequence.
   *
   * Parameterized from TelekineticFormation3D: takes ANY sequence, ANY effect,
   * an optional GLB stage, and a level-of-detail band.
   */
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { untrack } from "svelte";
  import { T } from "@threlte/core";
  import { Vector3, Quaternion, Color } from "three";
  import { PerformerRig } from "@austencloud/scene-3d";
  import type { PropState3D } from "@austencloud/scene-3d";
  import { Plane } from "@austencloud/scene-3d";
  import { PlaneMode } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { createAvatarInstanceState, makeStandaloneDeps } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { buildTipEffectMap } from "$lib/features/coven-hub/domain/coven-effect-map";
  import type { LodBand } from "$lib/features/coven-hub/domain/coven-lod";
  import { useGltf } from "@threlte/extras";
  import EffectOrchestrator3D from "$lib/shared/3d/effects/EffectOrchestrator3D.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequence: SequenceData | null;
    effectId?: string | null;
    stageModel?: string | null;
    lod?: LodBand;
    autoPlay?: boolean;
    /** Ritual renders the platform and acolytes; sculpture isolates the kinetic core. */
    presentation?: "ritual" | "sculpture";
    /** Uniform scale for installation-sized presentations. */
    scale?: number;
    /**
     * Render the centre staffs. Turning this off leaves the effect trace alone
     * in space — still driven by the real prop motion, with nothing visible
     * making it. That is the "elemental motif" configuration: the modality
     * draws itself. Avatars are already off on the centre rigs.
     */
    showProps?: boolean;
    /**
     * Cap the overlaid centre rigs (default: all six — three planes, each with
     * its mirror). Lower it when many stations share one canvas: six rigs per
     * station is six EffectOrchestrator3D mounts, and a grid of sixteen
     * stations is ninety-six of them.
     */
    centerPlanes?: number;
  }
  const props: Props = $props();
  const stationId = props.stationId;
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const autoPlay = props.autoPlay ?? true;
  const lod = $derived(props.lod ?? "hero");
  const presentation = props.presentation ?? "ritual";
  const formationScale = props.scale ?? 1;
  const showCenterProps = $derived(props.showProps ?? true);

  // Ritual platform
  const PLATFORM_RADIUS = 3.5;
  const PLATFORM_HEIGHT = 0.3;
  const platformColor = new Color(0x2a1f18);
  const platformRingColor = new Color(0x4a3828);

  // Avatar3D in "stage mode" positions feet at groundY (≈ -1.4m below rig origin).
  // In the museum the floor is at y=0, so we offset by -groundY + PLATFORM_HEIGHT.
  // Both center rigs AND acolyte rigs use this so grids/props align with shoulder height.
  const presentationFloorOffset = presentation === "ritual" ? PLATFORM_HEIGHT : 0;
  const museumGroundOffset = $derived(-userProportionsState.groundY + presentationFloorOffset);

  // 6 acolytes evenly spaced around a circle at 60° intervals.
  // Each faces inward toward center.
  const ACOLYTE_DISTANCE = 2.5;
  const NUM_ACOLYTES = 6;
  const ACOLYTE_POSITIONS = Array.from({ length: NUM_ACOLYTES }, (_, i) => {
    // Angle around circle: 0 = +Z, going clockwise when viewed from above
    const angle = (i / NUM_ACOLYTES) * Math.PI * 2;
    const x = Math.sin(angle) * ACOLYTE_DISTANCE;
    const z = Math.cos(angle) * ACOLYTE_DISTANCE;
    // Face toward center: rotate 180° from the outward angle
    const facing = angle + Math.PI;
    return { x, z, facing };
  });

  // 6 center rigs: each primary plane × 2 (original + mirrored).
  // The mirror swaps blue/red props on the same plane, creating a
  // symmetric pattern - where the original has blue going N, the
  // mirror has red going N and blue going where red was.
  interface CenterConfig {
    plane: Plane;
    blue: Plane;
    red: Plane;
    mirror: boolean;
  }
  const CENTER_PLANES: CenterConfig[] = [
    { plane: Plane.WALL, blue: Plane.WALL, red: Plane.WALL, mirror: false },
    { plane: Plane.WALL, blue: Plane.WALL, red: Plane.WALL, mirror: true },
    { plane: Plane.WHEEL, blue: Plane.WHEEL, red: Plane.WHEEL, mirror: false },
    { plane: Plane.WHEEL, blue: Plane.WHEEL, red: Plane.WHEEL, mirror: true },
    { plane: Plane.FLOOR, blue: Plane.FLOOR, red: Plane.FLOOR, mirror: false },
    { plane: Plane.FLOOR, blue: Plane.FLOOR, red: Plane.FLOOR, mirror: true },
  ];

  // Shared identity quaternion for prop state overrides
  const IDENTITY_QUAT = new Quaternion();

  // WALL mode grid offset (how far forward the hand anchor sits from rig center)
  const GRID_OFFSET = 0.3;

  // Tip effect on all prop tips - the telekinetic glow
  const tipEffectMap = $derived(buildTipEffectMap(props.effectId ?? null));

  type AvatarInstance = ReturnType<typeof createAvatarInstanceState>;

  // Create avatar instances: 6 for center planes + 6 for acolytes
  let centerInstances = $state<AvatarInstance[]>([]);
  let acolyteInstances = $state<AvatarInstance[]>([]);
  // True when avatar-instance construction threw — the scene falls back to a
  // visible marker (below) instead of rendering nothing, and we surface a toast.
  let initFailed = $state(false);

  // Initialize all avatar instances
  try {
    centerInstances = CENTER_PLANES.map((cfg, i) =>
      createAvatarInstanceState(
        { id: `formation-${stationId}-center-${cfg.plane}-${cfg.mirror ? 'mirror' : 'orig'}`, positionX: 0, positionZ: 0 },
        makeStandaloneDeps()
      )
    );

    acolyteInstances = presentation === "ritual"
      ? ACOLYTE_POSITIONS.map((_, i) =>
          createAvatarInstanceState(
            { id: `formation-${stationId}-acolyte-${i}`, positionX: 0, positionZ: 0 },
            makeStandaloneDeps()
          )
        )
      : [];
  } catch (err) {
    console.warn(`[CovenStation] Failed to init ${stationId}:`, err);
    initFailed = true;
    toast.error("Couldn't load the coven performers for this station.");
  }

  // hero: all 6 center + 6 acolytes. idle/frozen: only the first center rig.
  const visibleCenter = $derived(
    (presentation === "sculpture" || lod === "hero"
      ? centerInstances
      : centerInstances.slice(0, 1)
    ).slice(0, props.centerPlanes ?? CENTER_PLANES.length)
  );
  const showAcolytes = $derived(presentation === "ritual" && lod === "hero");
  const stationPlaying = $derived(lod !== "frozen");
  const stageGltf = $derived(props.stageModel ? useGltf(props.stageModel) : null);

  // Load sequence into center instances and set planes
  $effect(() => {
    const seq = props.sequence;
    untrack(() => {
      if (!seq || centerInstances.length === 0) return;
      for (let i = 0; i < centerInstances.length; i++) {
        const instance = centerInstances[i];
        const planeCfg = CENTER_PLANES[i];
        if (!instance || !planeCfg) continue;
        instance.loadSequence(seq);
        instance.loop = true;
        if (planeCfg.plane === Plane.WALL) {
          instance.setPlaneMode(PlaneMode.WALL);
        } else {
          instance.setHandPlane("blue", planeCfg.blue);
          instance.setHandPlane("red", planeCfg.red);
        }
        if (autoPlay) instance.play();
      }
    });
  });

  // Dynamic arm tracking: each acolyte's IK targets follow the center props.
  // We use the WALL center instance as the tracking reference - its prop states
  // update every frame. We transform those positions from formation space into
  // each acolyte's rig-local hand-anchor space so their arms reach toward the
  // actual floating staffs.
  //
  // The math: PerformerRig applies position, then rotation, then hand anchor offset.
  // So prop world pos = rigPos + rotY(facing, handAnchor + propOverride.worldPosition).
  // We invert this chain to find the override that makes acolyte arms point at center props.
  const acolytePropOverrides = $derived.by(() => {
    const wallInstance = centerInstances[0];
    const wallBlue = wallInstance?.bluePropState;
    const wallRed = wallInstance?.redPropState;

    if (!wallBlue || !wallRed) {
      // No sequence playing yet - arms reach forward at rest
      return ACOLYTE_POSITIONS.map(() => ({
        blue: {
          centerPathAngle: 0, staffRotationAngle: 0, plane: Plane.WALL,
          worldPosition: new Vector3(0.15, -0.1, 0.5),
          worldRotation: IDENTITY_QUAT,
        } as PropState3D,
        red: {
          centerPathAngle: 0, staffRotationAngle: 0, plane: Plane.WALL,
          worldPosition: new Vector3(-0.15, -0.1, 0.5),
          worldRotation: IDENTITY_QUAT,
        } as PropState3D,
      }));
    }

    // Center prop positions in formation space.
    // Center rig is at origin with facingAngle=0, WALL mode gridOffset=0.3.
    // So prop formation-space position = (prop.worldPos.x, prop.worldPos.y, 0.3 + prop.worldPos.z)
    const blueFormX = wallBlue.worldPosition.x;
    const blueFormZ = GRID_OFFSET + wallBlue.worldPosition.z;
    const redFormX = wallRed.worldPosition.x;
    const redFormZ = GRID_OFFSET + wallRed.worldPosition.z;

    return ACOLYTE_POSITIONS.map((acolyte) => {
      const cosF = Math.cos(acolyte.facing);
      const sinF = Math.sin(acolyte.facing);

      // Target vector: center prop relative to acolyte rig origin (formation space)
      const blueTx = blueFormX - acolyte.x;
      const blueTz = blueFormZ - acolyte.z;
      const redTx = redFormX - acolyte.x;
      const redTz = redFormZ - acolyte.z;

      // Inverse rotation by facingAngle to get rig-local coordinates,
      // then subtract hand anchor offset (0, 0, GRID_OFFSET)
      const blueLocalX = cosF * blueTx - sinF * blueTz;
      const blueLocalZ = sinF * blueTx + cosF * blueTz - GRID_OFFSET;
      const redLocalX = cosF * redTx - sinF * redTz;
      const redLocalZ = sinF * redTx + cosF * redTz - GRID_OFFSET;

      return {
        blue: {
          centerPathAngle: 0, staffRotationAngle: 0, plane: Plane.WALL,
          worldPosition: new Vector3(blueLocalX, wallBlue.worldPosition.y, blueLocalZ),
          worldRotation: IDENTITY_QUAT,
        } as PropState3D,
        red: {
          centerPathAngle: 0, staffRotationAngle: 0, plane: Plane.WALL,
          worldPosition: new Vector3(redLocalX, wallRed.worldPosition.y, redLocalZ),
          worldRotation: IDENTITY_QUAT,
        } as PropState3D,
      };
    });
  });

  // Prop type from sequence or global settings
  const bluePropType = $derived.by((): PropType => {
    try {
      return settingsService.settings.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    try {
      return settingsService.settings.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
</script>

<!-- Formation root - positioned at world coords -->
<T.Group
  name={`performer-station-${stationId}`}
  position.x={worldX}
  position.z={worldZ}
  scale={formationScale}
>

  <!-- Ritual platform: bespoke GLB stage when stageModel is set, otherwise the
       original stone disc (keeps the museum exhibit identical until GLBs land). -->
  {#if presentation === "ritual"}
    {#if stageGltf}
      {#await stageGltf}
        <!-- GLB stage still streaming in: show a dim placeholder disc so the slot
             isn't visually empty while the model resolves. -->
        <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
          <T.CylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS + 0.1, PLATFORM_HEIGHT, 32]} />
          <T.MeshStandardMaterial color={platformColor} roughness={0.95} transparent opacity={0.35} />
        </T.Mesh>
      {:then gltf}
        <T is={gltf.scene} position.y={PLATFORM_HEIGHT} />
      {/await}
    {:else}
      <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
        <T.CylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS + 0.1, PLATFORM_HEIGHT, 32]} />
        <T.MeshStandardMaterial color={platformColor} roughness={0.9} />
      </T.Mesh>
    {/if}
  {/if}

  {#if initFailed}
    <!-- Degraded fallback: avatar instances failed to construct, so the rigs
         below render nothing. Show a clearly-broken marker pillar at center so
         the empty station is observable rather than silently blank. -->
    <T.Mesh position.y={presentationFloorOffset + 0.75}>
      <T.BoxGeometry args={[0.25, 1.5, 0.25]} />
      <T.MeshStandardMaterial color="#a01818" emissive="#5a0000" roughness={0.6} />
    </T.Mesh>
  {/if}
  <!-- Decorative ring at acolyte circle -->
  {#if presentation === "ritual"}
    <T.Mesh position.y={PLATFORM_HEIGHT + 0.005} rotation.x={-Math.PI / 2}>
      <T.RingGeometry args={[ACOLYTE_DISTANCE - 0.15, ACOLYTE_DISTANCE + 0.15, 48]} />
      <T.MeshStandardMaterial
        color={platformRingColor}
        roughness={0.7}
        transparent
        opacity={0.6}
      />
    </T.Mesh>
  {/if}

  <!-- Ambient point light for the formation -->
  <T.PointLight
    position.y={3}
    intensity={presentation === "sculpture" ? 1.2 : 0.8}
    distance={presentation === "sculpture" ? 6 : 8}
    color={presentation === "sculpture" ? "#dce8ff" : "#ffd4a0"}
    castShadow={false}
  />

  <!-- CENTER RIGS: 6 total (3 planes × original + mirror), props + grid visible, no avatar -->
  <!-- Mirrored rigs swap blue/red prop states for a symmetric pattern on each plane.
       Only the original (non-mirror) rigs show the grid to avoid visual clutter. -->
  {#each visibleCenter as instance, i (instance.id)}
    {@const planeCfg = CENTER_PLANES[i]}
    {#if planeCfg}
      <PerformerRig
        position={{ x: 0, z: planeCfg.mirror ? 2 * GRID_OFFSET : 0 }}
        facingAngle={planeCfg.mirror ? Math.PI : 0}
        planeMode={planeCfg.plane === Plane.WALL ? PlaneMode.WALL : PlaneMode.CUSTOM}
        avatarState={instance}
        showAvatar={false}
        showGrid={!planeCfg.mirror}
        showProps={showCenterProps}
        showEffects={true}
        isPlaying={instance.isPlaying && stationPlaying}
        tipEffectMap={tipEffectMap}
        visiblePlanes={new Set([planeCfg.plane])}
        gridMode={"diamond"}
        bluePropType={toScenePropType(bluePropType)}
        redPropType={toScenePropType(redPropType)}
        groundOffset={museumGroundOffset}
      >
        {#snippet effectsSlot({ bluePropState, redPropState, blueHandPos, redHandPos, isPlaying: rigPlaying, staffHalfLength, effectsParentRef })}
          <EffectOrchestrator3D
            {bluePropState}
            {redPropState}
            isPlaying={rigPlaying}
            {staffHalfLength}
            tipEffectMap={tipEffectMap}
            {blueHandPos}
            {redHandPos}
            {effectsParentRef}
          />
        {/snippet}
      </PerformerRig>
    {/if}
  {/each}

  <!-- ACOLYTE RIGS: 6 avatars with arms dynamically tracking center props -->
  {#if showAcolytes}
    {#each acolyteInstances as instance, i (instance.id)}
      {@const acolytePos = ACOLYTE_POSITIONS[i]}
      {@const propOverride = acolytePropOverrides[i]}
      {#if acolytePos && propOverride}
        <PerformerRig
          position={{ x: acolytePos.x, z: acolytePos.z }}
          facingAngle={acolytePos.facing}
          planeMode={PlaneMode.WALL}
          avatarState={instance}
          showAvatar={true}
          showGrid={false}
          showProps={false}
          showEffects={false}
          bluePropState={propOverride.blue}
          redPropState={propOverride.red}
          bluePropType={toScenePropType(bluePropType)}
          redPropType={toScenePropType(redPropType)}
          groundOffset={museumGroundOffset}
        />
      {/if}
    {/each}
  {/if}
</T.Group>
