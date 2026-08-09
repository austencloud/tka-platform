<script lang="ts">
  /**
   * Coal lamp - look-dev study.
   *
   * A soot-blackened iron hood on a dungeon chain, holding a bed of live coals
   * that spill as it swings. It is proposed as the connecting thread across all
   * three First Fire courts: the same fixture, the same chain, different thing
   * burning inside it, marking the route the visitor walks.
   *
   * This is a study, not the shipping asset. Its job is to answer whether the
   * silhouette reads at walking distance and whether coals in a hanging basket
   * light the space usefully. Once the proportions are chosen, the fixture is
   * authored in Blender and exported to GLB per blender-first-3d-scenes.md -
   * procedural primitives are not how static set dressing ships here.
   */
  import { T, useTask } from "@threlte/core";
  import {
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    Vector3,
  } from "three";
  import LavaCracks from "$lib/shared/3d/environments/scenes/ember/LavaCracks.svelte";
  import type { LavaCracksConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
  import FirstFireCoalBank from "./FirstFireCoalBank.svelte";

  interface Props {
    /** Ceiling height the chain hangs from. */
    ceilingY?: number;
    /** Height of the basket floor, i.e. where the coals sit. */
    basketY?: number;
    /** Width of the hood across its base. */
    hoodWidth?: number;
    /** How deep the coal basket is. Deeper hides the coals from below. */
    basketDepth?: number;
    /** The colour of whatever is burning in the basket. */
    emberColor?: string;
    /** Light thrown into the room by the basket. */
    lightIntensity?: number;
    /** Live coals falling out of the basket. 0 disables the drip. */
    dripCount?: number;
    /** Slow pendulum swing, in radians. 0 holds it still for silhouette reads. */
    swing?: number;
  }

  const {
    ceilingY = 4.6,
    basketY = 2.4,
    hoodWidth = 0.92,
    basketDepth = 0.3,
    emberColor = "#ff5a12",
    lightIntensity = 9,
    dripCount = 14,
    swing = 0.035,
  }: Props = $props();

  // Soot-blackened forged iron - and deliberately NOT metallic in the PBR
  // sense. A metalness near 1 with no environment map has no diffuse term and
  // nothing to reflect, so in a room lit only by coals it renders pure black
  // and the fixture disappears. Real forged iron under soot is close to a
  // rough dielectric anyway, and at this metalness the coal light actually
  // wraps the hood and picks the chain out of the dark.
  const iron = new MeshStandardMaterial({
    color: "#15110e",
    roughness: 0.72,
    metalness: 0.2,
  });

  const hoodHeight = $derived(hoodWidth * 0.95);
  const basketWidth = $derived(hoodWidth * 0.78);
  // Top of the hood, where the chain terminates.
  const hoodApexY = $derived(basketY + basketDepth + hoodHeight);
  const chainSpan = $derived(ceilingY - hoodApexY);

  const LINK_PITCH = 0.105;
  const links = $derived(
    Array.from({ length: Math.max(1, Math.round(chainSpan / LINK_PITCH)) }, (_, i) => ({
      y: hoodApexY + LINK_PITCH * (i + 0.5),
      // Alternating quarter-turn is what makes a stack of tori read as chain
      // rather than as a column of washers.
      yaw: (i % 2) * (Math.PI / 2),
    }))
  );

  const basketCoals: LavaCracksConfig = $derived({
    enabled: true,
    crackColor: emberColor,
    intensity: 2.1,
    speed: 0.02,
    // Chunky on purpose. At scale 9 the voronoi stippled a 0.4m plane into
    // noise that read as nothing at walking distance.
    scale: 2.2,
    pulseSpeed: 0.5,
    pulseIntensity: 0.5,
  });

  // Coals that have fallen out and are still falling. Instanced so the drip
  // costs one draw call regardless of how many are in the air.
  let dripMesh = $state<InstancedMesh | null>(null);
  const dripMaterial = new MeshStandardMaterial({
    color: "#120806",
    emissive: emberColor,
    emissiveIntensity: 2.4,
    roughness: 1,
  });

  interface Drip {
    x: number;
    y: number;
    z: number;
    velocity: number;
    scale: number;
  }

  function spawnDrip(seed: number): Drip {
    const angle = seed * 2.399963; // golden angle, so spawns never line up
    const radius = (0.12 + ((seed * 0.37) % 1) * 0.28) * basketWidth;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: basketY - 0.05 - ((seed * 0.61) % 1) * (basketY - 0.2),
      velocity: 0,
      scale: 0.012 + ((seed * 0.83) % 1) * 0.016,
    };
  }

  const drips: Drip[] = Array.from({ length: dripCount }, (_, i) => spawnDrip(i + 1));

  const matrix = new Matrix4();
  const dripPosition = new Vector3();
  const dripScale = new Vector3();
  const noRotation = new Quaternion();
  let elapsed = $state(0);

  useTask((delta) => {
    elapsed += delta;
    const mesh = dripMesh;
    if (!mesh) return;
    for (const [index, drip] of drips.entries()) {
      drip.velocity += delta * 2.2;
      drip.y -= drip.velocity * delta;
      if (drip.y <= 0.02) {
        const respawned = spawnDrip(index + 1 + elapsed);
        drip.x = respawned.x;
        drip.z = respawned.z;
        drip.scale = respawned.scale;
        drip.y = basketY - 0.05;
        drip.velocity = 0;
      }
      dripPosition.set(drip.x, drip.y, drip.z);
      dripScale.setScalar(drip.scale);
      matrix.compose(dripPosition, noRotation, dripScale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Pendulum about the ceiling anchor, so the whole fixture swings as one body.
  const swingAngle = $derived(swing === 0 ? 0 : Math.sin(elapsed * 0.42) * swing);
</script>

<T.Group position.y={ceilingY} rotation.z={swingAngle}>
  <T.Group position.y={-ceilingY}>
    <!-- Ceiling plate -->
    <T.Mesh position.y={ceilingY - 0.02} material={iron}>
      <T.CylinderGeometry args={[0.11, 0.13, 0.05, 8]} />
    </T.Mesh>

    <!-- Chain -->
    {#each links as link, i (i)}
      <T.Mesh
        position.y={link.y}
        rotation.x={Math.PI / 2}
        rotation.y={link.yaw}
        material={iron}
      >
        <T.TorusGeometry args={[0.066, 0.023, 6, 12]} />
      </T.Mesh>
    {/each}

    <!-- Hood: four-sided pyramid, apex up. The bottom edge is what throws the
         hard shadow line that makes this read as a lamp and not a lantern. -->
    <T.Mesh
      position.y={basketY + basketDepth + hoodHeight / 2}
      rotation.y={Math.PI / 4}
      material={iron}
    >
      <T.ConeGeometry args={[hoodWidth * 0.72, hoodHeight, 4]} />
    </T.Mesh>

    <!-- Bottom section: the open basket the coals sit in. -->
    <T.Mesh
      position.y={basketY + basketDepth / 2}
      rotation.y={Math.PI / 4}
      material={iron}
    >
      <T.CylinderGeometry
        args={[basketWidth * 0.72, basketWidth * 0.58, basketDepth, 4, 1, true]}
      />
    </T.Mesh>

    <!-- Basket floor, so the coals do not read as floating. -->
    <T.Mesh position.y={basketY} rotation.y={Math.PI / 4} material={iron}>
      <T.CylinderGeometry args={[basketWidth * 0.58, basketWidth * 0.58, 0.02, 4]} />
    </T.Mesh>

    <!-- The coals themselves: the same lumps the beds and the wall are packed
         with, so the lamp carries the room's material rather than a second
         one. The crust shader glows underneath them, between the lumps. -->
    <LavaCracks
      config={basketCoals}
      groundSize={1}
      edgeFade={0}
      placement={{
        position: [0, basketY + 0.015, 0],
        rotation: [-Math.PI / 2, 0, 0],
        size: [basketWidth * 0.82, basketWidth * 0.82],
      }}
    />
    <!-- The bank packs from z=0 backwards, so half its depth centres it. -->
    <T.Group position.y={basketY + 0.02} position.z={basketWidth * 0.37}>
      <FirstFireCoalBank
        width={basketWidth * 0.74}
        height={0.14}
        depth={basketWidth * 0.74}
        count={38}
        sizeRange={[0.035, 0.075]}
        {emberColor}
        heat="raked"
        seed={4}
      />
    </T.Group>

    <T.PointLight
      position={[0, basketY - 0.05, 0]}
      color={emberColor}
      intensity={lightIntensity}
      distance={9}
      decay={2}
    />

    {#if dripCount > 0}
      <T.InstancedMesh
        args={[undefined, undefined, dripCount]}
        material={dripMaterial}
        frustumCulled={false}
        oncreate={(ref: InstancedMesh) => {
          dripMesh = ref;
        }}
      >
        <T.SphereGeometry args={[1, 6, 5]} />
      </T.InstancedMesh>
    {/if}
  </T.Group>
</T.Group>
