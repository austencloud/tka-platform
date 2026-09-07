<script lang="ts">
  /**
   * Ocean Depth Gradient
   *
   * The abyss. FogExp2 has no height term — it fades everything toward one
   * colour, so looking DOWN past the shelf lip would resolve to exactly the
   * same navy as looking OUT at the horizon, and the drop-off would read as a
   * ledge over a glowing blue nothing.
   *
   * Same construction as primitives/SkyGradient.svelte: an inverted sphere
   * with a vertical gradient, re-centred on the camera every frame. Being
   * camera-locked is the load-bearing part — a backdrop that cannot be outrun
   * has no seam, which is what lets the forest's horizon feel infinite.
   *
   * depthTest:false + renderOrder:-1 means this always loses to real geometry
   * and only shows through gaps, so the shelf lip silhouettes against black.
   *
   * Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import { createOceanDepthGradient } from "../../../worlds/ocean/ocean-depth-gradient";

  interface Props {
    /**
     * Looking up. Kept close to the fog because the water plane is a finite
     * disc and anything that DISAGREES with the haze behind its rim turns the
     * rim into a visible edge. That used to mean keeping this dark, on the
     * theory that brighter meant a hole. It cut the other way: the plane was
     * exempt from fog, so its rim was bright against a dark backdrop and read
     * as a black wedge sweeping into frame. Now that the surface fogs, the
     * backdrop has to meet it at the haze value instead of below it.
     */
    shallowColor?: string;
    /** Eye level. Matches the scene fog so geometry and void agree. */
    midColor?: string;
    /** Straight down. The abyss. */
    deepColor?: string;
    radius?: number;
  }

  let {
    shallowColor = "#123c55",
    midColor = "#0a2438",
    deepColor = "#01060b",
    radius = 180,
  }: Props = $props();

  const { camera } = useThrelte();
  const world = untrack(() =>
    createOceanDepthGradient({ shallowColor, midColor, deepColor, radius })
  );

  $effect(() => {
    world.setColors({ shallowColor, midColor, deepColor });
  });

  useTask(() => {
    const activeCamera = camera.current;
    if (activeCamera) world.update(activeCamera);
  });

  onDestroy(world.dispose);
</script>

<T is={world.object} />
