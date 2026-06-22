<script lang="ts">
  /**
   * AutumnPond
   *
   * A still mirror pond catching the dusk sky. Extracted from WinterScene's
   * frozen-pond block: an organic Shape outline with a Three.js Reflector for
   * a true real-time mirror reflection, tinted toward dusk rose-gold instead
   * of ice-blue.
   *
   * Quality-gated:
   *   - quality.pondReflector === true  → real-time Reflector (expensive, high/medium)
   *   - quality.pondReflector === false → static rose-gold ShapeGeometry mesh (low)
   *
   * Geometry math (createOrganicPondShape) is copied verbatim from
   * WinterScene.svelte — it's pure and shared between both scenes.
   */

  import { T } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    Color,
    Shape,
    ShapeGeometry,
    MeshStandardMaterial,
    type Material,
  } from "three";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    position?: [number, number, number];
    radius?: number;
  }

  let {
    quality,
    groundY = 0,
    position = [0, 0, 0],
    radius = 4.5,
  }: Props = $props();

  // Dusk rose-gold tint for the live reflection (replaces Winter's ice-blue).
  const REFLECTOR_COLOR = "#c98a5a";
  // Dusk sky tint for the static low-tier fallback.
  const FALLBACK_COLOR = "#3a2140";

  // -----------------------------------------------------------------
  // Organic pond outline. Copied verbatim from WinterScene.svelte —
  // pure geometry math (Catmull-Rom → cubic Bezier, closed smooth loop).
  // -----------------------------------------------------------------
  function createOrganicPondShape(
    radius: number,
    irregularity: number,
    seed: number
  ): Shape {
    const shape = new Shape();
    const pointCount = 14;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const noise =
        Math.sin(i * 2.7 + seed) * irregularity +
        Math.cos(i * 1.9 + seed * 1.3) * irregularity * 0.5;
      const r = radius * (1 + noise);
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    shape.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 0; i < pointCount; i++) {
      const p = pts[i]!;
      const pNext = pts[(i + 1) % pointCount]!;
      const pPrev = pts[(i - 1 + pointCount) % pointCount]!;
      const pPlus = pts[(i + 2) % pointCount]!;
      // Catmull-Rom tangents → cubic Bezier controls (keeps shape smooth + closed)
      const c1 = {
        x: p.x + (pNext.x - pPrev.x) / 6,
        y: p.y + (pNext.y - pPrev.y) / 6,
      };
      const c2 = {
        x: pNext.x - (pPlus.x - p.x) / 6,
        y: pNext.y - (pPlus.y - p.y) / 6,
      };
      shape.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, pNext.x, pNext.y);
    }
    return shape;
  }

  // Seed derived from world position so the outline is stable per placement.
  const pondSeed = $derived(position[0] * 0.7 + position[2] * 1.3);
  const pondY = $derived(groundY + 0.01);

  // ── High / medium tier: real-time mirror Reflector ──────────────────
  let pondReflector = $state<Reflector | null>(null);

  $effect(() => {
    // Only run when this tier wants the real reflector. Track inputs;
    // reading pondReflector here would trip the effect_update_depth guard.
    if (!quality.pondReflector) {
      untrack(() => {
        const old = pondReflector;
        if (old) {
          old.geometry.dispose();
          (old.material as Material).dispose();
        }
        pondReflector = null;
      });
      return;
    }

    const shape = createOrganicPondShape(radius, 0.28, pondSeed);
    const geom = new ShapeGeometry(shape, 96);
    const next = new Reflector(geom, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: new Color(REFLECTOR_COLOR),
    });
    next.rotateX(-Math.PI / 2);

    untrack(() => {
      const old = pondReflector;
      if (old) {
        old.geometry.dispose();
        (old.material as Material).dispose();
      }
      pondReflector = next;
    });

    return () => {
      next.geometry.dispose();
      (next.material as Material).dispose();
    };
  });

  // ── Low tier: static rose-gold ShapeGeometry fallback ──────────────
  let fallbackGeometry = $state<ShapeGeometry | null>(null);
  let fallbackMaterial = $state<MeshStandardMaterial | null>(null);

  $effect(() => {
    if (quality.pondReflector) {
      untrack(() => {
        fallbackGeometry?.dispose();
        fallbackMaterial?.dispose();
        fallbackGeometry = null;
        fallbackMaterial = null;
      });
      return;
    }

    const shape = createOrganicPondShape(radius, 0.28, pondSeed);
    const geom = new ShapeGeometry(shape, 96);
    const mat = new MeshStandardMaterial({
      color: new Color(FALLBACK_COLOR),
      roughness: 0.18,
      metalness: 0.35,
    });

    untrack(() => {
      fallbackGeometry?.dispose();
      fallbackMaterial?.dispose();
      fallbackGeometry = geom;
      fallbackMaterial = mat;
    });

    return () => {
      geom.dispose();
      mat.dispose();
    };
  });

  onDestroy(() => {
    if (pondReflector) {
      pondReflector.geometry.dispose();
      (pondReflector.material as Material).dispose();
    }
    fallbackGeometry?.dispose();
    fallbackMaterial?.dispose();
  });
</script>

{#if quality.pondReflector && pondReflector}
  <T
    is={pondReflector}
    position.x={position[0]}
    position.y={pondY}
    position.z={position[2]}
  />
{:else if !quality.pondReflector && fallbackGeometry && fallbackMaterial}
  <T.Mesh
    geometry={fallbackGeometry}
    material={fallbackMaterial}
    position.x={position[0]}
    position.y={pondY}
    position.z={position[2]}
    rotation.x={-Math.PI / 2}
  />
{/if}
