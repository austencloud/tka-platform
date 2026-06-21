/**
 * FireRenderer3D - Lagrangian (particle) fire at prop tips.
 *
 * Real fire on a moving prop is not a shape that chases the tip - it is a
 * medium that is *born at the wick and left behind*. Each particle spawns at
 * the tip's current position, inherits a fraction of the tip's velocity, then
 * rises under buoyancy, slows under drag, and swirls through a curl-noise field
 * while it ages. Because particles stay where they were born as the tip travels
 * on, the flame automatically streaks and curls along the path - motion
 * awareness is intrinsic to the model, not bolted on with a rotation. A hard
 * direction reversal leaves a dense knot of particles at the turnaround, so the
 * "poof" on a stall emerges for free from the physics.
 *
 * Pipeline reuse:
 *   - Zero-GC pre-allocated pool pattern from CharcoalRenderer3D.
 *   - Velocity-stretched instanced-billboard idiom from LedRenderer3D.
 *   - Divergence-free curl field from smoke/smoke-curl-field (SampledCurlGrid2D).
 *   - Blackbody presets from fire-color-curve-3d (getFireColors).
 *   - Point-sprite blackbody shader in fire-particle-material-3d.
 *
 * Coordinate space is rig-local world (the same space CharcoalRenderer3D and
 * the tip bridge use); particles are added to the parent passed to initialize().
 * The animation runs in the XY plane, so the curl field is sampled in XY.
 */

import type { Object3D } from "three";
import {
  Vector3,
  PlaneGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  PointLight,
  type ShaderMaterial,
} from "three";
import { getFireColors, type FireColorPreset } from "./fire-color-curve-3d";
import {
  createFireParticleMaterial,
  applyFireParticleColors,
  setFireEmissive,
  setFireColorBlend,
} from "./fire-particle-material-3d";
import { SampledCurlGrid2D } from "../smoke/smoke-curl-field";
import { QualityTier } from "../types";
import type { Fire3DParams } from "$lib/shared/effects/translators/webgl3d-types";

const MAX_FIRE_TIPS = 4;

/** Per-tier particle pool sizes (shared across all active tips). High density
 *  is what lets the soft faint blobs overlap into a continuous flame body. */
const POOL_SIZE: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 7000,
  [QualityTier.MEDIUM]: 3000,
  [QualityTier.LOW]: 1000,
};

/** Continuous emission at the wick (particles/sec per tip) - the idle candle. */
const EMIT_RATE: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 440,
  [QualityTier.MEDIUM]: 270,
  [QualityTier.LOW]: 120,
};

/**
 * World-units between path-distributed spawns. Under motion the tip sweeps a
 * segment each frame; spawning one particle per this much arc keeps the trail
 * gapless even at high spin instead of dotting it.
 */
const PATH_SPACING: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 0.022,
  [QualityTier.MEDIUM]: 0.04,
  [QualityTier.LOW]: 0.08,
};

/** Hard cap on spawns per tip per frame so a huge dt can't flood the pool. */
const MAX_SPAWN_PER_TIP = 90;

/** Fraction of tip velocity a new particle inherits (streaks along motion). */
const VELOCITY_INHERIT = 0.4;

/** Upward acceleration (world units/s^2). Fire rises. */
const BUOYANCY = 2.7;

/** Initial upward kick at birth so even the idle flame lifts off the wick. */
const BUOYANCY_SEED = 0.65;

/**
 * Air-drag multiplier applied per second. Aggressive: the inherited tangential
 * velocity bleeds off within a couple hundred ms, so buoyancy curls the trail
 * upward instead of letting it fly straight - the signature flame whip.
 */
const DRAG = 0.1;

/** Curl-noise turbulence strength (world units/s of swirl velocity). */
const CURL_STRENGTH = 1.5;

/** Spatial frequency multiplier feeding the curl field (higher = finer licks). */
const CURL_SCALE = 1.7;

/** Random isotropic velocity spread at birth. */
const SPREAD = 0.45;

/** Random positional jitter around the spawn point (tight core at the wick). */
const CORE_JITTER = 0.025;

// Short lifetimes keep the flame a tight hot core instead of a long-lived
// haze. The cool tail particles are what drift up and read as smoke/fog, so we
// cap max life low and let the shader fade + cool them out well before death.
const LIFE_MIN = 0.28;
const LIFE_MAX = 0.55;
const SIZE_MIN = 0.06;
const SIZE_MAX = 0.17;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxLife: number;
  size: number;
  seed: number;
  // Prop color this particle inherits at birth (0-1). Drives the Color-slider
  // tint in the shader; constant for the particle's life.
  pr: number;
  pg: number;
  pb: number;
  active: boolean;
}

export interface FireTipInput {
  position: Vector3;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
  /** Optional jerk magnitude (units/s^2). Boosts the dynamic light on stalls. */
  jerk?: number;
  /** Prop color (0-1 RGB) for the Color-slider tint. Defaults to white if omitted. */
  propColor?: { r: number; g: number; b: number };
}

export interface FireRendererOptions {
  preset?: FireColorPreset;
}

export class FireRenderer3D {
  private particles: Particle[];
  private poolSize: number;
  private qualityTier: QualityTier;
  private preset: FireColorPreset;

  // Tunable params (seeded from the per-tier constants; overwritten by
  // updateConfig as the user drags the curated sliders). Mutated in place so a
  // live tune never reallocates the particle pool.
  private emitRate: number;
  private curlStrength = CURL_STRENGTH;
  private emissiveHot = 0.53;
  // Intensity also scales particle SIZE so the slider visibly changes the
  // flame's VOLUME (small contained flame ↔ big fire), distinct from
  // brightness which only changes the per-particle glow.
  private sizeScale = 1.0;

  private mesh: InstancedMesh | null = null;
  private material: ShaderMaterial | null = null;
  private parent: Object3D | null = null;

  // Pre-allocated per-instance attribute arrays (packed front-dense each frame).
  private centers: Float32Array;
  private vels: Float32Array;
  private lives: Float32Array;
  private seeds: Float32Array;
  private instSizes: Float32Array;
  private propColors: Float32Array;

  // Divergence-free turbulence field, baked + bilinear-sampled.
  private curl = new SampledCurlGrid2D(64, 8, 1 / 4);

  private lights: PointLight[] = [];
  private lightEnabled: boolean;

  private time = 0;

  // Per-tip emission state (continuous accumulator + last tip position for the
  // path-distributed spawn sweep).
  private emitAccumulator: number[] = [];
  private prevTipPos: Vector3[] = [];
  private prevTipValid: boolean[] = [];

  constructor(qualityTier: QualityTier = QualityTier.HIGH, options?: FireRendererOptions) {
    this.qualityTier = qualityTier;
    this.preset = options?.preset ?? "classic";
    this.poolSize = POOL_SIZE[qualityTier];
    this.emitRate = EMIT_RATE[qualityTier];
    this.lightEnabled = qualityTier !== QualityTier.LOW;

    this.particles = new Array(this.poolSize);
    for (let i = 0; i < this.poolSize; i++) {
      this.particles[i] = {
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        age: 0, maxLife: 1, size: 0, seed: 0,
        pr: 1, pg: 1, pb: 1,
        active: false,
      };
    }

    this.centers = new Float32Array(this.poolSize * 3);
    this.vels = new Float32Array(this.poolSize * 3);
    this.lives = new Float32Array(this.poolSize);
    this.seeds = new Float32Array(this.poolSize);
    this.instSizes = new Float32Array(this.poolSize);
    this.propColors = new Float32Array(this.poolSize * 3);

    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      this.emitAccumulator.push(0);
      this.prevTipPos.push(new Vector3());
      this.prevTipValid.push(false);
    }
  }

  initialize(parent: Object3D): void {
    if (this.mesh) return;
    this.parent = parent;

    // Unit quad; the vertex shader billboards + stretches it per instance.
    const geometry = new PlaneGeometry(1, 1);
    // DYNAMIC_DRAW (35048): we rewrite these arrays every frame.
    geometry.setAttribute("aCenter", new InstancedBufferAttribute(this.centers, 3).setUsage(35048));
    geometry.setAttribute("aVel", new InstancedBufferAttribute(this.vels, 3).setUsage(35048));
    geometry.setAttribute("aLife", new InstancedBufferAttribute(this.lives, 1).setUsage(35048));
    geometry.setAttribute("aSeed", new InstancedBufferAttribute(this.seeds, 1).setUsage(35048));
    geometry.setAttribute("aSize", new InstancedBufferAttribute(this.instSizes, 1).setUsage(35048));
    geometry.setAttribute("aPropColor", new InstancedBufferAttribute(this.propColors, 3).setUsage(35048));

    this.material = createFireParticleMaterial({
      colors: getFireColors(this.preset),
      emissiveHot: this.emissiveHot,
    });
    this.mesh = new InstancedMesh(geometry, this.material, this.poolSize);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
    this.mesh.count = 0;
    parent.add(this.mesh);

    if (this.lightEnabled) {
      for (let i = 0; i < MAX_FIRE_TIPS; i++) {
        const light = new PointLight(0xff7a22, 0, 3.2, 2.0);
        light.visible = false;
        parent.add(light);
        this.lights.push(light);
      }
    }
  }

  update(tips: FireTipInput[], dt: number): void {
    if (!this.mesh || !this.material) return;

    const safeDt = Math.min(dt, 1 / 15);
    this.time += safeDt;
    this.material.uniforms.uTime!.value = this.time;

    // -- Emit from each active tip --
    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      if (i >= tips.length) {
        this.prevTipValid[i] = false;
        continue;
      }
      this.emitFromTip(i, tips[i]!, safeDt);
    }

    // -- Advance physics + pack the GPU buffers --
    let visibleCount = 0;

    for (const p of this.particles) {
      if (!p.active) continue;

      p.age += safeDt;
      if (p.age >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Buoyancy lifts; drag bleeds the inherited horizontal velocity so the
      // tongue curls upward.
      p.vy += BUOYANCY * safeDt;
      const dragFactor = Math.pow(DRAG, safeDt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vz *= dragFactor;

      // Curl-noise swirl in the XY plane (divergence-free => no clumping).
      const swirl = this.curl.sample(p.x * CURL_SCALE, p.y * CURL_SCALE, this.time);
      p.vx += swirl.vx * this.curlStrength * safeDt;
      p.vy += swirl.vy * this.curlStrength * safeDt;

      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;

      const i3 = visibleCount * 3;
      this.centers[i3] = p.x;
      this.centers[i3 + 1] = p.y;
      this.centers[i3 + 2] = p.z;
      this.vels[i3] = p.vx;
      this.vels[i3 + 1] = p.vy;
      this.vels[i3 + 2] = p.vz;
      this.lives[visibleCount] = p.age / p.maxLife;
      this.seeds[visibleCount] = p.seed;
      this.instSizes[visibleCount] = p.size;
      this.propColors[i3] = p.pr;
      this.propColors[i3 + 1] = p.pg;
      this.propColors[i3 + 2] = p.pb;
      visibleCount++;
    }

    const geo = this.mesh.geometry;
    (geo.getAttribute("aCenter") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("aVel") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("aLife") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("aSeed") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("aSize") as InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute("aPropColor") as InstancedBufferAttribute).needsUpdate = true;
    this.mesh.count = visibleCount;

    // -- Dynamic lights track the tips --
    if (this.lightEnabled) {
      for (let i = 0; i < this.lights.length; i++) {
        const light = this.lights[i]!;
        if (i < tips.length) {
          const tip = tips[i]!;
          light.position.set(tip.position.x, tip.position.y + 0.25, tip.position.z);
          const jerkBoost = Math.min((tip.jerk ?? 0) / 60, 1) * 1.2;
          let intensity = 1.5 + Math.min(tip.speed * 0.3, 1.5) + jerkBoost;
          if (this.qualityTier === QualityTier.HIGH) {
            intensity +=
              Math.sin(this.time * 8.3 + i * 2.1) * 0.18 +
              Math.sin(this.time * 13.7 + i * 5.3) * 0.12 +
              Math.sin(this.time * 23.1 + i * 1.7) * 0.06;
          }
          light.intensity = Math.max(intensity, 0.5);
          light.visible = true;
        } else {
          light.visible = false;
        }
      }
    }
  }

  /** Spawn particles for one tip: continuous at the wick + along the path. */
  private emitFromTip(i: number, tip: FireTipInput, safeDt: number): void {
    const prev = this.prevTipPos[i]!;
    const cur = tip.position;

    let segLen = 0;
    if (this.prevTipValid[i]) {
      segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
    }

    // Combined demand: idle stream (time-rate) + gapless path coverage.
    this.emitAccumulator[i]! +=
      this.emitRate * safeDt + segLen / PATH_SPACING[this.qualityTier];
    let count = Math.floor(this.emitAccumulator[i]!);
    if (count > MAX_SPAWN_PER_TIP) count = MAX_SPAWN_PER_TIP;
    this.emitAccumulator[i]! -= count;

    for (let k = 0; k < count; k++) {
      const particle = this.nextSlot();

      // Distribute along the swept segment (at rest segLen ~ 0 => all at tip).
      const t = count > 1 ? k / (count - 1) : 1;
      const px = prev.x + (cur.x - prev.x) * t;
      const py = prev.y + (cur.y - prev.y) * t;
      const pz = prev.z + (cur.z - prev.z) * t;

      particle.x = px + (Math.random() - 0.5) * CORE_JITTER;
      particle.y = py + (Math.random() - 0.5) * CORE_JITTER;
      particle.z = pz + (Math.random() - 0.5) * CORE_JITTER;

      particle.vx = tip.velocityX * VELOCITY_INHERIT + (Math.random() - 0.5) * SPREAD;
      particle.vy =
        tip.velocityY * VELOCITY_INHERIT + BUOYANCY_SEED + (Math.random() - 0.5) * SPREAD;
      particle.vz = tip.velocityZ * VELOCITY_INHERIT + (Math.random() - 0.5) * SPREAD;

      // Bias toward short-lived hot core particles; a tail rides longer into smoke.
      const r = Math.random();
      particle.maxLife = LIFE_MIN + r * r * (LIFE_MAX - LIFE_MIN);
      particle.age = 0;
      // sizeScale (from intensity) sets the flame VOLUME; brightness is separate.
      particle.size = (SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN)) * this.sizeScale;
      particle.seed = Math.random();
      const pc = tip.propColor;
      particle.pr = pc ? pc.r : 1;
      particle.pg = pc ? pc.g : 1;
      particle.pb = pc ? pc.b : 1;
      particle.active = true;
    }

    prev.copy(cur);
    this.prevTipValid[i] = true;
  }

  /**
   * Ring-buffer slot allocation. Particles spawn and die in roughly FIFO order,
   * so the slot at the cursor is almost always already dead. When the pool is
   * under pressure this overwrites the oldest particle, which for fire is the
   * correct recycle (the coolest, faintest wisp) and keeps the body gapless.
   */
  private cursor = 0;
  private nextSlot(): Particle {
    const p = this.particles[this.cursor]!;
    this.cursor++;
    if (this.cursor >= this.poolSize) this.cursor = 0;
    return p;
  }

  /**
   * Apply tuned params from the curated FX panel. Mutates instance fields the
   * physics loop reads each frame (no pool realloc) plus the material uniforms.
   *
   *   intensity  → emission rate AND particle size (the flame's VOLUME — how
   *                much / how big the fire is). Distinct from brightness.
   *   brightness → emissiveHot, the per-particle HDR glow / bloom lever (how
   *                HOT each particle reads). Set on the material.
   *   turbulence → curl swirl strength.
   *   colorBlend → Color slider; tints the natural fire hue toward the prop
   *                color in the shader (0 = pure fire, 1 = strongly prop-colored).
   */
  updateConfig(params: Fire3DParams): void {
    this.emitRate = EMIT_RATE[this.qualityTier] * (0.1 + params.intensity * 1.3);
    this.sizeScale = 0.55 + params.intensity * 0.9;
    this.curlStrength = CURL_STRENGTH * (0.4 + params.turbulence * 1.6);
    this.emissiveHot = params.emissiveHot;
    if (this.material) {
      setFireEmissive(this.material, this.emissiveHot);
      setFireColorBlend(this.material, params.colorBlend);
    }
  }

  setPreset(preset: FireColorPreset): void {
    this.preset = preset;
    if (this.material) {
      applyFireParticleColors(this.material, getFireColors(preset));
    }
  }

  reset(): void {
    for (const p of this.particles) {
      p.active = false;
    }
    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      this.emitAccumulator[i] = 0;
      this.prevTipValid[i] = false;
    }
    for (const light of this.lights) {
      light.visible = false;
    }
    if (this.mesh) {
      this.mesh.count = 0;
    }
    this.time = 0;
  }

  dispose(): void {
    if (this.mesh) {
      this.parent?.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.material?.dispose();
      this.mesh = null;
      this.material = null;
    }
    for (const light of this.lights) {
      this.parent?.remove(light);
      light.dispose();
    }
    this.lights = [];
    this.parent = null;
  }
}
