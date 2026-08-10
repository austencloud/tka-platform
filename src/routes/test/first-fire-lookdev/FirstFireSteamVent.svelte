<script lang="ts">
  /**
   * Quench vent - look-dev study.
   *
   * A slot in the floor where water meets hot slag, grated over in iron, with
   * a steam column standing off it. Two jobs in the coal room:
   *
   * 1. It is the "heat in general" beat that is not another orange rectangle.
   *    A room lit entirely by coals is one hue from wall to wall, and a single
   *    hue has no range - the eye stops reading depth. Steam is the pale value
   *    that gives the orange something to be orange against.
   * 2. It makes the heat feel like a quantity the room is LOSING, which is what
   *    separates a worked forge from a geological hot cave.
   *
   * Reuses EmberFountains as the emitter rather than writing a second particle
   * system: it already rises, spawns on an interval and dies on a height, which
   * is exactly a steam column with the colours and gravity changed.
   */
  import { T } from "@threlte/core";
  import { MeshStandardMaterial } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import EmberFountains from "$lib/shared/3d/environments/scenes/ember/EmberFountains.svelte";
  import HeatDistortion from "$lib/shared/3d/environments/scenes/ember/HeatDistortion.svelte";
  import LavaCracks from "$lib/shared/3d/environments/scenes/ember/LavaCracks.svelte";
  import type { LavaCracksConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
  import FirstFireCoalBank from "./FirstFireCoalBank.svelte";

  interface Props {
    /** Slot opening in the floor, in metres. */
    width?: number;
    depth?: number;
    /** How far the slot is sunk. Deeper hides the slag until you stand over it. */
    sink?: number;
    /** Colour of the slag at the bottom of the slot. */
    emberColor?: string;
    /** How hard the column blows. 0 stops it for a silhouette read. */
    steamRate?: number;
    /** Ceiling height, so the column dies at the ceiling instead of through it. */
    ceilingY?: number;
    material: MeshStandardMaterial;
  }

  const {
    width = 2.4,
    depth = 1.1,
    sink = 0.45,
    emberColor = "#ff6a1c",
    steamRate = 1,
    ceilingY = 5.2,
    material,
  }: Props = $props();

  // Ember components are authored against the avatar ground datum, not the
  // museum floor. Lifting them here keeps that detail out of every consumer.
  const floorLift = $derived(-userProportionsState.groundY);

  const slagCrust: LavaCracksConfig = $derived({
    enabled: true,
    crackColor: emberColor,
    intensity: 1.6,
    speed: 0.01,
    scale: 3.4,
    pulseSpeed: 0.3,
    pulseIntensity: 0.6,
  });

  /**
   * Steam, not smoke. Smoke is dark and subtractive; steam is pale and scatters
   * the coal light back out, which is why these colours are warm greys rather
   * than white - white on additive blending blows straight to a peach smear
   * under AgX.
   */
  const steamColumn = $derived({
    enabled: true,
    // Dense and large. These are additive sprites with a soft round falloff:
    // sparse and small, they stay separate blobs and read as a shower of
    // sparks, which is the opposite of the beat this station is for. They have
    // to overlap enough to merge into one mass before the eye calls it vapour,
    // and the colours drop correspondingly dark so the stacking does not
    // blow out.
    count: Math.round(190 * steamRate),
    riseSpeed: 0.62,
    colors: ["#2e2724", "#372e29", "#241e1b", "#413630"],
    sizeRange: [0.55, 1.35] as [number, number],
    spawnRadius: Math.min(width, depth) * 0.85,
    maxHeight: ceilingY - 0.4,
    // Near-zero: steam keeps going up. Embers arc and fall; this must not.
    gravity: 0.015,
    burstInterval: 5.5,
    burstCount: 14,
  });

  const GRATE_BARS = 7;
  const bars = $derived(
    Array.from({ length: GRATE_BARS }, (_, i) => ({
      z: -depth / 2 + (depth / (GRATE_BARS - 1)) * i,
    }))
  );
</script>

<!-- Slot walls. The visitor should be able to see DOWN into this, so the sides
     are real geometry rather than a dark texture on the floor. -->
<T.Mesh position={[0, -sink / 2, -depth / 2 - 0.06]} {material}>
  <T.BoxGeometry args={[width + 0.24, sink, 0.12]} />
</T.Mesh>
<T.Mesh position={[0, -sink / 2, depth / 2 + 0.06]} {material}>
  <T.BoxGeometry args={[width + 0.24, sink, 0.12]} />
</T.Mesh>
<T.Mesh position={[-width / 2 - 0.06, -sink / 2, 0]} {material}>
  <T.BoxGeometry args={[0.12, sink, depth]} />
</T.Mesh>
<T.Mesh position={[width / 2 + 0.06, -sink / 2, 0]} {material}>
  <T.BoxGeometry args={[0.12, sink, depth]} />
</T.Mesh>

<!-- Slag at the bottom: the same crust and the same lumps as every other
     station, so this is the coal room losing heat rather than a new material. -->
<LavaCracks
  config={slagCrust}
  groundSize={1}
  edgeFade={0}
  placement={{
    position: [0, -sink + 0.02, 0],
    rotation: [-Math.PI / 2, 0, 0],
    size: [width, depth],
  }}
/>
<T.Group position={[0, -sink + 0.01, depth * 0.42]}>
  <FirstFireCoalBank
    width={width * 0.9}
    height={0.1}
    depth={depth * 0.85}
    count={90}
    sizeRange={[0.04, 0.1]}
    {emberColor}
    heat="raked"
    seed={19}
  />
</T.Group>

<!-- Grate. Bars run across the short axis so a visitor walking the long axis
     always crosses them, and the glow strobes underfoot as they pass. -->
{#each bars as bar, i (i)}
  <T.Mesh position={[0, 0.03, bar.z]} {material}>
    <T.BoxGeometry args={[width + 0.2, 0.06, 0.07]} />
  </T.Mesh>
{/each}
<T.Mesh position={[-width / 2 - 0.09, 0.04, 0]} {material}>
  <T.BoxGeometry args={[0.18, 0.08, depth + 0.24]} />
</T.Mesh>
<T.Mesh position={[width / 2 + 0.09, 0.04, 0]} {material}>
  <T.BoxGeometry args={[0.18, 0.08, depth + 0.24]} />
</T.Mesh>

<!-- Up-light from the slot. Short distance on purpose: the slot lights the
     grate bars and a visitor's shins, and nothing beyond that. -->
<T.PointLight
  position={[0, -sink * 0.4, 0]}
  color={emberColor}
  intensity={7}
  distance={5.5}
  decay={2}
/>

{#if steamRate > 0}
  <T.Group position.y={floorLift + 0.04}>
    <EmberFountains config={steamColumn} />
  </T.Group>
  <T.Group position.y={floorLift}>
    <HeatDistortion
      position={{ x: 0, z: 0 }}
      radius={Math.max(width, depth) * 0.7}
      height={ceilingY}
      intensity={0.22}
    />
  </T.Group>
{/if}
