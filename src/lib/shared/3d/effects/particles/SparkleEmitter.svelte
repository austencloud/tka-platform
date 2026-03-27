<script lang="ts">
  /**
   * SparkleEmitter Component
   *
   * Creates sparkle/glitter effects around a position in 3D space.
   * Uses instanced sprites for reliable rendering in Threlte.
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
    /** Emission radius around position */
    spread?: number;
  }

  let {
    position,
    enabled = true,
    intensity = 1.0,
    color = "#ffffff",
    spread = 15,
  }: Props = $props();

  // Particle configuration
  const MAX_PARTICLES = 50;
  const BASE_SPAWN_RATE = 15;
  const GRAVITY = 30;

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

    // Random position within sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.random() * spread * 0.5; // Tighter spread

    const x = px + r * Math.sin(phi) * Math.cos(theta);
    const y = py + r * Math.sin(phi) * Math.sin(theta);
    const z = pz + r * Math.cos(phi);

    // Outward velocity
    const dx = x - px;
    const dy = y - py;
    const dz = z - pz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const speed = 20 + Math.random() * 30;

    return {
      id: nextId++,
      x,
      y,
      z,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed + 20, // Upward bias
      vz: (dz / len) * speed,
      life: 0,
      maxLife: 0.3 + Math.random() * 0.4,
      scale: 3 + Math.random() * 4,
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

    // Update particles
    const surviving: Particle[] = [];

    for (const p of particles) {
      p.life += delta / p.maxLife;
      if (p.life >= 1) continue;

      // Physics
      p.vy -= GRAVITY * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      // Fade out
      p.scale = (3 + Math.random() * 2) * (1 - p.life);

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
    scale={particle.scale}
  >
    <T.SphereGeometry args={[1, 8, 8]} />
    <T.MeshBasicMaterial
      color={colorValue}
      transparent
      opacity={0.8 * (1 - particle.life)}
    />
  </T.Mesh>
{/each}
