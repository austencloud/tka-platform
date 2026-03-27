<script lang="ts">
  /**
   * TrailRenderer Component
   *
   * Renders a trail following prop movement using TubeGeometry.
   * Supports solid colors and rainbow mode (HSL cycling).
   * Uses standard Three.js geometry to avoid multi-instance issues.
   */

  import { T } from "@threlte/core";
  import {
    Vector3,
    Color,
    CatmullRomCurve3,
    TubeGeometry,
    MeshBasicMaterial,
    DoubleSide,
    Float32BufferAttribute,
    BufferGeometry,
    SphereGeometry,
  } from "three";

  interface Props {
    /** Trail points from newest to oldest */
    positions: Vector3[];
    /** Hex color or 'rainbow' for HSL cycling */
    color: string;
    /** Trail thickness radius (default: 2) */
    width?: number;
    /** Base opacity (default: 0.8) */
    opacity?: number;
    /** Fade opacity toward tail (default: true) */
    fadeOut?: boolean;
    /** Minimum points to render trail (default: 3) */
    minPoints?: number;
  }

  let {
    positions = [],
    color = "#ffffff",
    width = 2,
    opacity = 0.8,
    fadeOut = true,
    minPoints = 3,
  }: Props = $props();

  // Safely check if we have enough valid points
  const validPositions = $derived.by(() => {
    if (!positions || !Array.isArray(positions)) return [];
    return positions.filter(
      (p): p is Vector3 =>
        p instanceof Vector3 && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );
  });

  const hasEnoughPoints = $derived(validPositions.length >= minPoints);

  // Whether it's rainbow mode
  const isRainbow = $derived(color === "rainbow");

  // Convert hex color to Color object for solid mode
  const solidColor = $derived.by(() => {
    if (isRainbow) return new Color(0xffffff);
    try {
      return new Color(color);
    } catch {
      return new Color(0xffffff);
    }
  });

  // Create tube geometry from positions
  const tubeGeometry = $derived.by((): BufferGeometry | null => {
    if (!hasEnoughPoints) return null;

    try {
      // Clone positions to avoid mutation issues
      const points = validPositions.map((p) => p.clone());

      // Need at least 2 points for a curve
      if (points.length < 2) return null;

      // Create smooth curve through points
      const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.5);

      // Create tube geometry
      const segments = Math.max(points.length * 2, 8);
      const geometry = new TubeGeometry(curve, segments, width, 8, false);

      // If fadeOut or rainbow, modify vertex colors
      if (fadeOut || isRainbow) {
        const positionAttr = geometry.getAttribute("position");
        if (!positionAttr) return geometry;

        const count = positionAttr.count;
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          const x = positionAttr.getX(i);
          const y = positionAttr.getY(i);
          const z = positionAttr.getZ(i);
          const vertexPos = new Vector3(x, y, z);

          // Find closest point on curve to determine t value
          let minDist = Infinity;
          let closestT = 0;

          for (let j = 0; j < points.length; j++) {
            const dist = vertexPos.distanceTo(points[j]!);
            if (dist < minDist) {
              minDist = dist;
              closestT = points.length > 1 ? j / (points.length - 1) : 0;
            }
          }

          let c: Color;
          if (isRainbow) {
            c = new Color();
            c.setHSL(closestT, 0.8, 0.6);
          } else {
            c = solidColor.clone();
          }

          // Apply fade
          if (fadeOut) {
            c.multiplyScalar(1 - closestT * 0.8);
          }

          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }

        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      }

      return geometry;
    } catch (e) {
      console.warn("TrailRenderer: Failed to create geometry", e);
      return null;
    }
  });

  // Create material
  const material = $derived.by(() => {
    return new MeshBasicMaterial({
      color: isRainbow ? 0xffffff : solidColor,
      transparent: true,
      opacity: opacity,
      side: DoubleSide,
      vertexColors: fadeOut || isRainbow,
      depthWrite: false,
    });
  });
</script>

{#if hasEnoughPoints && tubeGeometry}
  <T.Mesh geometry={tubeGeometry} {material} />
{/if}
