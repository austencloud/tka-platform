<script lang="ts">
  /**
   * SparkleEmitter Component
   *
   * Glints of light thrown off a prop tip, in world space.
   *
   * EVERY length and speed here is METRES and metres/second. One world unit is
   * one metre and a staff is 0.864 of them, so a "15" is not a nudge — it is
   * seventeen staves. This component was originally ported from a 2D canvas
   * emitter with its pixel constants intact (spread 15, gravity 30, unit
   * spheres at scale 3-7) and drew sparkles up to 7 METRES across; a single one
   * filled the viewport. Sizes now come from resolveSparkles3D, which owns the
   * pixel→world conversion. Do not reintroduce a bare number here.
   */

  import { T, useTask } from "@threlte/core";
  import { Vector3 } from "three";

  interface Props {
    /** Emission center position */
    position: Vector3;
    /** Whether particles are emitting */
    enabled?: boolean;
    /** Emission intensity multiplier */
    intensity?: number;
    /** Base color for sparkles */
    color?: string;
    /** Emission radius around the position, WORLD UNITS (metres). */
    spread?: number;
    /** Sparkle radius, WORLD UNITS. From Sparkles3DParams.baseRadius. */
    radius?: number;
    /** Gravity in world units/s² (negative rises). From worldGravity. */
    gravity?: number;
    /** Particle life in seconds. */
    lifetime?: number;
  }

  let {
    position,
    enabled = true,
    intensity = 1.0,
    color = "#ffffff",
    spread = 0.06,
    radius = 0.03,
    gravity = 1.4,
    lifetime = 1.2,
  }: Props = $props();

  // Particle configuration
  const MAX_PARTICLES = 50;
  const BASE_SPAWN_RATE = 15;

  // Particle data stored as plain objects for Svelte reactivity
  interface Particle {
    id: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    scale: number;
  }

  let particles = $state<Particle[]>([]);
  let spawnAccumulator = 0;
  let nextId = 0;

  function spawnParticle(): Particle {
    // Extract position values (handles Svelte Proxy)
    const px = position.x;
    const py = position.y;
    const pz = position.z;

    // Random position within the emission sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.random() * spread;

    const x = px + r * Math.sin(phi) * Math.cos(theta);
    const y = py + r * Math.sin(phi) * Math.sin(theta);
    const z = pz + r * Math.cos(phi);

    // Outward velocity, scaled to the spread so a sparkle drifts roughly one
    // to two spread-radii over its life rather than a fixed metres-per-second.
    const dx = x - px;
    const dy = y - py;
    const dz = z - pz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const speed = (spread / lifetime) * (1 + Math.random());

    return {
      id: nextId++,
      x,
      y,
      z,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed + speed * 0.5, // Upward bias
      vz: (dz / len) * speed,
      life: 0,
      maxLife: lifetime * (0.6 + Math.random() * 0.8),
      scale: radius * (0.6 + Math.random() * 0.8),
    };
  }

  useTask((delta) => {
    // Spawn particles
    if (enabled && particles.length < MAX_PARTICLES) {
      spawnAccumulator += delta * BASE_SPAWN_RATE * intensity;
      while (spawnAccumulator >= 1 && particles.length < MAX_PARTICLES) {
        particles.push(spawnParticle());
        spawnAccumulator -= 1;
      }
    }

    const surviving: Particle[] = [];

    for (const p of particles) {
      p.life += delta / p.maxLife;
      if (p.life >= 1) continue;

      // Physics. worldGravity is positive-down, matching the translator.
      p.vy -= gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      // The taper is applied at render time from p.scale, which is the
      // particle's spawn size. Re-rolling Math.random() into p.scale every
      // frame (as this did) makes each sparkle jitter in size at frame rate.
      surviving.push(p);
    }

    particles = surviving;
  });

  // Convert hex color to RGB for emissive
  const colorValue = $derived(color);
</script>

<!-- Render each particle as a small glowing sphere -->
{#each particles as particle (particle.id)}
  <T.Mesh
    position.x={particle.x}
    position.y={particle.y}
    position.z={particle.z}
    scale={particle.scale * (1 - particle.life)}
  >
    <T.SphereGeometry args={[1, 8, 8]} />
    <T.MeshBasicMaterial
      color={colorValue}
      transparent
      opacity={0.8 * (1 - particle.life)}
    />
  </T.Mesh>
{/each}
