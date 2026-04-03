<script lang="ts">
  /**
   * Animated torch point light with realistic flicker.
   * Uses layered sine waves + noise for organic fire-like intensity variation.
   */
  import { T, useTask } from "@threlte/core";
  import type { PointLight } from "three";

  interface Props {
    x: number;
    z: number;
    y?: number;
    baseIntensity?: number;
    color?: string;
    distance?: number;
  }

  let {
    x,
    z,
    y = 1.25,
    baseIntensity = 4,
    color = "#ff9020",
    distance = 8,
  }: Props = $props();

  let light: PointLight | undefined = $state();
  let elapsed = Math.random() * 100; // Random offset so torches don't flicker in sync

  useTask((delta) => {
    if (!light) return;
    elapsed += delta;

    // Layered flicker: slow breathing + medium wobble + fast crackle
    const slow = Math.sin(elapsed * 1.2) * 0.15;
    const medium = Math.sin(elapsed * 4.7) * 0.1;
    const fast = Math.sin(elapsed * 13.3) * 0.05;
    // Pseudo-random crackle (deterministic from elapsed time)
    const crackle = Math.sin(elapsed * 37.1) * Math.sin(elapsed * 23.7) * 0.08;

    light.intensity = baseIntensity + (slow + medium + fast + crackle) * baseIntensity;

    // Subtle color temperature shift — hotter/cooler with the flicker
    const warmShift = 0.02 * Math.sin(elapsed * 2.3);
    light.color.setRGB(
      1.0,
      0.56 + warmShift,
      0.13 - warmShift * 0.5,
    );
  });
</script>

<T.PointLight
  bind:ref={light}
  position={[x, y, z]}
  intensity={baseIntensity}
  {color}
  {distance}
  decay={2}
/>
