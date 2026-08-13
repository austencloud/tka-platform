<script lang="ts">
  import { T } from "@threlte/core";
  import {
    Prop3D,
    type PropState3D,
    type PropType,
  } from "@austencloud/scene-3d";
  import { onDestroy, tick } from "svelte";
  import { Group, Mesh } from "three";
  import type { GhostPoseSample } from "$lib/shared/effects/renderers/ghost-pose-history";
  import type { GhostPropPose3D } from "./ghost-prop-pose-3d";
  import {
    createChronoFrostMaterial,
    resolveGhostAgeVisual,
    resolveGhostPoseFrostSeed,
    updateChronoFrostMaterial,
  } from "./ghost-chrono-frost-3d";

  interface Props {
    sample: GhostPoseSample<GhostPropPose3D> | null;
    fallbackState: PropState3D;
    propType: PropType;
    propColor: "blue" | "red";
    color: string;
    intensity: number;
    lifetimeSeconds: number;
    rimPower: number;
    propLength: number;
    slotIndex: number;
  }

  let {
    sample,
    fallbackState,
    propType,
    propColor,
    color,
    intensity,
    lifetimeSeconds,
    rimPower,
    propLength,
    slotIndex,
  }: Props = $props();

  let groupRef = $state<Group>();
  const material = createChronoFrostMaterial(slotIndex);
  const active = $derived(sample !== null);
  const pose = $derived(sample?.snapshot ?? null);
  const renderedState = $derived(pose?.propState ?? fallbackState);
  const position = $derived(pose?.center ?? ([0, 0, 0] as const));
  const normalizedAge = $derived(
    Math.max(
      0,
      Math.min(1, (sample?.ageSeconds ?? lifetimeSeconds) / lifetimeSeconds)
    )
  );
  // Old translucent poses draw first; fresh icy bodies draw last. The order is
  // tied to time, so reassigning a reusable slot cannot make layers pop.
  const renderOrder = $derived(
    500 + (1 - normalizedAge) * 1000 + slotIndex * 0.0001
  );
  const frostSeed = $derived(
    sample
      ? resolveGhostPoseFrostSeed(sample.key)
      : resolveGhostPoseFrostSeed(`empty-${slotIndex}`)
  );

  function applyChronoFrostMaterial(root: Group): void {
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }

  $effect(() => {
    const root = groupRef;
    const currentType = propType;
    if (!root) return;
    let cancelled = false;
    void tick().then(() => {
      if (!cancelled && currentType === propType) {
        applyChronoFrostMaterial(root);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const ageSeconds = sample?.ageSeconds ?? lifetimeSeconds;
    updateChronoFrostMaterial(
      material,
      color,
      resolveGhostAgeVisual(ageSeconds, lifetimeSeconds, intensity),
      rimPower,
      frostSeed
    );
  });

  onDestroy(() => material.dispose());
</script>

<T.Group
  bind:ref={groupRef}
  {position}
  {renderOrder}
  visible={active}
  userData={{ ghostChronoFrostSlot: slotIndex }}
>
  <Prop3D
    {propType}
    propState={renderedState}
    color={propColor}
    visible={true}
    length={propLength}
  />
</T.Group>
