/**
 * LedRenderer3D — Instanced billboard LED renderer with trail accumulation.
 *
 * Renders all LED points across both props in a single instanced draw call.
 * Each LED is a camera-facing quad with a core+halo shader (LedMaterial3D).
 *
 * Trail accumulation: each LED maintains a short ring buffer of recent
 * positions. These trail ghosts are rendered as additional instances with
 * decaying alpha, creating the "light painting" persistence-of-vision effect.
 *
 * Quality tier adaptation:
 *   - High: full trail length (32 frames), dynamic point lights
 *   - Medium: shorter trails (16 frames), dynamic lights, no shadows
 *   - Low: no trails, no dynamic lights (emissive only)
 */

import {
  Vector3,
  PlaneGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  Quaternion,
  Object3D,
  type Camera,
} from "three";
import { createLedMaterial, type LedMaterialOptions } from "./LedMaterial3D";
import { QualityTier } from "../types";

/** Maximum LED points per prop (matches 2D system's MAX_TOTAL_TIPS / 2) */
const MAX_LEDS_PER_PROP = 16;

/** Maximum total LED instances (active + trail ghosts) */
const MAX_INSTANCES = 1024;

/** LED sprite size in world units — large enough to read as glowing orbs */
const LED_SPRITE_SIZE = 0.35;

/** Ring buffer capacity per quality tier. Sized to hold at least
 *  TRAIL_FADE_DURATION seconds of trail at up to 120fps. The actual
 *  visible trail length is controlled by time-based eviction in
 *  getOrdered(), not by capacity. */
const TRAIL_LENGTH: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 128,
  [QualityTier.MEDIUM]: 64,
  [QualityTier.LOW]: 0,
};

/** Per-LED position in the trail ring buffer */
interface LedTrailEntry {
  position: Vector3;
  timestamp: number;
  r: number;
  g: number;
  b: number;
}

/** Ring buffer for a single LED's trail history */
class LedTrailRing {
  private buffer: LedTrailEntry[];
  private head = 0;
  private _count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.buffer[i] = {
        position: new Vector3(),
        timestamp: 0,
        r: 1,
        g: 1,
        b: 1,
      };
    }
  }

  get count(): number {
    return this._count;
  }

  push(position: Vector3, timestamp: number, r: number, g: number, b: number): void {
    const entry = this.buffer[this.head]!;
    entry.position.copy(position);
    entry.timestamp = timestamp;
    entry.r = r;
    entry.g = g;
    entry.b = b;
    this.head = (this.head + 1) % this.capacity;
    if (this._count < this.capacity) this._count++;
  }

  /** Get trail entries oldest-first, excluding entries older than maxAge seconds */
  getOrdered(currentTime: number, maxAge: number): LedTrailEntry[] {
    if (this._count === 0) return [];
    const result: LedTrailEntry[] = [];
    const start = this._count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      const entry = this.buffer[idx]!;
      if (currentTime - entry.timestamp <= maxAge) {
        result.push(entry);
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this._count = 0;
  }
}

export interface LedTipInput {
  position: Vector3;
  r: number;
  g: number;
  b: number;
  brightness: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
}

export class LedRenderer3D {
  private mesh: InstancedMesh | null = null;
  private instanceColors: Float32Array;
  private instanceAlphas: Float32Array;
  private instanceStretches: Float32Array;
  private dummy = new Object3D();
  private trails: Map<string, LedTrailRing> = new Map();
  private qualityTier: QualityTier;
  private trailLength: number;
  private parent: Object3D | null = null;

  /** Maximum velocity elongation factor */
  private static readonly MAX_STRETCH = 1.5;
  /** Speed threshold where stretch begins (world units/sec) */
  private static readonly STRETCH_SPEED_MIN = 0.5;
  /** Speed at which stretch reaches MAX_STRETCH */
  private static readonly STRETCH_SPEED_MAX = 5.0;

  /** Trail fade duration in seconds */
  private static readonly TRAIL_FADE_DURATION = 1.0;

  constructor(qualityTier: QualityTier = QualityTier.HIGH) {
    this.qualityTier = qualityTier;
    this.trailLength = TRAIL_LENGTH[qualityTier];
    this.instanceColors = new Float32Array(MAX_INSTANCES * 3);
    this.instanceAlphas = new Float32Array(MAX_INSTANCES);
    this.instanceStretches = new Float32Array(MAX_INSTANCES * 2);
  }

  initialize(parent: Object3D, materialOptions?: LedMaterialOptions): void {
    if (this.mesh) return;
    this.parent = parent;

    const geometry = new PlaneGeometry(LED_SPRITE_SIZE, LED_SPRITE_SIZE);
    const material = createLedMaterial(materialOptions);

    this.mesh = new InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.frustumCulled = false;

    // Set up instanced attributes
    const colorAttr = new InstancedBufferAttribute(this.instanceColors, 3);
    colorAttr.setUsage(35048); // DynamicDrawUsage
    geometry.setAttribute("instanceColor", colorAttr);

    const alphaAttr = new InstancedBufferAttribute(this.instanceAlphas, 1);
    alphaAttr.setUsage(35048);
    geometry.setAttribute("instanceAlpha", alphaAttr);

    const stretchAttr = new InstancedBufferAttribute(this.instanceStretches, 2);
    stretchAttr.setUsage(35048);
    geometry.setAttribute("instanceStretch", stretchAttr);

    // Start with 0 visible instances
    this.mesh.count = 0;
    this.mesh.renderOrder = 100; // Render after scene geometry

    parent.add(this.mesh);
  }

  /**
   * Update all LED instances for the current frame.
   *
   * @param tips - Active LED tip data for this frame
   * @param camera - Current camera (for billboard orientation)
   * @param currentTime - Current time in seconds
   */
  update(tips: LedTipInput[], camera: Camera, currentTime: number): void {
    if (!this.mesh) return;

    let instanceIndex = 0;

    // Billboard orientation: face the camera
    const cameraQuat = camera.quaternion;

    for (let t = 0; t < tips.length && instanceIndex < MAX_INSTANCES; t++) {
      const tip = tips[t]!;

      // Compute velocity-based stretch
      const speed = tip.speed;
      let stretchFactor = 1.0;
      let stretchAngle = 0;

      if (speed > LedRenderer3D.STRETCH_SPEED_MIN) {
        const normalizedSpeed = Math.min(
          (speed - LedRenderer3D.STRETCH_SPEED_MIN) /
            (LedRenderer3D.STRETCH_SPEED_MAX - LedRenderer3D.STRETCH_SPEED_MIN),
          1.0,
        );
        stretchFactor = 1.0 + normalizedSpeed * (LedRenderer3D.MAX_STRETCH - 1.0);
        stretchAngle = Math.atan2(tip.velocityY, tip.velocityX);
      }

      // Active LED instance
      this.setInstance(
        instanceIndex,
        tip.position,
        cameraQuat,
        tip.r,
        tip.g,
        tip.b,
        tip.brightness,
        stretchFactor,
        stretchAngle,
      );
      instanceIndex++;

      // Update trail ring buffer
      if (this.trailLength > 0) {
        const key = `${t}`;
        let trail = this.trails.get(key);
        if (!trail) {
          trail = new LedTrailRing(this.trailLength);
          this.trails.set(key, trail);
        }
        trail.push(tip.position.clone(), currentTime, tip.r, tip.g, tip.b);

        // Render trail ghosts
        const entries = trail.getOrdered(currentTime, LedRenderer3D.TRAIL_FADE_DURATION);
        // Skip the most recent entry (it's the current position)
        for (let e = 0; e < entries.length - 1 && instanceIndex < MAX_INSTANCES; e++) {
          const entry = entries[e]!;
          const age = currentTime - entry.timestamp;

          if (age > LedRenderer3D.TRAIL_FADE_DURATION) continue;

          const alpha =
            (1.0 - age / LedRenderer3D.TRAIL_FADE_DURATION) * 0.6 * tip.brightness;

          if (alpha < 0.01) continue;

          this.setInstance(
            instanceIndex,
            entry.position,
            cameraQuat,
            entry.r,
            entry.g,
            entry.b,
            alpha,
            1.0, // no stretch on trail ghosts
            0,
          );
          instanceIndex++;
        }
      }
    }

    this.mesh.count = instanceIndex;

    // Flag attributes for GPU upload
    const geo = this.mesh.geometry;
    const colorAttr = geo.getAttribute("instanceColor") as InstancedBufferAttribute;
    const alphaAttr = geo.getAttribute("instanceAlpha") as InstancedBufferAttribute;
    const stretchAttr = geo.getAttribute("instanceStretch") as InstancedBufferAttribute;

    if (colorAttr) colorAttr.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;
    if (stretchAttr) stretchAttr.needsUpdate = true;

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private setInstance(
    index: number,
    position: Vector3,
    cameraQuat: Quaternion,
    r: number,
    g: number,
    b: number,
    alpha: number,
    stretchFactor: number,
    stretchAngle: number,
  ): void {
    // Position + camera-facing orientation
    this.dummy.position.copy(position);
    this.dummy.quaternion.copy(cameraQuat);
    this.dummy.updateMatrix();
    this.mesh!.setMatrixAt(index, this.dummy.matrix);

    // Per-instance color
    const ci = index * 3;
    this.instanceColors[ci] = r;
    this.instanceColors[ci + 1] = g;
    this.instanceColors[ci + 2] = b;

    // Per-instance alpha
    this.instanceAlphas[index] = alpha;

    // Per-instance stretch
    const si = index * 2;
    this.instanceStretches[si] = stretchFactor;
    this.instanceStretches[si + 1] = stretchAngle;
  }

  updateMaterialUniforms(options: Partial<LedMaterialOptions>): void {
    if (!this.mesh) return;
    const mat = this.mesh.material as ReturnType<typeof createLedMaterial>;
    if (options.glowRadius !== undefined) {
      mat.uniforms.uGlowRadius!.value = options.glowRadius;
    }
    if (options.brightness !== undefined) {
      mat.uniforms.uBrightness!.value = options.brightness;
    }
    if (options.emissiveStrength !== undefined) {
      mat.uniforms.uEmissiveStrength!.value = options.emissiveStrength;
    }
  }

  setQualityTier(tier: QualityTier): void {
    if (tier === this.qualityTier) return;
    this.qualityTier = tier;
    this.trailLength = TRAIL_LENGTH[tier];

    // Clear all trails when tier changes (trail capacity changed)
    for (const trail of this.trails.values()) {
      trail.clear();
    }
    this.trails.clear();
  }

  reset(): void {
    for (const trail of this.trails.values()) {
      trail.clear();
    }
    this.trails.clear();
    if (this.mesh) {
      this.mesh.count = 0;
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.parent?.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach((m) => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
    this.trails.clear();
    this.parent = null;
  }
}
