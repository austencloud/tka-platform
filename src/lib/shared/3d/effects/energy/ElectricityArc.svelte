<script lang="ts">
  /**
   * ElectricityArc Component
   *
   * Renders procedural lightning/electricity arcs in 3D space.
   * Two modes:
   * - 'arc': Connects two points with a lightning bolt
   * - 'crackle': Random arcs radiating from a single point
   *
   * Uses midpoint displacement algorithm for jagged lightning paths.
   */

  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    Vector3,
    BufferGeometry,
    Float32BufferAttribute,
    AdditiveBlending,
    DynamicDrawUsage,
  } from "three";

  interface Props {
    /** Arc start point */
    start: Vector3;
    /** Arc end point (for 'arc' mode) */
    end?: Vector3;
    /** Whether the effect is active */
    enabled?: boolean;
    /** Intensity 0-1, affects brightness and branch count */
    intensity?: number;
    /** Arc color (default electric blue) */
    color?: string;
    /** Mode: 'arc' connects two points, 'crackle' radiates from start */
    mode?: "arc" | "crackle";
    /**
     * Peak perpendicular wander of the bolt off the straight line, WORLD UNITS
     * (metres). From Zap3DParams.jitterAmount. This was a hardcoded 25 — read
     * as 25 metres between two tips less than a metre apart, which is why zap
     * drew a scribble the size of the room instead of a bolt.
     */
    displacement?: number;
    /** Point count along each bolt. From Zap3DParams.segments. */
    segments?: number;
    /** Frames between path regeneration. From Zap3DParams.regenerateEveryFrames. */
    regenerateEveryFrames?: number;
  }

  let {
    start,
    end,
    enabled = true,
    intensity = 0.7,
    color = "#00ffff",
    mode = "arc",
    displacement = 0.15,
    segments = 9,
    regenerateEveryFrames = 3,
  }: Props = $props();

  /**
   * Midpoint-displacement depth. Each level doubles the point count, so the
   * bolt carries 2^depth + 1 points; depth is derived from the requested
   * segment count rather than fixed, and capped so a high-intensity zap cannot
   * explode the vertex count.
   */
  const subdivisions = $derived(
    Math.max(2, Math.min(5, Math.round(Math.log2(Math.max(4, segments)))))
  );

  // Crackle geometry, world units. A crackle arc is a hand-span off the tip.
  const CRACKLE_ARC_COUNT = 6;
  const CRACKLE_LENGTH_MIN = 0.12;
  const CRACKLE_LENGTH_MAX = 0.32;
  const BRANCH_PROBABILITY = 0.3;
  const BRANCH_LENGTH_RATIO = 0.4;
  const MAIN_MAX_VERTICES = 33;
  const BRANCH_MAX_VERTICES = 512;
  const CRACKLE_MAX_VERTICES = 256;

  // State
  let frameCount = 0;
  let pulsePhase = $state(0);
  let mainVisible = $state(false);
  let branchesVisible = $state(false);
  let crackleVisible = $state(false);

  // The bolt changes shape frequently, but its GPU resources do not need to.
  // Each geometry owns one fixed dynamic position buffer whose draw range is
  // rewritten when the flicker cadence fires. Branches and crackles use line
  // segments so every disjoint path can share one draw call and one buffer.
  const mainGeometry = createDynamicGeometry(MAIN_MAX_VERTICES);
  const branchGeometry = createDynamicGeometry(BRANCH_MAX_VERTICES);
  const crackleGeometry = createDynamicGeometry(CRACKLE_MAX_VERTICES);

  // Derived colors
  const glowColor = $derived(color);
  const coreOpacity = $derived(0.6 + intensity * 0.4);
  const glowOpacity = $derived(0.2 + intensity * 0.3);

  function getRandomPerpendicular(p1: Vector3, p2: Vector3): Vector3 {
    const segment = new Vector3().subVectors(p2, p1).normalize();

    // Create an arbitrary vector not parallel to segment
    const arbitrary =
      Math.abs(segment.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);

    // Cross product gives perpendicular
    const perp1 = new Vector3().crossVectors(segment, arbitrary).normalize();
    const perp2 = new Vector3().crossVectors(segment, perp1).normalize();

    // Random combination of both perpendiculars for 3D variation
    const angle = Math.random() * Math.PI * 2;
    return perp1
      .multiplyScalar(Math.cos(angle))
      .add(perp2.multiplyScalar(Math.sin(angle)));
  }

  /**
   * Generate a lightning path using midpoint displacement
   */
  function generateLightningPath(
    startPoint: Vector3,
    endPoint: Vector3,
    depth: number = subdivisions,
    spread: number = displacement
  ): Vector3[] {
    let points: Vector3[] = [startPoint.clone(), endPoint.clone()];

    for (let i = 0; i < depth; i++) {
      const newPoints: Vector3[] = [];

      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j]!;
        const p2 = points[j + 1]!;
        const mid = p1.clone().lerp(p2, 0.5);

        // Displace perpendicular to segment
        const perpendicular = getRandomPerpendicular(p1, p2);
        const scale = spread / Math.pow(2, i);
        mid.add(perpendicular.multiplyScalar((Math.random() - 0.5) * scale));

        newPoints.push(p1, mid);
      }
      newPoints.push(points[points.length - 1]!);
      points = newPoints;
    }

    return points;
  }

  /**
   * Generate branch arcs from random points along the main arc
   */
  function generateBranches(
    mainPath: Vector3[],
    branchProbability: number
  ): Vector3[][] {
    const branches: Vector3[][] = [];
    if (mainPath.length < 3) return branches;

    const firstPoint = mainPath[0]!;
    const lastPoint = mainPath[mainPath.length - 1]!;

    // Skip first and last points
    for (let i = 1; i < mainPath.length - 1; i++) {
      if (Math.random() < branchProbability * intensity) {
        const branchStart = mainPath[i]!.clone();

        // Random direction for branch
        const direction = new Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();

        // Branch length proportional to main arc
        const mainLength = new Vector3()
          .subVectors(lastPoint, firstPoint)
          .length();
        const branchLength =
          mainLength * BRANCH_LENGTH_RATIO * (0.5 + Math.random() * 0.5);

        const branchEnd = branchStart
          .clone()
          .add(direction.multiplyScalar(branchLength));

        // Generate smaller lightning path for branch
        const branchPath = generateLightningPath(
          branchStart,
          branchEnd,
          Math.max(2, subdivisions - 2), // Fewer subdivisions for branches
          displacement * 0.5
        );

        branches.push(branchPath);
      }
    }

    return branches;
  }

  /**
   * Generate crackle arcs radiating from a point
   */
  function generateCrackleArcs(center: Vector3): Vector3[][] {
    const arcs: Vector3[][] = [];
    const arcCount = Math.floor(CRACKLE_ARC_COUNT * (0.5 + intensity * 0.5));

    for (let i = 0; i < arcCount; i++) {
      // Random direction in 3D
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const direction = new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );

      const length =
        CRACKLE_LENGTH_MIN +
        Math.random() * (CRACKLE_LENGTH_MAX - CRACKLE_LENGTH_MIN);

      const arcEnd = center.clone().add(direction.multiplyScalar(length));

      const arcPath = generateLightningPath(
        center.clone(),
        arcEnd,
        Math.max(2, subdivisions - 1),
        displacement * 0.6
      );

      arcs.push(arcPath);
    }

    return arcs;
  }

  function createDynamicGeometry(maxVertices: number): BufferGeometry {
    const geometry = new BufferGeometry();
    const position = new Float32BufferAttribute(
      new Float32Array(maxVertices * 3),
      3
    );
    position.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  function writeLineStrip(geometry: BufferGeometry, path: Vector3[]): boolean {
    const attribute = geometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const positions = attribute.array as Float32Array;
    const vertexCount = Math.min(path.length, positions.length / 3);
    for (let index = 0; index < vertexCount; index++) {
      const point = path[index]!;
      const offset = index * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
    }
    geometry.setDrawRange(0, vertexCount);
    attribute.needsUpdate = true;
    if (vertexCount >= 2) geometry.computeBoundingSphere();
    return vertexCount >= 2;
  }

  function writeLineSegments(
    geometry: BufferGeometry,
    paths: Vector3[][]
  ): boolean {
    const attribute = geometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const positions = attribute.array as Float32Array;
    let offset = 0;
    for (const path of paths) {
      for (let index = 0; index < path.length - 1; index++) {
        if (offset + 6 > positions.length) break;
        const startPoint = path[index]!;
        const endPoint = path[index + 1]!;
        positions[offset++] = startPoint.x;
        positions[offset++] = startPoint.y;
        positions[offset++] = startPoint.z;
        positions[offset++] = endPoint.x;
        positions[offset++] = endPoint.y;
        positions[offset++] = endPoint.z;
      }
      if (offset + 6 > positions.length) break;
    }
    const vertexCount = offset / 3;
    geometry.setDrawRange(0, vertexCount);
    attribute.needsUpdate = true;
    if (vertexCount >= 2) geometry.computeBoundingSphere();
    return vertexCount >= 2;
  }

  /**
   * Regenerate all lightning paths
   */
  function regeneratePaths() {
    if (mode === "arc" && end) {
      // Arc mode: single main arc with branches
      const mainPath = generateLightningPath(start, end);
      mainVisible = writeLineStrip(mainGeometry, mainPath);

      // Generate branches based on intensity
      if (intensity > 0.3) {
        const branches = generateBranches(mainPath, BRANCH_PROBABILITY);
        branchesVisible = writeLineSegments(branchGeometry, branches);
      } else {
        branchGeometry.setDrawRange(0, 0);
        branchesVisible = false;
      }
      crackleGeometry.setDrawRange(0, 0);
      crackleVisible = false;
    } else {
      // Crackle mode: multiple arcs radiating from center
      mainGeometry.setDrawRange(0, 0);
      branchGeometry.setDrawRange(0, 0);
      mainVisible = false;
      branchesVisible = false;

      const arcs = generateCrackleArcs(start);
      crackleVisible = writeLineSegments(crackleGeometry, arcs);
    }
  }

  // Animation loop
  useTask((delta) => {
    if (!enabled) return;

    frameCount++;
    pulsePhase += delta * 3; // Pulse speed

    // Regenerate paths periodically for flickery effect
    if (frameCount % Math.max(1, regenerateEveryFrames) === 0) {
      regeneratePaths();
    }
  });

  // No position-tracking $effect here on purpose. One used to read start.x/y/z
  // and end.x/y/z and regenerate on change — but those are prop tips, so they
  // change EVERY frame while playing. That made the component rebuild and
  // dispose every BufferGeometry twice per frame (once from the effect, once
  // from the useTask cadence above), which is what stalled the page. The
  // useTask regeneration already reads the current start/end, so the bolt
  // still follows the props; it just re-cuts on the regenerateEveryFrames
  // cadence rather than continuously.

  onDestroy(() => {
    mainGeometry.dispose();
    branchGeometry.dispose();
    crackleGeometry.dispose();
  });

  // Pulsing intensity
  const pulsedCoreOpacity = $derived(
    coreOpacity * (0.8 + 0.2 * Math.sin(pulsePhase))
  );
  const pulsedGlowOpacity = $derived(
    glowOpacity * (0.7 + 0.3 * Math.sin(pulsePhase * 1.3))
  );
</script>

{#if enabled}
  <!-- Main arc (arc mode) -->
  {#if mainVisible}
    <!-- Core line (bright, thin) -->
    <T.Line geometry={mainGeometry}>
      <T.LineBasicMaterial
        color="#ffffff"
        opacity={pulsedCoreOpacity}
        transparent
        blending={AdditiveBlending}
        linewidth={1}
      />
    </T.Line>

    <!-- Glow line (wider, more transparent) -->
    <T.Line geometry={mainGeometry}>
      <T.LineBasicMaterial
        color={glowColor}
        opacity={pulsedGlowOpacity}
        transparent
        blending={AdditiveBlending}
        linewidth={3}
      />
    </T.Line>
  {/if}

  <!-- Branch arcs -->
  {#if branchesVisible}
    <!-- Core -->
    <T.LineSegments geometry={branchGeometry}>
      <T.LineBasicMaterial
        color="#ffffff"
        opacity={pulsedCoreOpacity * 0.7}
        transparent
        blending={AdditiveBlending}
        linewidth={1}
      />
    </T.LineSegments>

    <!-- Glow -->
    <T.LineSegments geometry={branchGeometry}>
      <T.LineBasicMaterial
        color={glowColor}
        opacity={pulsedGlowOpacity * 0.5}
        transparent
        blending={AdditiveBlending}
        linewidth={2}
      />
    </T.LineSegments>
  {/if}

  <!-- Crackle arcs (crackle mode) -->
  {#if crackleVisible}
    <!-- Core -->
    <T.LineSegments geometry={crackleGeometry}>
      <T.LineBasicMaterial
        color="#ffffff"
        opacity={pulsedCoreOpacity * 0.9}
        transparent
        blending={AdditiveBlending}
        linewidth={1}
      />
    </T.LineSegments>

    <!-- Glow -->
    <T.LineSegments geometry={crackleGeometry}>
      <T.LineBasicMaterial
        color={glowColor}
        opacity={pulsedGlowOpacity * 0.7}
        transparent
        blending={AdditiveBlending}
        linewidth={2}
      />
    </T.LineSegments>
  {/if}

  <!-- Optional: Point lights at arc endpoints for extra glow -->
  <!-- Light falloff in METRES: 100/80 lit the entire scene from a prop tip. -->
  {#if intensity > 0.5}
    <T.PointLight
      position={[start.x, start.y, start.z]}
      color={glowColor}
      intensity={intensity * 0.5}
      distance={2.5}
      decay={2}
    />

    {#if mode === "arc" && end}
      <T.PointLight
        position={[end.x, end.y, end.z]}
        color={glowColor}
        intensity={intensity * 0.3}
        distance={2}
        decay={2}
      />
    {/if}
  {/if}
{/if}
