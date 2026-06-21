/**
 * CharcoalRenderer3D - GPU point sprite particle system for charcoal sparks.
 *
 * Pre-allocated particle pool with zero GC pressure. Sparks burst from prop
 * tips on high jerk (direction changes) and fall under gravity with drag.
 * Temperature decays over lifetime, driving the hot→cool color ramp.
 *
 * Quality tier adaptation:
 *   High:   5000 particles, ground bounce
 *   Medium: 2000 particles, no ground interaction
 *   Low:     500 particles, no ground interaction
 */

import type {
  Vector3,
  Object3D} from "three";
import {
  BufferGeometry,
  BufferAttribute,
  Points
} from "three";
import { createCharcoalMaterial, type CharcoalMaterialOptions } from "./charcoal-material-3d";
import { QualityTier } from "../types";
import type { Charcoal3DParams } from "$lib/shared/effects/translators/webgl3d-types";

/** Per-tier particle pool sizes */
const POOL_SIZE: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 5000,
  [QualityTier.MEDIUM]: 2000,
  [QualityTier.LOW]: 500,
};

/** Gravity in world units/s^2 - heavy pull, sparks drop fast */
const GRAVITY = 12.0;

/** Air drag coefficient (velocity multiplied by this each second) */
const DRAG = 0.85;

/** Ground plane Y coordinate for bounce */
const GROUND_Y = 0.0;

/** Coefficient of restitution for ground bounce */
const RESTITUTION = 0.2;

/** Jerk threshold (world units/s^3) above which a burst fires */
const BURST_JERK_THRESHOLD = 2.5;

/** Base sparks per burst - scaled up by jerk magnitude */
const BURST_BASE = 30;

/** Max sparks in a single burst */
const BURST_MAX = 80;

/** Ambient sparks per second during movement - light trickle */
const AMBIENT_RATE = 3;

/** Speed threshold below which ambient emission stops */
const AMBIENT_SPEED_THRESHOLD = 0.3;

/** Idle ember rate - coals glowing near the tip, barely moving */
const IDLE_RATE = 5;

// -- Burst sparks (plume on direction change) --
const BURST_LIFETIME_MIN = 0.4;
const BURST_LIFETIME_MAX = 1.5;
const BURST_SIZE_MIN = 0.04;
const BURST_SIZE_MAX = 0.12;
const BURST_VELOCITY_INHERITANCE = 0.3; // low - sparks don't follow the prop, they just fall
const BURST_PERTURB_MIN = 1.5;
const BURST_PERTURB_MAX = 4.0;
const BURST_SPREAD = Math.PI * 0.5; // wide plume

// -- Idle embers (coals clinging near tips) --
const IDLE_LIFETIME_MIN = 0.8;
const IDLE_LIFETIME_MAX = 2.5;
const IDLE_SIZE_MIN = 0.02;
const IDLE_SIZE_MAX = 0.05;
const IDLE_PERTURB_MIN = 0.05;
const IDLE_PERTURB_MAX = 0.2; // barely move - stay near the tip
const _IDLE_SPREAD = Math.PI * 0.15; // tight cluster

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

export interface CharcoalTipInput {
  position: Vector3;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
  jerk: number;
}

export class CharcoalRenderer3D {
  private particles: Particle[];
  private poolSize: number;
  private qualityTier: QualityTier;
  private points: Points | null = null;
  private geometry: BufferGeometry | null = null;
  private parent: Object3D | null = null;

  // Pre-allocated attribute arrays
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private temps: Float32Array;

  // Ambient emission accumulator (fractional sparks)
  private ambientAccumulator = 0;

  // Tunable scales from the curated FX panel (1.0 = renderer defaults). Mutated
  // in place by updateConfig; never reallocate the pool.
  private emitScale = 1.0; // intensity → spark count / rates
  private spreadScale = 1.0; // spread → plume width + ejection speed
  private lifeScale = 1.0; // glow → ember lifetime (longer = more glow on screen)

  constructor(qualityTier: QualityTier = QualityTier.HIGH) {
    this.qualityTier = qualityTier;
    this.poolSize = POOL_SIZE[qualityTier];

    // Pre-allocate particle pool
    this.particles = new Array(this.poolSize);
    for (let i = 0; i < this.poolSize; i++) {
      this.particles[i] = {
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 0,
        active: false,
      };
    }

    // Pre-allocate GPU attribute arrays
    this.positions = new Float32Array(this.poolSize * 3);
    this.sizes = new Float32Array(this.poolSize);
    this.alphas = new Float32Array(this.poolSize);
    this.temps = new Float32Array(this.poolSize);
  }

  initialize(parent: Object3D, materialOptions?: CharcoalMaterialOptions): void {
    if (this.points) return;
    this.parent = parent;

    this.geometry = new BufferGeometry();
    // Use BufferAttribute directly (not Float32BufferAttribute) to keep the
    // same array reference. Float32BufferAttribute copies the input array.
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3).setUsage(35048));
    this.geometry.setAttribute("particleSize", new BufferAttribute(this.sizes, 1).setUsage(35048));
    this.geometry.setAttribute("particleAlpha", new BufferAttribute(this.alphas, 1).setUsage(35048));
    this.geometry.setAttribute("particleTemp", new BufferAttribute(this.temps, 1).setUsage(35048));

    const material = createCharcoalMaterial(materialOptions);
    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 99;

    parent.add(this.points);
  }

  /**
   * Update particle physics and emit new sparks.
   *
   * @param tips - Active charcoal tip data (position, velocity, jerk)
   * @param dt - Delta time in seconds
   */
  update(tips: CharcoalTipInput[], dt: number): void {
    if (!this.geometry) return;

    // Clamp dt to avoid physics explosions on tab-switch
    const safeDt = Math.min(dt, 1 / 15);

    // Emit new sparks from tips
    for (const tip of tips) {
      // Burst emission on high jerk (direction reversals) - dramatic plume
      if (tip.jerk > BURST_JERK_THRESHOLD) {
        const intensity = Math.min(tip.jerk / BURST_JERK_THRESHOLD, 5);
        const count = Math.min(
          Math.floor(BURST_BASE * intensity * this.emitScale),
          Math.floor(BURST_MAX * this.emitScale),
        );
        this.emitBurst(tip, count);
      }

      // Idle embers: coals glowing near tips, barely perturbed
      // Ambient trickle during movement
      const rate = (tip.speed > AMBIENT_SPEED_THRESHOLD ? AMBIENT_RATE : IDLE_RATE) * this.emitScale;
      this.ambientAccumulator += rate * safeDt;
      while (this.ambientAccumulator >= 1) {
        this.emitIdle(tip);
        this.ambientAccumulator -= 1;
      }
    }

    // Update particle physics
    const enableGroundBounce = this.qualityTier === QualityTier.HIGH;
    let visibleCount = 0;

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;

      // Age
      p.life -= safeDt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Physics: gravity + drag
      p.vy -= GRAVITY * safeDt;
      const dragFactor = Math.pow(DRAG, safeDt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vz *= dragFactor;

      // Integrate position
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;

      // Ground bounce (High tier only)
      if (enableGroundBounce && p.y < GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = Math.abs(p.vy) * RESTITUTION;
        // Kill if bounce velocity is negligible
        if (Math.abs(p.vy) < 0.1) {
          p.vy = 0;
        }
      }

      // Temperature: decays linearly over lifetime
      const lifeRatio = p.life / p.maxLife;
      const temperature = lifeRatio;

      // Size: shrinks over lifetime
      const currentSize = p.size * (0.3 + 0.7 * lifeRatio);

      // Write to GPU attribute arrays
      const i3 = visibleCount * 3;
      this.positions[i3] = p.x;
      this.positions[i3 + 1] = p.y;
      this.positions[i3 + 2] = p.z;
      this.sizes[visibleCount] = currentSize;
      this.alphas[visibleCount] = Math.min(lifeRatio * 2, 1.0); // quick fade-in, gradual fade-out
      this.temps[visibleCount] = temperature;
      visibleCount++;
    }

    // Update GPU buffers
    const posAttr = this.geometry.getAttribute("position") as BufferAttribute;
    const sizeAttr = this.geometry.getAttribute("particleSize") as BufferAttribute;
    const alphaAttr = this.geometry.getAttribute("particleAlpha") as BufferAttribute;
    const tempAttr = this.geometry.getAttribute("particleTemp") as BufferAttribute;

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    tempAttr.needsUpdate = true;

    // Only draw visible particles
    this.geometry.setDrawRange(0, visibleCount);
  }

  /** Burst: dramatic plume on direction change. Sparks fly out and fall fast. */
  private emitBurst(tip: CharcoalTipInput, count: number): void {
    let emitted = 0;
    for (let i = 0; i < this.poolSize && emitted < count; i++) {
      const p = this.particles[i]!;
      if (p.active) continue;

      p.x = tip.position.x;
      p.y = tip.position.y;
      p.z = tip.position.z;

      // Low velocity inheritance - sparks don't follow the prop, they eject and fall
      const perturbSpeed =
        (BURST_PERTURB_MIN + Math.random() * (BURST_PERTURB_MAX - BURST_PERTURB_MIN)) * this.spreadScale;
      const spread = BURST_SPREAD * this.spreadScale;
      const angle = (Math.random() - 0.5) * 2 * spread;
      const elevation = (Math.random() - 0.5) * 2 * spread;

      p.vx = tip.velocityX * BURST_VELOCITY_INHERITANCE + Math.cos(angle) * Math.cos(elevation) * perturbSpeed;
      p.vy = tip.velocityY * BURST_VELOCITY_INHERITANCE + Math.sin(elevation) * perturbSpeed * 0.5 + 0.5;
      p.vz = tip.velocityZ * BURST_VELOCITY_INHERITANCE + Math.sin(angle) * Math.cos(elevation) * perturbSpeed;

      p.life = (BURST_LIFETIME_MIN + Math.random() * (BURST_LIFETIME_MAX - BURST_LIFETIME_MIN)) * this.lifeScale;
      p.maxLife = p.life;
      p.size = BURST_SIZE_MIN + Math.random() * (BURST_SIZE_MAX - BURST_SIZE_MIN);
      p.active = true;
      emitted++;
    }
  }

  /** Idle: embers clinging near the tip. Barely move, glow softly. */
  private emitIdle(tip: CharcoalTipInput): void {
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i]!;
      if (p.active) continue;

      p.x = tip.position.x + (Math.random() - 0.5) * 0.05;
      p.y = tip.position.y + (Math.random() - 0.5) * 0.05;
      p.z = tip.position.z + (Math.random() - 0.5) * 0.05;

      // Tiny velocity - embers drift and fall gently
      const perturbSpeed = IDLE_PERTURB_MIN + Math.random() * (IDLE_PERTURB_MAX - IDLE_PERTURB_MIN);
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * perturbSpeed;
      p.vy = perturbSpeed * 0.3; // slight upward drift before gravity takes over
      p.vz = Math.sin(angle) * perturbSpeed;

      p.life = (IDLE_LIFETIME_MIN + Math.random() * (IDLE_LIFETIME_MAX - IDLE_LIFETIME_MIN)) * this.lifeScale;
      p.maxLife = p.life;
      p.size = IDLE_SIZE_MIN + Math.random() * (IDLE_SIZE_MAX - IDLE_SIZE_MIN);
      p.active = true;
      return; // one at a time
    }
  }

  /**
   * Apply tuned params from the curated FX panel. intensity → spark count,
   * spread → plume width, glow → ember lifetime (longer-lived embers read as
   * more glow). Mutates scale fields the emit loop reads (no pool realloc).
   */
  updateConfig(params: Charcoal3DParams): void {
    this.emitScale = 0.4 + params.intensity * 1.6; // 0.4 .. 2.0
    this.spreadScale = 0.5 + params.spread; // 0.5 .. 1.5
    this.lifeScale = 0.5 + params.glow * 1.5; // 0.5 .. 2.0
  }

  reset(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.particles[i]!.active = false;
    }
    this.ambientAccumulator = 0;
    if (this.geometry) {
      this.geometry.setDrawRange(0, 0);
    }
  }

  dispose(): void {
    if (this.points) {
      this.parent?.remove(this.points);
      this.geometry?.dispose();
      if (Array.isArray(this.points.material)) {
        this.points.material.forEach((m) => m.dispose());
      } else {
        this.points.material.dispose();
      }
      this.points = null;
      this.geometry = null;
    }
    this.parent = null;
  }
}
