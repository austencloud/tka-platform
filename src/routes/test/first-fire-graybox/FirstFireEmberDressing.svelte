<script lang="ts">
  /**
   * FirstFireEmberDressing
   *
   * Gate 3 material pass for The Cinder Court. Composes the existing ember
   * environment components (LavaCracks, FireWisps, HeatDistortion) onto the
   * approved graybox route instead of re-deriving volcanic shading here.
   *
   * Two hard constraints from the Gate 3 spec:
   *
   * 1. Every photon comes from something burning. There is no ambient fill and
   *    no sky dome, so `lit` can take the room to true black at the
   *    extinguish beat. VolcanicHaze is deliberately NOT mounted for that
   *    reason - it is an inward-facing additive sphere, which is a sky.
   * 2. Fire never owns collision. Everything here is visual-only; the collider
   *    set in first-fire-graybox-colliders.ts is untouched.
   */
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import LavaCracks from "$lib/shared/3d/environments/scenes/ember/LavaCracks.svelte";
  import HeatDistortion from "$lib/shared/3d/environments/scenes/ember/HeatDistortion.svelte";
  import { createDefaultEmberConfig } from "$lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config";
  import type { FirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";

  interface Props {
    contract: FirstFireBlenderContract;
    /** False from the extinguish beat onward: every ember source goes out. */
    lit: boolean;
    /** The court the visitor is standing in, or null on the approach. */
    activeShrineId: string | null;
  }

  const props: Props = $props();

  const ember = createDefaultEmberConfig();

  // The ember components anchor to the avatar ground datum (about -1.4m); the
  // museum floor is y=0. Same compensation MuseumPerformerStation3D applies.
  const floorLift = $derived(-userProportionsState.groundY);

  // Runtime space is (blender.x, blender.z, -blender.y) per the exporter.
  const courts = $derived(
    props.contract.shrines.map((shrine) => ({
      id: shrine.id,
      x: shrine.blenderCentre.x,
      z: -shrine.blenderCentre.y,
      // The contract's trench radii sit under the shrine plinth, which is wider
      // than they are, so the ring would never be seen. The molten channel
      // instead runs just outboard of the walked orbit band: at arm's length
      // on the visitor's outside shoulder, against the court wall that already
      // owns the collision.
      trenchInner: shrine.orbitRadius + shrine.orbitWidth / 2 + 0.12,
      trenchOuter: shrine.orbitRadius + shrine.orbitWidth / 2 + 0.78,
    }))
  );

  // DJ is the hottest court in the room: the narrowest throat, the hardest
  // distortion, the trench at arm's length. EK and FL step down from it.
  function heatIntensity(id: string): number {
    if (id === "dj") return 0.14;
    return id === "ek" ? 0.085 : 0.07;
  }

  const cracks = { ...ember.lavaCracks, intensity: 0.28 };
  // FireWisps is deliberately NOT mounted. It is authored for an open crater
  // with sky above it; under a cave ceiling its spheres read as floating
  // objects rather than as drifting fire, and three courts' worth of its point
  // lights washed the basalt to salmon. The court's fire comes from the
  // trench, the torches, and the performer's own props instead.
</script>

{#if props.lit}
  <T.Group position.y={floorLift}>
    <!-- Floor veins under the walked route, one plane spanning the court run. -->
    <LavaCracks config={cracks} groundSize={64} />

    {#each courts as court (court.id)}
      <!-- Heat also hangs off the avatar ground datum, so it lifts with the group. -->
      <HeatDistortion
        position={{ x: court.x, z: court.z }}
        radius={court.trenchOuter + 0.6}
        height={5.5}
        intensity={heatIntensity(court.id)}
      />
    {/each}
  </T.Group>

  {#each courts as court (court.id)}
    <!-- The magma trench: the ring the visitor walks outside of, at arm's
         length from the orbit band. Visual only - it carries no collider. -->
    <T.Mesh
      position={[court.x, 0.035, court.z]}
      rotation.x={-Math.PI / 2}
    >
      <T.RingGeometry args={[court.trenchInner, court.trenchOuter, 64]} />
      <T.MeshBasicMaterial
        color={court.id === "dj" ? "#ff5a12" : "#e8430c"}
        toneMapped={false}
      />
    </T.Mesh>
    <T.PointLight
      position={[court.x, 0.45, court.z]}
      color="#ff5a12"
      intensity={court.id === props.activeShrineId ? 16 : 7}
      distance={9}
      decay={2}
    />
  {/each}
{/if}
