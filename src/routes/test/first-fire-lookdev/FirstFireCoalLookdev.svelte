<script lang="ts">
  /**
   * First Fire coal-room look-dev.
   *
   * Four stations in one dark basalt box, so the coal vocabulary can be judged
   * side by side before any of it is committed to the museum walk. The question
   * each station answers is written above it in the page chrome.
   *
   * This is deliberately NOT the Cinder Court. Building the art direction
   * inside the real room means every judgement is contaminated by route,
   * performer, collision and procession state. Here there is nothing but the
   * material and the light it throws.
   */
  import { T, useTask } from "@threlte/core";
  import { MeshStandardMaterial } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import LavaCracks from "$lib/shared/3d/environments/scenes/ember/LavaCracks.svelte";
  import HeatDistortion from "$lib/shared/3d/environments/scenes/ember/HeatDistortion.svelte";
  import EmberFountains from "$lib/shared/3d/environments/scenes/ember/EmberFountains.svelte";
  import FallingParticles from "$lib/shared/3d/environments/primitives/FallingParticles.svelte";
  import type { LavaCracksConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
  import { FIRST_FIRE_BASALT_COLOR } from "../first-fire-graybox/first-fire-court-identity";
  import FirstFireCoalLamp from "./FirstFireCoalLamp.svelte";
  import FirstFireCoalBank from "./FirstFireCoalBank.svelte";
  import { LOOKDEV_STATIONS, type LookdevStationId } from "./lookdev-stations";

  interface Props {
    station: LookdevStationId | "lineup";
    /** Human reference at 1.75m, so every station is judged at body scale. */
    showScaleFigure: boolean;
    /** The A/B this room was built to settle: is coal a shader or geometry? */
    wallTreatment: "shader" | "lumps";
    /**
     * Bounce off glowing coals. The Cinder Court currently runs this at
     * essentially zero on the rule that every photon comes from something
     * burning - but a room packed with live coals HAS enormous bounce, and
     * zeroing it is why the courts read as black voids with orange blobs in
     * them rather than as hot rooms.
     */
    bounce: number;
  }

  const { station, showScaleFigure, wallTreatment, bounce }: Props = $props();

  const ROOM_WIDTH = 30;
  const ROOM_DEPTH = 15;
  const CEILING_Y = 5.2;
  const BACK_Z = -5;

  // Ember components anchor to the avatar ground datum; the room floor is y=0.
  const floorLift = $derived(-userProportionsState.groundY);

  const basalt = new MeshStandardMaterial({
    color: FIRST_FIRE_BASALT_COLOR,
    roughness: 0.95,
    metalness: 0,
  });
  // See FirstFireCoalLamp for why this is not a PBR metal: with no environment
  // map, high metalness has no diffuse and nothing to reflect, so every iron
  // fitting in the room renders pure black and vanishes.
  const iron = new MeshStandardMaterial({
    color: "#15110e",
    roughness: 0.72,
    metalness: 0.2,
  });
  const scaleFigureMaterial = new MeshStandardMaterial({
    color: "#241a16",
    roughness: 1,
    metalness: 0,
  });

  const activeCamera = $derived.by(() => {
    if (station === "lineup") {
      return {
        position: [0, 2.9, 17.5] as [number, number, number],
        target: [0, 1.9, -1] as [number, number, number],
        fov: 52,
      };
    }
    const found = LOOKDEV_STATIONS.find((s) => s.id === station)!;
    return {
      position: [found.x, found.eye.height, found.eye.distance] as [
        number,
        number,
        number,
      ],
      target: [found.x, found.eye.look, found.eye.lookZ] as [
        number,
        number,
        number,
      ],
      fov: 58,
    };
  });

  const x = (id: LookdevStationId) => LOOKDEV_STATIONS.find((s) => s.id === id)!.x;

  // Station A - a bed of coals sunk into the floor behind an iron kerb.
  const bedCoals: LavaCracksConfig = {
    enabled: true,
    crackColor: "#ff5a12",
    intensity: 1.35,
    speed: 0.012,
    scale: 5.5,
    pulseSpeed: 0.35,
    pulseIntensity: 0.55,
  };
  const BED_SIZE = 2.6;
  const bedKerb = [
    { x: 0, z: BED_SIZE / 2, w: BED_SIZE + 0.3, d: 0.15 },
    { x: 0, z: -BED_SIZE / 2, w: BED_SIZE + 0.3, d: 0.15 },
    { x: BED_SIZE / 2, z: 0, w: 0.15, d: BED_SIZE + 0.3 },
    { x: -BED_SIZE / 2, z: 0, w: 0.15, d: BED_SIZE + 0.3 },
  ];
  const bedEmbers = {
    enabled: true,
    count: 26,
    riseSpeed: 0.35,
    colors: ["#ff4400", "#ff6600", "#ffaa00", "#ff2200"],
    sizeRange: [0.02, 0.055] as [number, number],
    spawnRadius: BED_SIZE * 0.42,
    maxHeight: 2.6,
    gravity: 0.42,
    burstInterval: 4.2,
    burstCount: 7,
  };

  // Station B - banked coal held against the wall behind an iron grate.
  const wallCoals: LavaCracksConfig = {
    enabled: true,
    crackColor: "#ff4a10",
    intensity: 1.05,
    speed: 0.008,
    scale: 4.5,
    pulseSpeed: 0.25,
    pulseIntensity: 0.4,
  };
  const WALL_W = 5.2;
  const WALL_H = 3.1;
  const grateBars = Array.from({ length: 9 }, (_, i) => ({
    x: -WALL_W / 2 + 0.3 + i * ((WALL_W - 0.6) / 8),
  }));

  // Station D - a furnace mouth venting heat and steam into the room.
  const furnaceCoals: LavaCracksConfig = {
    enabled: true,
    crackColor: "#ff8a2a",
    intensity: 2.2,
    speed: 0.03,
    scale: 6,
    pulseSpeed: 0.8,
    pulseIntensity: 0.7,
  };
  const FURNACE_W = 2.1;
  const FURNACE_H = 1.7;
  const FURNACE_SILL = 0.75;

  // Breathing furnace glow. A furnace that holds one brightness reads as a
  // light fixture; one that swells and settles reads as combustion.
  let breath = $state(1);
  useTask((delta) => {
    breath += delta;
  });
  const furnaceIntensity = $derived(11 + Math.sin(breath * 0.9) * 3.5);
</script>

<T.PerspectiveCamera
  makeDefault
  position={[activeCamera.position[0], activeCamera.position[1], activeCamera.position[2]]}
  fov={activeCamera.fov}
>
  <OrbitControls
    enableDamping
    target={[activeCamera.target[0], activeCamera.target[1], activeCamera.target[2]]}
    minDistance={1.2}
    maxDistance={40}
    maxPolarAngle={Math.PI / 2 + 0.05}
  />
</T.PerspectiveCamera>

<!-- Bounce off the coals. Every direct source in this room is still something
     burning; this is only the light those sources throw back off the rock. -->
<T.HemisphereLight args={["#c4400f", "#1a0b06", bounce]} />

<!-- Room shell -->
<T.Mesh rotation.x={-Math.PI / 2} material={basalt} receiveShadow>
  <T.PlaneGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
</T.Mesh>
<T.Mesh position={[0, CEILING_Y / 2, BACK_Z]} material={basalt}>
  <T.PlaneGeometry args={[ROOM_WIDTH, CEILING_Y]} />
</T.Mesh>
<T.Mesh position={[0, CEILING_Y, 0]} rotation.x={Math.PI / 2} material={basalt}>
  <T.PlaneGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
</T.Mesh>
<T.Mesh
  position={[-ROOM_WIDTH / 2, CEILING_Y / 2, 0]}
  rotation.y={Math.PI / 2}
  material={basalt}
>
  <T.PlaneGeometry args={[ROOM_DEPTH, CEILING_Y]} />
</T.Mesh>
<T.Mesh
  position={[ROOM_WIDTH / 2, CEILING_Y / 2, 0]}
  rotation.y={-Math.PI / 2}
  material={basalt}
>
  <T.PlaneGeometry args={[ROOM_DEPTH, CEILING_Y]} />
</T.Mesh>

<!-- ============ A · coal bed ============ -->
<T.Group position.x={x("bed")}>
  {#each bedKerb as kerb, i (i)}
    <T.Mesh position={[kerb.x, 0.075, kerb.z]} material={iron}>
      <T.BoxGeometry args={[kerb.w, 0.15, kerb.d]} />
    </T.Mesh>
  {/each}

  <LavaCracks
    config={bedCoals}
    groundSize={1}
    edgeFade={0}
    placement={{
      position: [0, 0.04, 0],
      rotation: [-Math.PI / 2, 0, 0],
      size: [BED_SIZE, BED_SIZE],
    }}
  />

  <!-- Lumps raked over the crust, so the glow reads as coming from BETWEEN
       coals rather than from a lit rectangle in a box. -->
  <T.Group position={[0, 0.02, BED_SIZE * 0.46]}>
    <FirstFireCoalBank
      width={BED_SIZE * 0.92}
      height={0.16}
      depth={BED_SIZE * 0.92}
      count={210}
      sizeRange={[0.05, 0.13]}
      emberColor="#ff5a12"
      heat="raked"
      seed={3}
    />
  </T.Group>

  <T.PointLight
    position={[0, 0.5, 0]}
    color="#ff5312"
    intensity={9}
    distance={11}
    decay={2}
  />

  <T.Group position.y={floorLift}>
    <EmberFountains config={bedEmbers} />
    <HeatDistortion position={{ x: 0, z: 0 }} radius={BED_SIZE * 0.6} height={3.2} intensity={0.12} />
  </T.Group>
</T.Group>

<!-- ============ B · banked coal wall ============ -->
<T.Group position={[x("wall"), 0, BACK_Z + 0.06]}>
  <!-- The heat, always. On its own (shader treatment) this is the whole wall,
       and it reads as a red crackle pattern on a flat panel. -->
  <LavaCracks
    config={wallCoals}
    groundSize={1}
    edgeFade={0}
    placement={{
      position: [0, WALL_H / 2 + 0.2, 0.04],
      rotation: [0, 0, 0],
      size: [WALL_W, WALL_H],
    }}
  />

  {#if wallTreatment === "lumps"}
    <!-- The same heat, now with a bank of cold lumps standing in front of it.
         The lumps carry no real glow of their own; they chop the shader behind
         them into hot slivers, which is what a coal bank actually looks like. -->
    <T.Group position={[0, 0.28, 0.62]}>
      <FirstFireCoalBank
        width={WALL_W - 0.2}
        height={WALL_H - 0.1}
        depth={0.55}
        count={520}
        sizeRange={[0.07, 0.22]}
        emberColor="#ff5a12"
        heat="banked"
        seed={11}
      />
    </T.Group>
  {/if}

  <!-- Iron grate holding the bank back. It has to sit IN FRONT of the coal to
       do that: behind it, the lumps bury it and the wall loses the one cue
       that says a person stacked this fuel here. -->
  {#each grateBars as bar, i (i)}
    <T.Mesh position={[bar.x, WALL_H / 2 + 0.2, 1.02]} material={iron}>
      <T.BoxGeometry args={[0.09, WALL_H, 0.09]} />
    </T.Mesh>
  {/each}
  <T.Mesh position={[0, 0.24, 1.02]} material={iron}>
    <T.BoxGeometry args={[WALL_W + 0.3, 0.36, 0.5]} />
  </T.Mesh>
  <T.Mesh position={[0, WALL_H + 0.2, 1.02]} material={iron}>
    <T.BoxGeometry args={[WALL_W + 0.3, 0.2, 0.3]} />
  </T.Mesh>

  <T.PointLight
    position={[0, WALL_H / 2 + 0.2, 1.1]}
    color="#ff4a10"
    intensity={7.5}
    distance={12}
    decay={2}
  />
</T.Group>

<!-- ============ C · chain lamp ============ -->
<T.Group position.x={x("lamp")}>
  <FirstFireCoalLamp ceilingY={CEILING_Y} basketY={2.55} />
</T.Group>

<!-- ============ D · furnace vent ============ -->
<T.Group position={[x("furnace"), 0, BACK_Z + 0.06]}>
  <!-- Recess interior, set back so the mouth has depth to it. -->
  <T.Mesh position={[0, FURNACE_SILL + FURNACE_H / 2, -0.5]} material={basalt}>
    <T.BoxGeometry args={[FURNACE_W, FURNACE_H, 1]} />
  </T.Mesh>
  <LavaCracks
    config={furnaceCoals}
    groundSize={1}
    edgeFade={0}
    placement={{
      position: [0, FURNACE_SILL + FURNACE_H / 2, -0.02],
      rotation: [0, 0, 0],
      size: [FURNACE_W - 0.1, FURNACE_H - 0.1],
    }}
  />

  <!-- Iron surround -->
  <T.Mesh position={[0, FURNACE_SILL - 0.12, 0.14]} material={iron}>
    <T.BoxGeometry args={[FURNACE_W + 0.5, 0.24, 0.3]} />
  </T.Mesh>
  <T.Mesh position={[0, FURNACE_SILL + FURNACE_H + 0.12, 0.14]} material={iron}>
    <T.BoxGeometry args={[FURNACE_W + 0.5, 0.24, 0.3]} />
  </T.Mesh>
  <T.Mesh position={[-(FURNACE_W / 2 + 0.13), FURNACE_SILL + FURNACE_H / 2, 0.14]} material={iron}>
    <T.BoxGeometry args={[0.26, FURNACE_H + 0.5, 0.3]} />
  </T.Mesh>
  <T.Mesh position={[FURNACE_W / 2 + 0.13, FURNACE_SILL + FURNACE_H / 2, 0.14]} material={iron}>
    <T.BoxGeometry args={[0.26, FURNACE_H + 0.5, 0.3]} />
  </T.Mesh>

  <T.PointLight
    position={[0, FURNACE_SILL + FURNACE_H / 2, 1.4]}
    color="#ff8a2a"
    intensity={furnaceIntensity}
    distance={16}
    decay={2}
  />

  <T.Group position={[0, FURNACE_SILL + FURNACE_H, 0.9]}>
    <FallingParticles
      type="smoke"
      count={34}
      area={{ width: 2.4, height: 3.4, depth: 1.6 }}
      speed={0.05}
      colors={["#3d322c", "#2a221e", "#4a3c34", "#1c1613"]}
      sizeRange={[0.3, 0.9]}
      opacity={0.16}
      spin={false}
    />
  </T.Group>
  <T.Group position={[0, FURNACE_SILL + FURNACE_H / 2, 0.7]}>
    <HeatDistortion position={{ x: 0, z: 0 }} radius={1.1} height={3} intensity={0.16} />
  </T.Group>
</T.Group>

<!-- Ash drifting through the whole room, one atmosphere for all four. -->
<T.Group position={[0, 2.4, 0]}>
  <FallingParticles
    type="dust"
    count={120}
    area={{ width: ROOM_WIDTH, height: 5, depth: ROOM_DEPTH }}
    speed={0.035}
    colors={["#3a2a24", "#2a1a16", "#4a3028", "#1a1010"]}
    sizeRange={[0.015, 0.05]}
    opacity={0.5}
    spin={false}
  />
</T.Group>

{#if showScaleFigure}
  <!-- Pushed to the far side of each station and set back, so the reference
       never parks itself between the camera and the thing being judged. -->
  {#each LOOKDEV_STATIONS as s (s.id)}
    <T.Mesh position={[s.x - 2.5, 0.875, -1.6]} material={scaleFigureMaterial}>
      <T.CapsuleGeometry args={[0.22, 1.31, 4, 10]} />
    </T.Mesh>
  {/each}
{/if}
