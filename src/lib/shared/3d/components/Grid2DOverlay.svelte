<script lang="ts">
  /**
   * Grid2DOverlay
   *
   * Renders the 2D grid in the orthographic scene: center dot, hand point dots,
   * outer point dots, and connecting circle/lines.
   *
   * Uses the same LOCATION_ANGLES as the Canvas2D grid. Positions in world
   * units where 1.0 = grid hand point radius.
   */

  import { T } from "@threlte/core";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    Color,
  } from "three";

  interface Props {
    gridMode?: "diamond" | "box";
  }

  let { gridMode = "diamond" }: Props = $props();

  const HALF_PI = Math.PI / 2;
  const PI = Math.PI;

  // Cardinal angles (Canvas2D convention: E=0, S=PI/2, W=PI, N=-PI/2)
  const CARDINALS = [0, HALF_PI, PI, -HALF_PI];
  const INTERCARDINALS = [-HALF_PI / 2, HALF_PI / 2, PI - HALF_PI / 2, PI + HALF_PI / 2];

  const handAngles = $derived(gridMode === "box" ? INTERCARDINALS : CARDINALS);
  const outerAngles = $derived(gridMode === "box" ? CARDINALS : INTERCARDINALS);

  function angleToPos(angle: number, radius: number): [number, number, number] {
    return [Math.cos(angle) * radius, -Math.sin(angle) * radius, 0];
  }

  // Grid circle geometry — approximation with 64 segments
  const circleGeometry = $derived.by(() => {
    const segments = 64;
    const positions: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(theta), Math.sin(theta), 0);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geo;
  });

  // Cross lines through center (connecting opposite hand points)
  const crossGeometry = $derived.by(() => {
    const positions: number[] = [];
    for (let i = 0; i < handAngles.length; i++) {
      const a = handAngles[i]!;
      const opp = handAngles[(i + 2) % handAngles.length]!;
      const p1 = angleToPos(a, 1.0);
      const p2 = angleToPos(opp, 1.0);
      positions.push(p1[0], p1[1], 0, p2[0], p2[1], 0);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geo;
  });

  const lineMaterial = new LineBasicMaterial({
    color: new Color(0.4, 0.4, 0.5),
    transparent: true,
    opacity: 0.3,
  });

  const HAND_DOT_RADIUS = 0.04;
  const OUTER_DOT_RADIUS = 0.025;
  const CENTER_DOT_RADIUS = 0.05;

  const handDotColor = "#9ca3af";
  const outerDotColor = "#6b7280";
  const centerDotColor = "#e5e7eb";
</script>

<!-- Grid circle -->
<T.LineLoop geometry={circleGeometry} material={lineMaterial} />

<!-- Cross lines -->
<T.LineSegments geometry={crossGeometry} material={lineMaterial} />

<!-- Center dot -->
<T.Mesh position={[0, 0, 0.001]}>
  <T.CircleGeometry args={[CENTER_DOT_RADIUS, 16]} />
  <T.MeshBasicMaterial color={centerDotColor} />
</T.Mesh>

<!-- Hand point dots -->
{#each handAngles as angle}
  {@const pos = angleToPos(angle, 1.0)}
  <T.Mesh position={[pos[0], pos[1], 0.001]}>
    <T.CircleGeometry args={[HAND_DOT_RADIUS, 16]} />
    <T.MeshBasicMaterial color={handDotColor} />
  </T.Mesh>
{/each}

<!-- Outer point dots -->
{#each outerAngles as angle}
  {@const pos = angleToPos(angle, 1.0)}
  <T.Mesh position={[pos[0], pos[1], 0.001]}>
    <T.CircleGeometry args={[OUTER_DOT_RADIUS, 16]} />
    <T.MeshBasicMaterial color={outerDotColor} />
  </T.Mesh>
{/each}
