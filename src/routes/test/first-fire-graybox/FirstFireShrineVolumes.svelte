<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import { VolumetricFireMesh } from "$lib/shared/3d/effects/fire/volumetric-fire-mesh";
  import { QualityTier } from "$lib/shared/3d/effects/types";

  interface ShrineVolume {
    id: string;
    position: [number, number, number];
  }

  interface Props {
    shrines: readonly ShrineVolume[];
  }

  const props: Props = $props();
  const fires = props.shrines.map((shrine, index) => {
    const fire = new VolumetricFireMesh({
      preset: "classic",
      qualityTier: QualityTier.MEDIUM,
      boxScale: new Vector3(1.8, 3.2, 1.8),
    });
    fire.name = `FirstFireShrineVolume_${shrine.id}`;
    fire.position.set(shrine.position[0], 1.58, shrine.position[2]);
    fire.setIntensity(1.05);
    fire.setTurbulence(1.15);
    fire.setScrollSpeed(1.25 + index * 0.08);
    fire.setWarp(0.92);
    fire.setErosion(0.49);
    fire.setEmission(2.1);
    fire.setFlameRadius(0.68);
    fire.setLeanOffset((index - 1) * 0.035, index === 1 ? 0.025 : -0.02);
    return { id: shrine.id, fire, phase: index * 8.73 };
  });

  let elapsed = 0;
  let motionScale = 1;
  let reducedMotionQuery: MediaQueryList | null = null;

  function syncMotionPreference(): void {
    motionScale = reducedMotionQuery?.matches ? 0.35 : 1;
  }

  onMount(() => {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    syncMotionPreference();
    reducedMotionQuery.addEventListener("change", syncMotionPreference);
  });

  useTask((delta) => {
    elapsed += Math.min(delta, 1 / 20) * motionScale;
    fires.forEach(({ fire, phase }) => {
      fire.setTime(elapsed + phase);
    });
  });

  onDestroy(() => {
    reducedMotionQuery?.removeEventListener("change", syncMotionPreference);
    fires.forEach(({ fire }) => fire.dispose());
  });
</script>

{#each fires as entry (entry.id)}
  <T is={entry.fire} />
{/each}
