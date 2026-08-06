<script lang="ts">
  /**
   * BubbleEmitter3D - per-tip buoyant bubble emitter.
   *
   * Each bubble renders as a billboarded sphere (MeshBasicMaterial with
   * additive rim approximation). Bubbles rise (+y world), drift horizontally,
   * and grow over lifetime - distinct from water droplets which fall.
   *
   * Oil palette uses an iridescent rim color sampled from the palette
   * registry's oilIridescentRim() helper.
   */

  import { T, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import type { Bubbles3DParams } from "$lib/shared/effects/translators/webgl3d-types";
  import { oilIridescentRim } from "$lib/shared/effects/domain/bubble-palettes";

  interface Props {
    /** World-space position of this tip. null = hidden. */
    position: Vector3 | null;
    /** Tip velocity in metres per second. */
    propVelocity: Vector3;
    /** Resolved bubble params (palette + rates + rise speed). */
    params: Bubbles3DParams;
    /** Gates mounting. */
    enabled: boolean;
  }

  let { position, propVelocity, params, enabled }: Props = $props();

  interface Bubble3D {
    id: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    maxAge: number;
    baseR: number;
    growthRate: number;
    maxR: number;
    popping: number;
    popAge: number;
    popR: number;
  }

  let bubbles = $state<Bubble3D[]>([]);
  let spawnAccumulator = 0;
  let nextId = 0;

  const PER_TIP_CAP = 256;
  const POP_DURATION = 0.14;
  const POP_MAX_SCALE = 1.5;

  useTask((delta) => {
    if (!enabled || !position) return;

    const speed = propVelocity.length();
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, speed / params.motionReferenceSpeed)
        : 0;
    const rate =
      params.ambientEmission * params.ambientSpawnRate +
      params.motionEmission * speedScalar * params.motionSpawnRate;

    spawnAccumulator += delta * rate;
    const paletteId = params.resolvedPalette.id;
    const maxSizeMult =
      paletteId === "soap" || paletteId === "oil" || paletteId === "spirit"
        ? 3.0
        : paletteId === "champagne" || paletteId === "acid"
          ? 1.4
          : 2.2;
    const growth = Math.max(0, 1 - params.sizeJitter);
    const baseR = params.baseRadius * (0.7 + 0.9 * params.intensity);

    while (spawnAccumulator >= 1 && bubbles.length < PER_TIP_CAP) {
      const px = position.x;
      const py = position.y;
      const pz = position.z;
      // Origin jitter.
      const ox = (Math.random() - 0.5) * 0.04;
      const oy = (Math.random() - 0.5) * 0.04;
      const oz = (Math.random() - 0.5) * 0.04;
      // Horizontal drift - light random chaos in XZ plane.
      const drift = 0.05;
      const jitter = 1.0 + (Math.random() - 0.5) * 2 * Math.max(0.05, params.sizeJitter);
      const r0 = baseR * jitter;
      bubbles.push({
        id: nextId++,
        x: px + ox,
        y: py + oy,
        z: pz + oz,
        vx: (Math.random() - 0.5) * drift,
        vy: params.riseSpeed,
        vz: (Math.random() - 0.5) * drift,
        age: 0,
        maxAge: params.lifetime * (0.7 + Math.random() * 0.6),
        baseR: r0,
        growthRate: growth,
        maxR: r0 * maxSizeMult * (0.85 + Math.random() * 0.3),
        popping: 0,
        popAge: 0,
        popR: r0,
      });
      spawnAccumulator -= 1;
    }

    // Integrate + age + cull.
    const surviving: Bubble3D[] = [];
    for (const b of bubbles) {
      if (b.popping === 1) {
        b.popAge += delta;
        if (b.popAge >= POP_DURATION) continue;
        b.x += b.vx * delta;
        b.y += b.vy * delta;
        b.z += b.vz * delta;
        surviving.push(b);
        continue;
      }
      b.age += delta;
      b.x += b.vx * delta;
      b.y += b.vy * delta;
      b.z += b.vz * delta;
      const currentR = computeRadius(b);
      if (b.age >= b.maxAge || currentR >= b.maxR) {
        b.popping = 1;
        b.popAge = 0;
        b.popR = currentR;
        surviving.push(b);
        continue;
      }
      surviving.push(b);
    }
    bubbles = surviving;
  });

  function computeRadius(b: Bubble3D): number {
    const lifeT = Math.min(1, b.age / b.maxAge);
    const grow = 1 - Math.pow(1 - lifeT, 1.6);
    const growSpan = b.maxR - b.baseR;
    return b.baseR + growSpan * grow * b.growthRate;
  }

  const palette = $derived(params.resolvedPalette);
  const iridescent = $derived(palette.iridescent === true);

  function rimFor(b: Bubble3D): string {
    if (iridescent) {
      return oilIridescentRim(Math.min(1, b.age / b.maxAge));
    }
    return palette.rim;
  }

  function renderRadius(b: Bubble3D): number {
    if (b.popping === 1) {
      const t = b.popAge / POP_DURATION;
      return b.popR * (1 + (POP_MAX_SCALE - 1) * t);
    }
    return computeRadius(b);
  }

  function renderOpacity(b: Bubble3D): number {
    if (b.popping === 1) {
      return 1 - b.popAge / POP_DURATION;
    }
    const lifeT = Math.min(1, b.age / b.maxAge);
    const fadeIn = lifeT < 0.08 ? lifeT / 0.08 : 1;
    const fadeOut = lifeT > 0.85 ? 1 - (lifeT - 0.85) / 0.15 : 1;
    return fadeIn * fadeOut;
  }
</script>

{#each bubbles as b (b.id)}
  {@const r = renderRadius(b)}
  {@const op = renderOpacity(b)}
  {#if op > 0.02 && r > 0.001}
    <!-- scale={r} is load-bearing: the geometry is a UNIT sphere, so without it
         every bubble renders at radius 1 — a 2-metre ball on a 0.86m staff.
         renderRadius() was being computed and then used only for the cull test
         below, so all the growth, pop and jitter maths above was thrown away
         and the tip disappeared inside one white blob. -->
    <T.Mesh position.x={b.x} position.y={b.y} position.z={b.z} scale={r}>
      <T.SphereGeometry args={[1, 12, 8]} />
      <T.MeshBasicMaterial
        color={rimFor(b)}
        transparent
        opacity={op * 0.55}
        depthWrite={false}
        wireframe
      />
    </T.Mesh>
  {/if}
{/each}
