<script lang="ts">
  import { T } from "@threlte/core";
  import { untrack } from "svelte";
  import { Shape, ShapeGeometry, type Material, SphereGeometry } from "three";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import { Color } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    color?: string;
    width?: number;
    opacity?: number;
  }

  let { color = "#1a3a4a", width = 1.8, opacity: _opacity = 1 }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // --- Stream shape ---
  // Center-line points defining the winding path
  // The stream enters from x:-15 and exits at x:15, curving in an S
  // that passes ~4-5m from the scene center (clearing radius ~6m).
  function createStreamShape(w: number): Shape {
    const shape = new Shape();
    const hw = w / 2;

    // Left bank (forward direction along the stream)
    shape.moveTo(-15, -5 - hw);
    shape.bezierCurveTo(-8, -3 - hw, -3, 3 - hw, 0, 4 - hw);
    shape.bezierCurveTo(3, 5 - hw, 8, 2 - hw, 15, 8 - hw);

    // Right bank (backward direction)
    shape.lineTo(15, 8 + hw);
    shape.bezierCurveTo(8, 2 + hw, 3, 5 + hw, 0, 4 + hw);
    shape.bezierCurveTo(-3, 3 + hw, -8, -3 + hw, -15, -5 + hw);
    shape.closePath();

    return shape;
  }

  // --- Reflector (same lifecycle pattern as CherryBlossomScene pond) ---
  let streamReflector = $state<Reflector | null>(null);

  $effect(() => {
    const shape = createStreamShape(width);
    const geom = new ShapeGeometry(shape, 64);

    const next = new Reflector(geom, {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: new Color(color),
    });
    next.rotateX(-Math.PI / 2);

    untrack(() => {
      const old = streamReflector;
      if (old) {
        old.geometry.dispose();
        (old.material as Material).dispose();
      }
      streamReflector = next;
    });

    return () => {
      next.geometry.dispose();
      (next.material as Material).dispose();
    };
  });

  // --- Stream-bank stones ---
  // Sample points along the center-line, then offset to each bank with jitter.
  interface BankStone {
    x: number;
    z: number;
    scale: number;
    rotationY: number;
  }

  function sampleCenterLine(t: number): { x: number; z: number } {
    // Two cubic bezier segments, t in [0,1] across the whole path
    if (t < 0.5) {
      const u = t * 2;
      const x = cubicBez(-15, -8, -3, 0, u);
      const z = cubicBez(-5, -3, 3, 4, u);
      return { x, z };
    } else {
      const u = (t - 0.5) * 2;
      const x = cubicBez(0, 3, 8, 15, u);
      const z = cubicBez(4, 5, 2, 8, u);
      return { x, z };
    }
  }

  function cubicBez(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function sampleTangent(t: number): { dx: number; dz: number } {
    const dt = 0.005;
    const a = sampleCenterLine(Math.max(0, t - dt));
    const b = sampleCenterLine(Math.min(1, t + dt));
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    return { dx: dx / len, dz: dz / len };
  }

  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const bankStones: BankStone[] = $derived.by(() => {
    const stones: BankStone[] = [];
    const stoneCount = 14;
    const hw = width / 2;

    for (let i = 0; i < stoneCount; i++) {
      const t = (i + 0.5) / stoneCount;
      const center = sampleCenterLine(t);
      const tangent = sampleTangent(t);
      // Perpendicular: rotate tangent 90 degrees
      const nx = -tangent.dz;
      const nz = tangent.dx;

      // Place on both banks
      for (const side of [-1, 1] as const) {
        const seed = i * 31 + (side === 1 ? 17 : 0);
        const jitterAlong = (seededRandom(seed + 1) - 0.5) * 0.6;
        const jitterPerp = seededRandom(seed + 2) * 0.4;
        const dist = hw + 0.15 + jitterPerp;

        stones.push({
          x: center.x + nx * side * dist + tangent.dx * jitterAlong,
          z: center.z + nz * side * dist + tangent.dz * jitterAlong,
          scale: 0.7 + seededRandom(seed + 3) * 0.6,
          rotationY: seededRandom(seed + 4) * Math.PI * 2,
        });
      }
    }

    return stones;
  });

  import { onDestroy } from "svelte";

  const stoneGeometry = new SphereGeometry(0.15, 5, 4);
  stoneGeometry.scale(1, 0.4, 1);

  onDestroy(() => {
    stoneGeometry.dispose();
  });
</script>

<!-- Reflective winding stream -->
{#if streamReflector}
  <T
    is={streamReflector}
    position.y={groundY + 0.005}
  />
{/if}

<!-- Stream-bank stones -->
{#each bankStones as stone}
  <T.Mesh
    geometry={stoneGeometry}
    position.x={stone.x}
    position.y={groundY + 0.02}
    position.z={stone.z}
    scale={stone.scale}
    rotation.y={stone.rotationY}
  >
    <T.MeshStandardMaterial color="#5a5040" roughness={0.92} />
  </T.Mesh>
{/each}
