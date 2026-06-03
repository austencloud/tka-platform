/**
 * LedRenderer3D - LED renderer with mathematically continuous trails.
 *
 * Architecture:
 *   - Active head LEDs are rendered as camera-facing billboard sprites
 *     via an InstancedMesh (LedMaterial3D's bulb shader).
 *   - Trails are rendered as continuous camera-facing ribbon geometry,
 *     one BufferGeometry per LED. The ribbon is rebuilt every frame from
 *     a rolling history of sample positions. This eliminates the
 *     chain-of-dots artifact that plagues discrete-sample approaches -
 *     the trail is a literal solid mesh, not a stack of overlapping
 *     alpha blobs.
 *
 * Quality tier adaptation:
 *   - High: long ribbons (full fade duration), dense history
 *   - Medium: shorter fade, less history
 *   - Low: no ribbons (emissive bulbs only)
 */

import {
  Vector3,
  PlaneGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  Mesh,
  Object3D,
  type Camera,
} from "three";
import { createLedMaterial, type LedMaterialOptions } from "./led-material-3d";
import {
  createLedRibbonMaterial,
  type LedRibbonMaterialOptions,
} from "./led-ribbon-material-3d";
import { LedRibbonGeometry3D, type RibbonSample } from "./led-ribbon-geometry-3d";
import { QualityTier } from "../types";

/** Maximum LED tips per prop (matches 2D system's MAX_TOTAL_TIPS / 2) */
const MAX_LEDS_PER_PROP = 16;

/** LED sprite size in world units - the bright bulb at the active head */
const LED_SPRITE_SIZE = 0.35;

/** Ribbon half-width in world units. Set to the bulb's core radius so
 *  the transition from ribbon to bulb at the head is visually seamless. */
const LED_RIBBON_HALF_WIDTH = LED_SPRITE_SIZE * 0.25;

/** Maximum number of sample points that can feed a single LED's ribbon.
 *  Sized to hold 2s of history at 120fps with moderate substep density,
 *  which is more than enough for any realistic trail fade duration. */
const MAX_SAMPLES_PER_RIBBON = 512;

/** Maximum head bulb instances - 2 props × MAX_LEDS_PER_PROP, but each
 *  renderer only handles one prop's worth, so we only need MAX_LEDS_PER_PROP. */
const MAX_HEAD_INSTANCES = MAX_LEDS_PER_PROP;

/** Trail fade duration per quality tier, in seconds. */
const TRAIL_FADE_DURATION: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 1.0,
  [QualityTier.MEDIUM]: 0.6,
  [QualityTier.LOW]: 0.0,
};

/** Target spacing between ribbon sample points, as a fraction of sprite
 *  size. The ribbon is continuous between samples, so this doesn't need
 *  to be tiny - it only has to be tight enough that polygon edges don't
 *  cause visible kinks on tight curves. */
const RIBBON_SAMPLE_SPACING = LED_SPRITE_SIZE * 0.25;

/** Cap on substeps generated per frame to bound worst-case work. */
const MAX_SUBSTEPS_PER_FRAME = 32;

/** If the gap between this frame and the previous sample is larger than
 *  this, treat as a discontinuity and reset the ribbon. */
const MAX_SUBSTEP_DT = 0.1;

/** Ring buffer of ribbon samples for one LED. */
class RibbonSampleBuffer {
  private readonly buffer: RibbonSample[];
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

  push(
    position: Vector3,
    timestamp: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const entry = this.buffer[this.head]!;
    entry.position.copy(position);
    entry.timestamp = timestamp;
    entry.r = r;
    entry.g = g;
    entry.b = b;
    this.head = (this.head + 1) % this.capacity;
    if (this._count < this.capacity) this._count++;
  }

  /** Fill the provided array with samples oldest-first, skipping any
   *  older than `maxAge`. Returns the number of samples written. */
  fillOrdered(
    out: RibbonSample[],
    currentTime: number,
    maxAge: number,
  ): number {
    if (this._count === 0) return 0;
    const start = this._count < this.capacity ? 0 : this.head;
    let written = 0;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      const entry = this.buffer[idx]!;
      if (currentTime - entry.timestamp > maxAge) continue;
      out[written++] = entry;
    }
    return written;
  }

  clear(): void {
    this.head = 0;
    this._count = 0;
  }
}

/** Per-LED state: history buffer, ribbon mesh, and last-pushed sample
 *  used to drive substep interpolation between frames. */
interface LedTrailState {
  buffer: RibbonSampleBuffer;
  ribbon: LedRibbonGeometry3D;
  mesh: Mesh;
  lastPosition: Vector3;
  lastTimestamp: number;
  hasLast: boolean;
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
  private headMesh: InstancedMesh | null = null;
  private instanceColors: Float32Array;
  private instanceAlphas: Float32Array;
  private instanceStretches: Float32Array;
  private dummy = new Object3D();
  private trails: Map<string, LedTrailState> = new Map();
  private qualityTier: QualityTier;
  private fadeDuration: number;
  private parent: Object3D | null = null;
  private ribbonMaterial: ReturnType<typeof createLedRibbonMaterial> | null = null;
  /** Scratch array for fillOrdered - reused across frames/LEDs. */
  private readonly sampleScratch: RibbonSample[] = new Array(MAX_SAMPLES_PER_RIBBON);
  /** Scratch vectors reused every frame to avoid GC pressure in the hot path. */
  private readonly scratchCameraPosition = new Vector3();
  private readonly scratchInterp = new Vector3();

  /** Maximum velocity elongation factor for the head bulb */
  private static readonly MAX_STRETCH = 1.5;
  /** Speed threshold where stretch begins (world units/sec) */
  private static readonly STRETCH_SPEED_MIN = 0.5;
  /** Speed at which stretch reaches MAX_STRETCH */
  private static readonly STRETCH_SPEED_MAX = 5.0;

  constructor(qualityTier: QualityTier = QualityTier.HIGH) {
    this.qualityTier = qualityTier;
    this.fadeDuration = TRAIL_FADE_DURATION[qualityTier];
    this.instanceColors = new Float32Array(MAX_HEAD_INSTANCES * 3);
    this.instanceAlphas = new Float32Array(MAX_HEAD_INSTANCES);
    this.instanceStretches = new Float32Array(MAX_HEAD_INSTANCES * 2);
  }

  initialize(
    parent: Object3D,
    materialOptions?: LedMaterialOptions,
    ribbonOptions?: LedRibbonMaterialOptions,
  ): void {
    if (this.headMesh) return;
    this.parent = parent;

    const geometry = new PlaneGeometry(LED_SPRITE_SIZE, LED_SPRITE_SIZE);
    const material = createLedMaterial(materialOptions);

    this.headMesh = new InstancedMesh(geometry, material, MAX_HEAD_INSTANCES);
    this.headMesh.frustumCulled = false;

    const colorAttr = new InstancedBufferAttribute(this.instanceColors, 3);
    colorAttr.setUsage(35048);
    geometry.setAttribute("instanceColor", colorAttr);

    const alphaAttr = new InstancedBufferAttribute(this.instanceAlphas, 1);
    alphaAttr.setUsage(35048);
    geometry.setAttribute("instanceAlpha", alphaAttr);

    const stretchAttr = new InstancedBufferAttribute(this.instanceStretches, 2);
    stretchAttr.setUsage(35048);
    geometry.setAttribute("instanceStretch", stretchAttr);

    this.headMesh.count = 0;
    this.headMesh.renderOrder = 101; // heads render above ribbons
    parent.add(this.headMesh);

    this.ribbonMaterial = createLedRibbonMaterial(ribbonOptions);
  }

  /**
   * Update all LED instances for the current frame.
   *
   * @param tips - Active LED tip data for this frame
   * @param camera - Current camera (for head billboard + ribbon orientation)
   * @param currentTime - Current time in seconds
   */
  update(tips: LedTipInput[], camera: Camera, currentTime: number): void {
    if (!this.headMesh) return;

    camera.getWorldPosition(this.scratchCameraPosition);
    const cameraQuat = camera.quaternion;

    let headIndex = 0;

    for (let t = 0; t < tips.length && headIndex < MAX_HEAD_INSTANCES; t++) {
      const tip = tips[t]!;

      // --- Head bulb (billboard sprite) ---
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

      this.dummy.position.copy(tip.position);
      this.dummy.quaternion.copy(cameraQuat);
      this.dummy.updateMatrix();
      this.headMesh.setMatrixAt(headIndex, this.dummy.matrix);

      const ci = headIndex * 3;
      this.instanceColors[ci] = tip.r;
      this.instanceColors[ci + 1] = tip.g;
      this.instanceColors[ci + 2] = tip.b;
      this.instanceAlphas[headIndex] = tip.brightness;
      const si = headIndex * 2;
      this.instanceStretches[si] = stretchFactor;
      this.instanceStretches[si + 1] = stretchAngle;
      headIndex++;

      // --- Trail ribbon ---
      if (this.fadeDuration <= 0) continue;

      const key = `${t}`;
      let state = this.trails.get(key);
      if (!state) {
        state = this.createTrailState(key);
      }

      // Substep interpolation: between the previous frame's sample and
      // this frame's position, push intermediate samples along the line
      // so the ribbon has enough vertices to stay smooth through tight
      // curves at any prop speed.
      if (state.hasLast) {
        const dt = currentTime - state.lastTimestamp;
        if (dt > 0 && dt <= MAX_SUBSTEP_DT) {
          const dist = tip.position.distanceTo(state.lastPosition);
          if (dist > RIBBON_SAMPLE_SPACING) {
            const steps = Math.min(
              Math.ceil(dist / RIBBON_SAMPLE_SPACING),
              MAX_SUBSTEPS_PER_FRAME,
            );
            for (let s = 1; s < steps; s++) {
              const a = s / steps;
              this.scratchInterp.lerpVectors(
                state.lastPosition,
                tip.position,
                a,
              );
              const interpTime = state.lastTimestamp + dt * a;
              // push() copies by value, so reusing scratch is safe.
              state.buffer.push(this.scratchInterp, interpTime, tip.r, tip.g, tip.b);
            }
          }
        } else if (dt > MAX_SUBSTEP_DT) {
          // Long gap → treat as discontinuity, start fresh
          state.buffer.clear();
        }
      }

      state.buffer.push(tip.position, currentTime, tip.r, tip.g, tip.b);
      state.lastPosition.copy(tip.position);
      state.lastTimestamp = currentTime;
      state.hasLast = true;

      // Build ribbon geometry for this frame
      const sampleCount = state.buffer.fillOrdered(
        this.sampleScratch,
        currentTime,
        this.fadeDuration,
      );
      if (sampleCount < 2) {
        state.ribbon.hide();
      } else {
        state.ribbon.update(
          this.sampleScratch,
          sampleCount,
          this.scratchCameraPosition,
          LED_RIBBON_HALF_WIDTH,
          currentTime,
          this.fadeDuration,
          tip.brightness,
        );
      }
    }

    // Hide ribbons for LEDs that weren't updated this frame (fewer tips
    // than last frame, or tip index unused).
    for (const [key, state] of this.trails) {
      const idx = Number(key);
      if (idx >= tips.length) {
        state.ribbon.hide();
      }
    }

    this.headMesh.count = headIndex;

    const geo = this.headMesh.geometry;
    const colorAttr = geo.getAttribute("instanceColor") as InstancedBufferAttribute;
    const alphaAttr = geo.getAttribute("instanceAlpha") as InstancedBufferAttribute;
    const stretchAttr = geo.getAttribute("instanceStretch") as InstancedBufferAttribute;
    if (colorAttr) colorAttr.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;
    if (stretchAttr) stretchAttr.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
  }

  private createTrailState(key: string): LedTrailState {
    const buffer = new RibbonSampleBuffer(MAX_SAMPLES_PER_RIBBON);
    const ribbon = new LedRibbonGeometry3D(MAX_SAMPLES_PER_RIBBON);
    const mesh = new Mesh(ribbon.geometry, this.ribbonMaterial!);
    mesh.frustumCulled = false;
    mesh.renderOrder = 100; // under heads, above scene
    this.parent?.add(mesh);

    const state: LedTrailState = {
      buffer,
      ribbon,
      mesh,
      lastPosition: new Vector3(),
      lastTimestamp: 0,
      hasLast: false,
    };
    this.trails.set(key, state);
    return state;
  }

  updateMaterialUniforms(options: Partial<LedMaterialOptions>): void {
    if (!this.headMesh) return;
    const mat = this.headMesh.material as ReturnType<typeof createLedMaterial>;
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

  updateRibbonUniforms(options: Partial<LedRibbonMaterialOptions>): void {
    if (!this.ribbonMaterial) return;
    if (options.brightness !== undefined) {
      this.ribbonMaterial.uniforms.uBrightness!.value = options.brightness;
    }
    if (options.emissiveStrength !== undefined) {
      this.ribbonMaterial.uniforms.uEmissiveStrength!.value = options.emissiveStrength;
    }
    if (options.coreStrength !== undefined) {
      this.ribbonMaterial.uniforms.uCoreStrength!.value = options.coreStrength;
    }
  }

  setQualityTier(tier: QualityTier): void {
    if (tier === this.qualityTier) return;
    this.qualityTier = tier;
    this.fadeDuration = TRAIL_FADE_DURATION[tier];
    for (const state of this.trails.values()) {
      state.buffer.clear();
      state.ribbon.hide();
      state.hasLast = false;
    }
  }

  reset(): void {
    for (const state of this.trails.values()) {
      state.buffer.clear();
      state.ribbon.hide();
      state.hasLast = false;
    }
    if (this.headMesh) {
      this.headMesh.count = 0;
    }
  }

  dispose(): void {
    if (this.headMesh) {
      this.parent?.remove(this.headMesh);
      this.headMesh.geometry.dispose();
      if (Array.isArray(this.headMesh.material)) {
        this.headMesh.material.forEach((m) => m.dispose());
      } else {
        this.headMesh.material.dispose();
      }
      this.headMesh = null;
    }
    for (const state of this.trails.values()) {
      this.parent?.remove(state.mesh);
      state.ribbon.dispose();
    }
    this.trails.clear();
    if (this.ribbonMaterial) {
      this.ribbonMaterial.dispose();
      this.ribbonMaterial = null;
    }
    this.parent = null;
  }
}
