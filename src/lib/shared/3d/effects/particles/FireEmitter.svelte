<script lang="ts">
  /**
   * FireEmitter Component
   *
   * Emits fire/flame particles from a point in 3D space.
   * Uses InstancedMesh for GPU-efficient rendering of many particles.
   *
   * Visual style: Additive blending creates glow effect.
   * Particles rise with buoyancy, flicker with turbulence,
   * and color-shift from white-yellow-orange-red over lifetime.
   */

  import { T, useTask } from "@threlte/core";
  import {
    Vector3,
    Color,
    Object3D,
    InstancedMesh,
    PlaneGeometry,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    InstancedBufferAttribute,
  } from "three";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Emission point in world space */
    position: Vector3;
    /** Whether particles are actively spawning */
    enabled?: boolean;
    /** Intensity 0-1, affects spawn rate and size */
    intensity?: number;
    /** Scale multiplier for particle size (1 = small prop fire, 10+ = campfire) */
    scale?: number;
    /** Base direction for particles (default: up/+Y) */
    direction?: Vector3;
    /** How much prop velocity affects flame direction (0-1) */
    velocityInfluence?: number;
    /** Optional prop velocity for motion-reactive flames */
    propVelocity?: Vector3;
  }

  let {
    position,
    enabled = true,
    intensity = 1,
    scale = 1,
    direction = new Vector3(0, 1, 0),
    velocityInfluence = 0.3,
    propVelocity = new Vector3(0, 0, 0),
  }: Props = $props();

  // Particle pool configuration
  const MAX_PARTICLES = 200;
  const BASE_SPAWN_RATE = 40; // particles per second at intensity=1
  const MIN_LIFETIME = 0.3;
  const MAX_LIFETIME = 0.8;
  const BASE_SIZE = 8;
  const SIZE_VARIATION = 4;
  const BUOYANCY = 120; // Upward acceleration
  const INITIAL_VELOCITY = 80;
  const SPREAD_ANGLE = 0.4; // Radians of random spread
  const TURBULENCE_STRENGTH = 30;
  const TURBULENCE_FREQUENCY = 8;

  // Fire color gradient (sampled over particle lifetime 0-1)
  interface ColorStop {
    t: number;
    color: Color;
  }

  const FIRE_COLORS: ColorStop[] = [
    { t: 0.0, color: new Color(1.0, 1.0, 1.0) }, // White core
    { t: 0.15, color: new Color(1.0, 1.0, 0.6) }, // Yellow-white
    { t: 0.3, color: new Color(1.0, 0.8, 0.2) }, // Yellow
    { t: 0.5, color: new Color(1.0, 0.5, 0.1) }, // Orange
    { t: 0.7, color: new Color(0.9, 0.2, 0.05) }, // Red-orange
    { t: 0.85, color: new Color(0.4, 0.1, 0.05) }, // Dark red
    { t: 1.0, color: new Color(0.1, 0.05, 0.02) }, // Near black (smoke)
  ];

  // Particle data structure
  interface FireParticle {
    position: Vector3;
    velocity: Vector3;
    life: number; // Current life (0 = just born, 1 = dead)
    maxLife: number; // Total lifetime in seconds
    size: number; // Base size
    seed: number; // For turbulence variation
    active: boolean;
  }

  // Particle pool
  let particles: FireParticle[] = [];
  let spawnAccumulator = 0;
  let instancedMesh: InstancedMesh | null = null;
  const tempObject = new Object3D();
  const tempColor = new Color();

  // Instance attribute arrays
  let instanceColors: Float32Array;
  let instanceOpacities: Float32Array;
  let instanceSizes: Float32Array;
  let colorAttribute: InstancedBufferAttribute | null = null;
  let opacityAttribute: InstancedBufferAttribute | null = null;
  let sizeAttribute: InstancedBufferAttribute | null = null;

  // Shader material and geometry (use $state for reactivity in template)
  let shaderMaterial = $state<ShaderMaterial | null>(null);
  let geometry = $state<PlaneGeometry | null>(null);

  // Initialize particle pool
  function initializePool() {
    particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        position: new Vector3(),
        velocity: new Vector3(),
        life: 1,
        maxLife: 1,
        size: BASE_SIZE,
        seed: Math.random() * 1000,
        active: false,
      });
    }
  }

  // Find an inactive particle to reuse
  function getInactiveParticle(): FireParticle | null {
    for (const p of particles) {
      if (!p.active) return p;
    }
    return null;
  }

  // Spawn a new particle
  function spawnParticle() {
    const p = getInactiveParticle();
    if (!p) return;

    // Position at emission point
    p.position.copy(position);

    // Calculate initial velocity
    // Start with base direction
    const dir = direction.clone().normalize();

    // Add random spread
    const spreadX = (Math.random() - 0.5) * 2 * SPREAD_ANGLE;
    const spreadZ = (Math.random() - 0.5) * 2 * SPREAD_ANGLE;
    dir.x += spreadX;
    dir.z += spreadZ;
    dir.normalize();

    // Add prop velocity influence
    if (propVelocity.lengthSq() > 0.01) {
      dir.addScaledVector(propVelocity.clone().normalize(), velocityInfluence);
      dir.normalize();
    }

    // Set velocity with speed variation (scale affects velocity for larger fires)
    const speed =
      INITIAL_VELOCITY * scale * (0.8 + Math.random() * 0.4) * intensity;
    p.velocity.copy(dir).multiplyScalar(speed);

    // Add some of the prop velocity directly for motion-reactive flames
    if (propVelocity.lengthSq() > 0.01) {
      const velMagnitude = propVelocity.length();
      p.velocity.addScaledVector(
        propVelocity.clone().normalize(),
        velMagnitude * velocityInfluence * 0.5
      );
    }

    // Lifetime and size (scale directly affects particle size)
    p.life = 0;
    p.maxLife =
      MIN_LIFETIME +
      Math.random() * (MAX_LIFETIME - MIN_LIFETIME) * (1 + scale * 0.2);
    p.size =
      (BASE_SIZE + (Math.random() - 0.5) * SIZE_VARIATION * 2) *
      scale *
      (0.7 + intensity * 0.3);
    p.seed = Math.random() * 1000;
    p.active = true;
  }

  // Sample fire color gradient
  function sampleFireColor(t: number): Color {
    // Clamp t to [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));

    // Find the two colors to interpolate between
    for (let i = 0; i < FIRE_COLORS.length - 1; i++) {
      const current = FIRE_COLORS[i];
      const next = FIRE_COLORS[i + 1];

      if (current && next && clampedT >= current.t && clampedT <= next.t) {
        const localT = (clampedT - current.t) / (next.t - current.t);
        tempColor.copy(current.color);
        tempColor.lerp(next.color, localT);
        return tempColor;
      }
    }

    const lastColor = FIRE_COLORS[FIRE_COLORS.length - 1];
    return lastColor ? lastColor.color : tempColor;
  }

  // Calculate opacity based on lifetime
  function calculateOpacity(life: number): number {
    // Fade in quickly at start
    if (life < 0.1) {
      return life / 0.1;
    }
    // Fade out toward end
    if (life > 0.6) {
      return 1 - (life - 0.6) / 0.4;
    }
    return 1;
  }

  // Turbulence function (simple noise approximation)
  function turbulence(seed: number, time: number): Vector3 {
    const t = time * TURBULENCE_FREQUENCY + seed;
    return new Vector3(
      Math.sin(t * 1.3) * Math.cos(t * 0.7),
      Math.sin(t * 0.9) * 0.3,
      Math.cos(t * 1.1) * Math.sin(t * 0.8)
    ).multiplyScalar(TURBULENCE_STRENGTH);
  }

  // Custom shader for fire particles with color and opacity per instance
  const fireVertexShader = `
    attribute vec3 instanceColor;
    attribute float instanceOpacity;
    attribute float instanceSize;

    varying vec3 vColor;
    varying float vOpacity;
    varying vec2 vUv;

    void main() {
      vColor = instanceColor;
      vOpacity = instanceOpacity;
      vUv = uv;

      // Billboard: always face camera
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      mvPosition.xy += position.xy * instanceSize;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fireFragmentShader = `
    varying vec3 vColor;
    varying float vOpacity;
    varying vec2 vUv;

    void main() {
      // Radial gradient for soft fire particle
      vec2 center = vUv - 0.5;
      float dist = length(center) * 2.0;

      // Soft circular falloff
      float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
      alpha = pow(alpha, 1.5); // Sharper core

      // Add some noise-like variation based on position
      float noise = fract(sin(dot(vUv * 10.0, vec2(12.9898, 78.233))) * 43758.5453);
      alpha *= 0.85 + noise * 0.15;

      gl_FragColor = vec4(vColor, alpha * vOpacity);
    }
  `;

  onMount(() => {
    initializePool();

    // Create geometry for particle sprites (simple plane)
    const newGeometry = new PlaneGeometry(1, 1);

    // Create arrays for instance attributes
    instanceColors = new Float32Array(MAX_PARTICLES * 3);
    instanceOpacities = new Float32Array(MAX_PARTICLES);
    instanceSizes = new Float32Array(MAX_PARTICLES);

    // Initialize all particles as invisible
    for (let i = 0; i < MAX_PARTICLES; i++) {
      instanceOpacities[i] = 0;
      instanceSizes[i] = 0;
      instanceColors[i * 3] = 1;
      instanceColors[i * 3 + 1] = 1;
      instanceColors[i * 3 + 2] = 1;
    }

    // Create instance buffer attributes
    colorAttribute = new InstancedBufferAttribute(instanceColors, 3);
    opacityAttribute = new InstancedBufferAttribute(instanceOpacities, 1);
    sizeAttribute = new InstancedBufferAttribute(instanceSizes, 1);

    // Add attributes to geometry
    newGeometry.setAttribute("instanceColor", colorAttribute);
    newGeometry.setAttribute("instanceOpacity", opacityAttribute);
    newGeometry.setAttribute("instanceSize", sizeAttribute);

    // Create shader material
    const newMaterial = new ShaderMaterial({
      vertexShader: fireVertexShader,
      fragmentShader: fireFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });

    // Set state variables to trigger template update
    geometry = newGeometry;
    shaderMaterial = newMaterial;
  });

  onDestroy(() => {
    if (shaderMaterial) {
      shaderMaterial.dispose();
    }
    if (geometry) {
      geometry.dispose();
    }
  });

  // Track time for turbulence
  let elapsedTime = 0;

  // Update loop
  useTask((delta) => {
    if (
      !instancedMesh ||
      !colorAttribute ||
      !opacityAttribute ||
      !sizeAttribute
    )
      return;

    elapsedTime += delta;

    // Spawn new particles if enabled
    if (enabled && intensity > 0) {
      // Scale spawn rate with intensity and prop velocity
      let spawnRate = BASE_SPAWN_RATE * intensity;

      // Increase spawn rate with prop velocity
      const velMag = propVelocity.length();
      if (velMag > 10) {
        spawnRate *= 1 + Math.min(velMag / 100, 1.5);
      }

      spawnAccumulator += delta * spawnRate;

      while (spawnAccumulator >= 1) {
        spawnParticle();
        spawnAccumulator -= 1;
      }
    }

    // Update existing particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p) continue;

      if (!p.active) {
        // Hide inactive particles by setting scale to 0
        tempObject.position.set(0, 0, 0);
        tempObject.scale.set(0, 0, 0);
        tempObject.updateMatrix();
        instancedMesh.setMatrixAt(i, tempObject.matrix);
        instanceOpacities[i] = 0;
        instanceSizes[i] = 0;
        continue;
      }

      // Update life
      p.life += delta / p.maxLife;

      if (p.life >= 1) {
        p.active = false;
        tempObject.scale.set(0, 0, 0);
        tempObject.updateMatrix();
        instancedMesh.setMatrixAt(i, tempObject.matrix);
        instanceOpacities[i] = 0;
        instanceSizes[i] = 0;
        continue;
      }

      // Apply buoyancy (fire rises) - scaled for larger fires
      p.velocity.y += BUOYANCY * scale * delta;

      // Apply turbulence - scaled for larger fires
      const turb = turbulence(p.seed, elapsedTime);
      p.velocity.add(turb.clone().multiplyScalar(delta * scale));

      // Update position
      p.position.addScaledVector(p.velocity, delta);

      // Calculate size (shrink over lifetime)
      const sizeFactor = 1 - p.life * 0.6; // Shrink to 40% of original size
      const currentSize = p.size * sizeFactor;

      // Update instance matrix
      tempObject.position.copy(p.position);
      tempObject.scale.set(1, 1, 1); // Scale handled in shader via instanceSize
      tempObject.updateMatrix();
      instancedMesh.setMatrixAt(i, tempObject.matrix);

      // Update instance color
      const color = sampleFireColor(p.life);
      instanceColors[i * 3] = color.r;
      instanceColors[i * 3 + 1] = color.g;
      instanceColors[i * 3 + 2] = color.b;

      // Update instance opacity
      instanceOpacities[i] = calculateOpacity(p.life);

      // Update instance size (for shader)
      instanceSizes[i] = currentSize;
    }

    // Mark buffers as needing update
    instancedMesh.instanceMatrix.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    opacityAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
  });

  // Bind the instanced mesh reference
  function handleMeshCreated(mesh: InstancedMesh) {
    instancedMesh = mesh;
  }
</script>

{#if shaderMaterial && geometry}
  <T.InstancedMesh
    args={[geometry, shaderMaterial, MAX_PARTICLES]}
    frustumCulled={false}
    oncreate={handleMeshCreated}
  />
{/if}
