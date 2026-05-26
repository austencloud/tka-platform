<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { Medusae, OCEAN_COLORS } from "./jellyfish-geometry";
  import type { OceanQualityConfig } from "../../../quality/ocean-quality";

  // ── Props ──────────────────────────────────────────────────────────────

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  // ── Constants ──────────────────────────────────────────────────────────

  const SCALE = 0.06;
  const DRIFT_SPEED = 0.15;
  const FIXED_STEP = 1000 / 30;
  const STAGE_CLEAR_RADIUS = 6;
  const SPAWN_X_RANGE = 15;
  const SPAWN_Z_RANGE = 15;
  const SPAWN_Y_MIN = 3;
  const SPAWN_Y_MAX = 8;

  // ── Spawn position generation ──────────────────────────────────────────

  function generateSpawnPosition(seed: number): { x: number; y: number; z: number } {
    // Deterministic pseudo-random from seed — avoids hydration jitter
    const r1 = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    const r2 = Math.sin(seed * 269.5 + 183.3) * 43758.5453;
    const r3 = Math.sin(seed * 419.2 + 371.9) * 43758.5453;

    const frac = (v: number) => v - Math.floor(v);

    let x: number, z: number;
    let attempts = 0;

    // Reject positions inside the stage clear radius (center stage area)
    do {
      const rx = frac(Math.abs(r1 + attempts * 0.37));
      const rz = frac(Math.abs(r2 + attempts * 0.53));
      x = (rx * 2 - 1) * SPAWN_X_RANGE;
      z = (rz * 2 - 1) * SPAWN_Z_RANGE;
      attempts++;
    } while (Math.sqrt(x * x + z * z) < STAGE_CLEAR_RADIUS && attempts < 20);

    const ry = frac(Math.abs(r3));
    const y = SPAWN_Y_MIN + ry * (SPAWN_Y_MAX - SPAWN_Y_MIN);

    return { x, y, z };
  }

  // ── Jellyfish instances ────────────────────────────────────────────────

  interface JellyfishInstance {
    medusae: Medusae;
    baseX: number;
    baseY: number;
    baseZ: number;
    phaseOffset: number;
    elapsed: number;
    accumulator: number;
  }

  const instances: JellyfishInstance[] = [];

  const count = quality.maxJellyfish;

  for (let i = 0; i < count; i++) {
    const medusae = new Medusae(OCEAN_COLORS);

    // Warm up physics so jellyfish aren't in their initial collapsed state
    for (let w = 0; w < 200; w++) medusae.update(33);

    const { x, y, z } = generateSpawnPosition(i);
    const phaseOffset = i * 1.618; // Golden ratio spread for varied animation phases

    instances.push({
      medusae,
      baseX: x,
      baseY: y,
      baseZ: z,
      phaseOffset,
      elapsed: phaseOffset * 1000,
      accumulator: 0,
    });
  }

  // ── Per-frame update ───────────────────────────────────────────────────

  useTask((delta) => {
    const dt = Math.min(delta * 1000, 50);

    for (const inst of instances) {
      inst.elapsed += dt;
      inst.accumulator += dt;

      while (inst.accumulator >= FIXED_STEP) {
        inst.medusae.update(FIXED_STEP);
        inst.accumulator -= FIXED_STEP;
      }

      const { elapsed, phaseOffset, baseX, baseY, baseZ, medusae } = inst;
      const t = elapsed * 0.001;

      const driftX = Math.sin(t * DRIFT_SPEED + phaseOffset) * 0.5;
      const driftY = Math.sin(t * DRIFT_SPEED * 0.6 + phaseOffset * 2) * 0.3;
      const driftZ = Math.cos(t * DRIFT_SPEED * 0.8 + phaseOffset * 0.5) * 0.4;

      const animT = medusae.animTime;
      const pulse = (Math.sin(animT * Math.PI - Math.PI * 0.5) + 1) * 0.5;
      const strength = 0.4 + 0.6
        * ((Math.sin(animT * 0.31 + phaseOffset * 5.3) + 1) * 0.5)
        * ((Math.sin(animT * 0.17 + phaseOffset * 2.9) + 1) * 0.5);
      const bob = pulse * strength * 0.08;

      medusae.item.position.set(
        baseX + driftX,
        baseY + driftY + bob,
        baseZ + driftZ,
      );
      medusae.item.scale.setScalar(SCALE);

      const tiltX = Math.sin(t * 0.3 + phaseOffset) * 0.1;
      const tiltZ = Math.cos(t * 0.25 + phaseOffset * 1.5) * 0.08;
      medusae.item.rotation.set(tiltX, t * 0.05, tiltZ);
    }
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  onDestroy(() => {
    for (const inst of instances) inst.medusae.dispose();
  });
</script>

{#each instances as inst (inst.phaseOffset)}
  <T is={inst.medusae.item} />
{/each}
