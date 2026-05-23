<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { Medusae, OCEAN_COLORS, type MedusaeColors } from "./jellyfish/medusae";

  interface Props {
    x?: number;
    y?: number;
    z?: number;
    scale?: number;
    colors?: MedusaeColors;
    seed?: number;
    driftSpeed?: number;
  }

  let {
    x = 0,
    y = 0,
    z = 0,
    scale = 0.06,
    colors = OCEAN_COLORS,
    seed = 0,
    driftSpeed = 0.15,
  }: Props = $props();

  const medusae = new Medusae(colors);

  for (let i = 0; i < 200; i++) medusae.update(33);

  const phaseOffset = seed * 1.618;
  let elapsed = phaseOffset * 1000;

  const FIXED_STEP = 1000 / 30;
  let accumulator = 0;

  useTask((delta) => {
    const dt = Math.min(delta * 1000, 50);
    elapsed += dt;
    accumulator += dt;

    while (accumulator >= FIXED_STEP) {
      medusae.update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }

    const driftX = Math.sin(elapsed * 0.001 * driftSpeed + phaseOffset) * 0.5;
    const driftY = Math.sin(elapsed * 0.001 * driftSpeed * 0.6 + phaseOffset * 2) * 0.3;
    const driftZ = Math.cos(elapsed * 0.001 * driftSpeed * 0.8 + phaseOffset * 0.5) * 0.4;

    const t = medusae.animTime;
    const pulse = (Math.sin(t * Math.PI - Math.PI * 0.5) + 1) * 0.5;
    const strength = 0.4 + 0.6 * ((Math.sin(t * 0.31 + phaseOffset * 5.3) + 1) * 0.5)
      * ((Math.sin(t * 0.17 + phaseOffset * 2.9) + 1) * 0.5);
    const bob = pulse * strength * 0.08;

    medusae.item.position.set(x + driftX, y + driftY + bob, z + driftZ);
    medusae.item.scale.setScalar(scale);

    const tiltX = Math.sin(elapsed * 0.0003 + phaseOffset) * 0.1;
    const tiltZ = Math.cos(elapsed * 0.00025 + phaseOffset * 1.5) * 0.08;
    medusae.item.rotation.set(tiltX, elapsed * 0.00005, tiltZ);
  });

  onDestroy(() => medusae.dispose());
</script>

<T is={medusae.item} />
