<script lang="ts">
  import { useTask } from "@threlte/core";
  import type { Object3D } from "three";
  import { QualityTier } from "../../../effects/types";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../primitives/motion-preference";
  import {
    createForestClearingWind,
    type ForestClearingWind,
  } from "../../worlds/forest/forest-clearing-wind";

  interface Props {
    scene: Object3D | null;
    tier?: QualityTier;
  }

  let { scene, tier = QualityTier.MEDIUM }: Props = $props();
  let wind: ForestClearingWind | null = null;

  $effect(() => {
    wind = scene ? createForestClearingWind(scene, tier) : null;
  });

  useTask((delta) => {
    wind?.update(delta, resolveMotionScale(prefersReducedMotion()));
  });
</script>
