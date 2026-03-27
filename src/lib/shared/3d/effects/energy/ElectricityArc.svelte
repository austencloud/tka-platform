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
  import {
    Vector3,
    BufferGeometry,
    Float32BufferAttribute,
    AdditiveBlending,
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
  }

  let {
    start,
    end,
    enabled = true,
    intensity = 0.7,
    color = "#00ffff",
    mode = "arc",
  }: Props = $props();

  // Configuration
  const SUBDIVISIONS = 5;
  const BASE_DISPLACEMENT = 25;
  const CRACKLE_ARC_COUNT = 6;
  const CRACKLE_LENGTH_MIN = 20;
  const CRACKLE_LENGTH_MAX = 50;
  const REGENERATE_INTERVAL = 3; // Frames between path regeneration
  const BRANCH_PROBABILITY = 0.3;
  const BRANCH_LENGTH_RATIO = 0.4;

  // State
  let frameCount = $state(0);
  let mainGeometry = $state<BufferGeometry | null>(null);
  let branchGeometries = $state<BufferGeometry[]>([]);
  let crackleGeometries = $state<BufferGeometry[]>([]);
  let pulsePhase = $state(0);

  // Derived colors
  const glowColor = $derived(color);
  const coreOpacity = $derived(0.6 + intensity * 0.4);
  const glowOpacity = $derived(0.2 + intensity * 0.3);

  /**
   * Get a random perpendicular vector to a segment
   */
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
    subdivisions: number = SUBDIVISIONS,
    displacement: number = BASE_DISPLACEMENT
  ): Vector3[] {
    let points: Vector3[] = [startPoint.clone(), endPoint.clone()];

    for (let i = 0; i < subdivisions; i++) {
      const newPoints: Vector3[] = [];

      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j]!;
        const p2 = points[j + 1]!;
        const mid = p1.clone().lerp(p2, 0.5);

        // Displace perpendicular to segment
        const perpendicular = getRandomPerpendicular(p1, p2);
        const scale = displacement / Math.pow(2, i);
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
          3, // Fewer subdivisions for branches
          BASE_DISPLACEMENT * 0.5
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
        4,
        BASE_DISPLACEMENT * 0.6
      );

      arcs.push(arcPath);
    }

    return arcs;
  }

  /**
   * Convert a path to a BufferGeometry for line rendering
   */
  function pathToGeometry(path: Vector3[]): BufferGeometry {
    const geometry = new BufferGeometry();
    const positions: number[] = [];

    for (const point of path) {
      positions.push(point.x, point.y, point.z);
    }

    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geometry;
  }

  /**
   * Dispose of a geometry
   */
  function disposeGeometry(geometry: BufferGeometry | null) {
    if (geometry) {
      geometry.dispose();
    }
  }

  /**
   * Regenerate all lightning paths
   */
  function regeneratePaths() {
    // Clean up old geometries
    disposeGeometry(mainGeometry);
    branchGeometries.forEach(disposeGeometry);
    crackleGeometries.forEach(disposeGeometry);

    if (mode === "arc" && end) {
      // Arc mode: single main arc with branches
      const mainPath = generateLightningPath(start, end);
      mainGeometry = pathToGeometry(mainPath);

      // Generate branches based on intensity
      if (intensity > 0.3) {
        const branches = generateBranches(mainPath, BRANCH_PROBABILITY);
        branchGeometries = branches.map(pathToGeometry);
      } else {
        branchGeometries = [];
      }

      crackleGeometries = [];
    } else {
      // Crackle mode: multiple arcs radiating from center
      mainGeometry = null;
      branchGeometries = [];

      const arcs = generateCrackleArcs(start);
      crackleGeometries = arcs.map(pathToGeometry);
    }
  }

  // Animation loop
  useTask((delta) => {
    if (!enabled) return;

    frameCount++;
    pulsePhase += delta * 3; // Pulse speed

    // Regenerate paths periodically for flickery effect
    if (frameCount % REGENERATE_INTERVAL === 0) {
      regeneratePaths();
    }
  });

  // Regenerate when inputs change
  $effect(() => {
    if (enabled) {
      // Access dependencies to track them
      const _ = [
        start.x,
        start.y,
        start.z,
        end?.x,
        end?.y,
        end?.z,
        mode,
        intensity,
      ];
      regeneratePaths();
    }
  });

  // Cleanup on destroy
  $effect(() => {
    return () => {
      disposeGeometry(mainGeometry);
      branchGeometries.forEach(disposeGeometry);
      crackleGeometries.forEach(disposeGeometry);
    };
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
  {#if mainGeometry}
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
  {#each branchGeometries as branchGeometry}
    <!-- Core -->
    <T.Line geometry={branchGeometry}>
      <T.LineBasicMaterial
        color="#ffffff"
        opacity={pulsedCoreOpacity * 0.7}
        transparent
        blending={AdditiveBlending}
        linewidth={1}
      />
    </T.Line>

    <!-- Glow -->
    <T.Line geometry={branchGeometry}>
      <T.LineBasicMaterial
        color={glowColor}
        opacity={pulsedGlowOpacity * 0.5}
        transparent
        blending={AdditiveBlending}
        linewidth={2}
      />
    </T.Line>
  {/each}

  <!-- Crackle arcs (crackle mode) -->
  {#each crackleGeometries as crackleGeometry}
    <!-- Core -->
    <T.Line geometry={crackleGeometry}>
      <T.LineBasicMaterial
        color="#ffffff"
        opacity={pulsedCoreOpacity * 0.9}
        transparent
        blending={AdditiveBlending}
        linewidth={1}
      />
    </T.Line>

    <!-- Glow -->
    <T.Line geometry={crackleGeometry}>
      <T.LineBasicMaterial
        color={glowColor}
        opacity={pulsedGlowOpacity * 0.7}
        transparent
        blending={AdditiveBlending}
        linewidth={2}
      />
    </T.Line>
  {/each}

  <!-- Optional: Point lights at arc endpoints for extra glow -->
  {#if intensity > 0.5}
    <T.PointLight
      position={[start.x, start.y, start.z]}
      color={glowColor}
      intensity={intensity * 0.5}
      distance={100}
      decay={2}
    />

    {#if mode === "arc" && end}
      <T.PointLight
        position={[end.x, end.y, end.z]}
        color={glowColor}
        intensity={intensity * 0.3}
        distance={80}
        decay={2}
      />
    {/if}
  {/if}
{/if}
