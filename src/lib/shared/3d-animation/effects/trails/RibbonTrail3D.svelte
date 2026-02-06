<script lang="ts">
  /**
   * RibbonTrail3D - Physics-based ribbon trail for 3D viewer
   *
   * Uses Verlet integration for realistic cloth-like physics.
   * The ribbon follows the prop end with:
   * - Gravity
   * - Momentum transfer from prop movement
   * - Air drag
   * - Smooth curving
   */

  import { T, useTask } from "@threlte/core";
  import {
    Vector3,
    Color,
    BufferGeometry,
    Float32BufferAttribute,
    MeshBasicMaterial,
    DoubleSide,
  } from "three";

  interface Props {
    /** Current position to attach ribbon to (prop end) */
    attachPoint: Vector3;
    /** Color of the ribbon */
    color: string;
    /** Number of segments in the ribbon */
    segments?: number;
    /** Length of each segment */
    segmentLength?: number;
    /** Width of the ribbon */
    width?: number;
    /** Gravity strength */
    gravity?: number;
    /** Air drag (0-1, higher = more drag) */
    drag?: number;
    /** How much prop velocity influences ribbon */
    velocityInfluence?: number;
    /** Base opacity */
    opacity?: number;
    /** Whether to use rainbow coloring */
    rainbow?: boolean;
    /** Whether physics is enabled */
    enabled?: boolean;
  }

  let {
    attachPoint,
    color = "#ffffff",
    segments = 12,
    segmentLength = 8,
    width = 3,
    gravity = 50,
    drag = 0.03,
    velocityInfluence = 0.8,
    opacity = 0.85,
    rainbow = false,
    enabled = true,
  }: Props = $props();

  // Physics state - using Verlet integration
  // Each particle has current position and previous position
  let particles = $state<Vector3[]>([]);
  let prevParticles = $state<Vector3[]>([]);
  let initialized = $state(false);

  // Track previous attach point for velocity calculation
  let prevAttachPoint = $state<Vector3 | null>(null);
  let attachVelocity = $state(new Vector3());

  // Initialize particles when enabled or segments change
  $effect(() => {
    if (!enabled) {
      initialized = false;
      particles = [];
      prevParticles = [];
      return;
    }

    if (!initialized || particles.length !== segments) {
      initializeParticles();
    }
  });

  function initializeParticles() {
    const newParticles: Vector3[] = [];
    const newPrevParticles: Vector3[] = [];

    for (let i = 0; i < segments; i++) {
      // Start particles in a line below the attach point
      const pos = attachPoint.clone();
      pos.y -= i * segmentLength;
      newParticles.push(pos);
      newPrevParticles.push(pos.clone());
    }

    particles = newParticles;
    prevParticles = newPrevParticles;
    initialized = true;
  }

  // Physics simulation runs every frame
  useTask((delta) => {
    if (!enabled || !initialized || particles.length === 0) return;

    const dt = Math.min(delta, 0.033); // Cap delta to avoid explosion
    const dtSq = dt * dt;

    // Calculate attach point velocity
    if (prevAttachPoint) {
      attachVelocity.copy(attachPoint).sub(prevAttachPoint).divideScalar(dt);
    }
    prevAttachPoint = attachPoint.clone();

    // Verlet integration for each particle (except first which is attached)
    const newParticles = particles.map((p) => p.clone());
    const newPrevParticles = prevParticles.map((p) => p.clone());

    for (let i = 0; i < segments; i++) {
      if (i === 0) {
        // First particle is locked to attach point
        newParticles[i]!.copy(attachPoint);
        newPrevParticles[i]!.copy(attachPoint);
        continue;
      }

      const current = newParticles[i]!;
      const prev = newPrevParticles[i]!;

      // Calculate velocity from Verlet (current - previous position)
      const velocity = current.clone().sub(prev);

      // Apply drag
      velocity.multiplyScalar(1 - drag);

      // Transfer some velocity from attach point (momentum)
      if (i <= 3) {
        // Only first few segments get strong influence
        const influence = velocityInfluence * (1 - i / 4);
        velocity.add(attachVelocity.clone().multiplyScalar(influence * dt));
      }

      // Apply gravity
      const gravityVec = new Vector3(0, -gravity * dtSq, 0);

      // Update previous position
      newPrevParticles[i]!.copy(current);

      // Verlet integration: new_pos = current + velocity + acceleration
      current.add(velocity).add(gravityVec);
    }

    // Constraint satisfaction - maintain segment lengths
    // Run multiple iterations for stability
    for (let iteration = 0; iteration < 3; iteration++) {
      for (let i = 0; i < segments - 1; i++) {
        const p1 = newParticles[i]!;
        const p2 = newParticles[i + 1]!;

        const diff = p2.clone().sub(p1);
        const currentLength = diff.length();

        if (currentLength === 0) continue;

        const correction = diff
          .normalize()
          .multiplyScalar(currentLength - segmentLength);

        if (i === 0) {
          // First particle is fixed, only move second
          p2.sub(correction);
        } else {
          // Share correction between both particles
          p1.add(correction.clone().multiplyScalar(0.5));
          p2.sub(correction.multiplyScalar(0.5));
        }
      }
    }

    particles = newParticles;
    prevParticles = newPrevParticles;
  });

  // Build ribbon geometry from particles
  const geometry = $derived.by((): BufferGeometry | null => {
    if (!initialized || particles.length < 2) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Calculate tangent at each particle for ribbon width direction
    for (let i = 0; i < particles.length; i++) {
      const curr = particles[i]!;

      // Calculate tangent (direction along ribbon)
      let tangent: Vector3;
      if (i === 0) {
        tangent = particles[1]!.clone().sub(curr).normalize();
      } else if (i === particles.length - 1) {
        tangent = curr
          .clone()
          .sub(particles[i - 1]!)
          .normalize();
      } else {
        tangent = particles[i + 1]!.clone()
          .sub(particles[i - 1]!)
          .normalize();
      }

      // Calculate normal perpendicular to tangent
      // Use world up as reference, then cross product
      const worldUp = new Vector3(0, 1, 0);
      let normal = new Vector3().crossVectors(tangent, worldUp).normalize();

      // If tangent is parallel to up, use different reference
      if (normal.lengthSq() < 0.001) {
        normal = new Vector3()
          .crossVectors(tangent, new Vector3(1, 0, 0))
          .normalize();
      }

      // Scale by width (taper toward end)
      const taper = 1 - (i / (particles.length - 1)) * 0.5;
      const halfWidth = (width / 2) * taper;

      // Two vertices per particle (left and right edge of ribbon)
      const left = curr.clone().add(normal.clone().multiplyScalar(-halfWidth));
      const right = curr.clone().add(normal.clone().multiplyScalar(halfWidth));

      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);

      // Colors - rainbow or solid with fade
      const t = i / (particles.length - 1);
      let c: Color;

      if (rainbow) {
        c = new Color();
        c.setHSL(t * 0.8, 0.9, 0.6);
      } else {
        try {
          c = new Color(color);
        } catch {
          c = new Color(0xffffff);
        }
      }

      // Fade toward end
      const fade = 1 - t * 0.7;
      colors.push(c.r * fade, c.g * fade, c.b * fade);
      colors.push(c.r * fade, c.g * fade, c.b * fade);
    }

    // Build triangle strip indices
    for (let i = 0; i < particles.length - 1; i++) {
      const base = i * 2;
      // Two triangles per segment
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  });

  const material = $derived(
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      side: DoubleSide,
      depthWrite: false,
    })
  );
</script>

{#if enabled && geometry}
  <T.Mesh {geometry} {material} />
{/if}
