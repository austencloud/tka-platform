/**
 * FireRenderer3D - Volumetric raymarched fire at prop tips.
 *
 * Momentum response uses three layers:
 *   1. Wind offset - accumulated velocity displaces noise coordinates
 *   2. Lean offset - shifts the teardrop density center so body leans
 *   3. Mesh tilt - quaternion rotation for gross directional cue
 *
 * Key insight from debugging: the animation runs in the XY plane
 * (staff rotates in a vertical plane facing the camera), so Z velocity
 * is always ~0. All direction math uses XY, not XZ.
 */

import type { Object3D} from "three";
import { Vector3, Quaternion, PointLight } from "three";
import { VolumetricFireMesh } from "./volumetric-fire-mesh";
import { type FireColorPreset } from "./fire-color-curve-3d";
import { QualityTier } from "../types";

const MAX_FIRE_TIPS = 4;

/** EMA smoothing - higher = faster response (was 0.08, too sluggish) */
const VELOCITY_SMOOTHING = 0.25;

/** How strongly velocity accumulates into wind noise displacement */
const WIND_STRENGTH = 3.0;

/** Wind offset exponential decay per frame - higher = more accumulation */
const WIND_DECAY = 0.96;

/** How strongly smoothed velocity shifts the density profile center */
const LEAN_STRENGTH = 1.2;

/** Max mesh tilt angle in radians */
const MAX_TILT_ANGLE = 0.5;

/** Speed at which tilt saturates */
const TILT_SPEED_SATURATION = 1.5;

export interface FireTipInput {
  position: Vector3;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
}

export interface FireRendererOptions {
  preset?: FireColorPreset;
}

interface TipState {
  smoothVelX: number;
  smoothVelY: number;
  smoothVelZ: number;
  windOffsetX: number;
  windOffsetY: number;
  windOffsetZ: number;
  initialized: boolean;
}

export class FireRenderer3D {
  private meshes: VolumetricFireMesh[] = [];
  private parent: Object3D | null = null;
  private qualityTier: QualityTier;
  private preset: FireColorPreset;

  private lights: PointLight[] = [];
  private lightEnabled: boolean;

  private time = 0;
  private tipStates: TipState[] = [];

  // Reusable math objects
  private readonly _tiltAxis = new Vector3();
  private readonly _velDir = new Vector3();
  private readonly _quat = new Quaternion();

  constructor(qualityTier: QualityTier = QualityTier.HIGH, options?: FireRendererOptions) {
    this.qualityTier = qualityTier;
    this.preset = options?.preset ?? "classic";
    this.lightEnabled = qualityTier !== QualityTier.LOW;

    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      this.tipStates.push({
        smoothVelX: 0, smoothVelY: 0, smoothVelZ: 0,
        windOffsetX: 0, windOffsetY: 0, windOffsetZ: 0,
        initialized: false,
      });
    }
  }

  initialize(parent: Object3D): void {
    if (this.meshes.length > 0) return;
    this.parent = parent;

    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      const mesh = new VolumetricFireMesh({
        preset: this.preset,
        qualityTier: this.qualityTier,
      });
      mesh.visible = false;
      parent.add(mesh);
      this.meshes.push(mesh);

      if (this.lightEnabled) {
        const light = new PointLight(0xff8822, 0, 3.0, 2.0);
        light.visible = false;
        parent.add(light);
        this.lights.push(light);
      }
    }
  }

  update(tips: FireTipInput[], dt: number): void {
    if (this.meshes.length === 0) return;

    const safeDt = Math.min(dt, 1 / 15);
    this.time += safeDt;

    for (let i = 0; i < MAX_FIRE_TIPS; i++) {
      const mesh = this.meshes[i]!;

      if (i < tips.length) {
        const tip = tips[i]!;
        const state = this.tipStates[i]!;

        // -- Smooth velocity with EMA --
        if (!state.initialized) {
          state.smoothVelX = tip.velocityX;
          state.smoothVelY = tip.velocityY;
          state.smoothVelZ = tip.velocityZ;
          state.windOffsetX = 0;
          state.windOffsetY = 0;
          state.windOffsetZ = 0;
          state.initialized = true;
        } else {
          // Frame-rate-independent EMA: at dt=1/60 this equals VELOCITY_SMOOTHING
          // exactly. At other frame rates it preserves the same ~183ms response time.
          const emaFactor = 1 - Math.pow(1 - VELOCITY_SMOOTHING, safeDt * 60);
          state.smoothVelX += (tip.velocityX - state.smoothVelX) * emaFactor;
          state.smoothVelY += (tip.velocityY - state.smoothVelY) * emaFactor;
          state.smoothVelZ += (tip.velocityZ - state.smoothVelZ) * emaFactor;
        }

        const svx = state.smoothVelX;
        const svy = state.smoothVelY;
        const svz = state.smoothVelZ;

        // Motion is primarily in the XY plane (vertical plane facing camera).
        // Z velocity is ~0 because the animation is 2D projected into 3D.
        const motionSpeed = Math.sqrt(svx * svx + svy * svy + svz * svz);

        // -- Layer 1: Accumulate wind offset --
        // Integrate smoothed velocity opposite to motion direction.
        // The noise field drifts opposite to the tip's travel, creating
        // the organic trailing flame effect.
        // Positive sign: adding velocity to the noise sample position shifts
        // the visual fire texture OPPOSITE to the offset direction. So (+svx)
        // here makes the flame visually trail BEHIND the motion.
        // Frame-rate-independent decay: at dt=1/60 this equals WIND_DECAY exactly.
        const windDecay = Math.pow(WIND_DECAY, safeDt * 60);
        state.windOffsetX = state.windOffsetX * windDecay + svx * WIND_STRENGTH * safeDt;
        state.windOffsetY = state.windOffsetY * windDecay + svy * WIND_STRENGTH * safeDt;
        state.windOffsetZ = state.windOffsetZ * windDecay + svz * WIND_STRENGTH * safeDt;

        mesh.setWindOffset(state.windOffsetX, state.windOffsetY, state.windOffsetZ);

        // -- Layer 2: Lean offset --
        // Shift the teardrop density center opposite to velocity.
        // In object space, X = world X (left/right), Z = world Z (depth).
        // Since motion is in XY, the X lean does the heavy lifting.
        // Y velocity (up/down) doesn't lean - it's the rise direction.
        // Same sign logic: positive lean offset in the shader shifts the
        // density profile center, making the visual flame lean AWAY from motion
        mesh.setLeanOffset(svx * LEAN_STRENGTH, svz * LEAN_STRENGTH);

        // -- Scale --
        const stretch = 1.0 + Math.min(motionSpeed * 0.5, 2.5);
        mesh.scale.y = 0.4 * stretch;
        // Widen box to give room for leaned flame
        mesh.scale.x = 0.22 * (1.0 + Math.min(motionSpeed * 0.3, 1.0));
        mesh.scale.z = mesh.scale.x;

        // -- Position: bottom of box at tip --
        const halfHeight = mesh.scale.y * 0.5;
        mesh.position.set(tip.position.x, tip.position.y + halfHeight, tip.position.z);

        // -- Layer 3: Mesh tilt --
        // Tilt away from velocity in the XY plane. Since the staff
        // swings in XY, the tilt axis is Z (perpendicular to the motion
        // plane). Positive X velocity → tilt in -Z direction (flame leans
        // opposite to swing). Y velocity contribution tilts around X axis.
        if (motionSpeed > 0.05) {
          // Decompose velocity into tilt angles around X and Z axes
          const speedRatio = Math.min(motionSpeed / TILT_SPEED_SATURATION, 1.0);
          const tiltMag = speedRatio * MAX_TILT_ANGLE;

          // Tilt direction: opposite to velocity, normalized
          const invSpeed = tiltMag / motionSpeed;
          // Tilt around Z axis (from X velocity) - negative because
          // positive X velocity should tilt flame in -X direction
          const tiltZ = svx * invSpeed;
          // Tilt around X axis (from Y velocity, excluding upward bias)
          // Only lean from horizontal motion of the Y component
          const tiltX = 0; // Y velocity is mostly gravity/rise, don't tilt from it

          this._quat.setFromAxisAngle(this._tiltAxis.set(0, 0, 1), tiltZ);
          if (tiltX !== 0) {
            const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tiltX);
            this._quat.multiply(qx);
          }
          mesh.quaternion.copy(this._quat);
        } else {
          mesh.quaternion.identity();
        }

        mesh.setTime(this.time);
        mesh.visible = true;

        // Dynamic light
        if (this.lightEnabled && i < this.lights.length) {
          const light = this.lights[i]!;
          light.position.set(tip.position.x, tip.position.y + 0.3, tip.position.z);
          let intensity = 1.5 + motionSpeed * 0.3;
          if (this.qualityTier === QualityTier.HIGH) {
            intensity +=
              Math.sin(this.time * 8.3 + i * 2.1) * 0.15 +
              Math.sin(this.time * 13.7 + i * 5.3) * 0.1 +
              Math.sin(this.time * 23.1 + i * 1.7) * 0.05;
          }
          light.intensity = Math.max(intensity, 0.5);
          light.visible = true;
        }
      } else {
        mesh.visible = false;
        if (i < this.tipStates.length) {
          this.tipStates[i]!.initialized = false;
        }
        if (this.lightEnabled && i < this.lights.length) {
          this.lights[i]!.visible = false;
        }
      }
    }
  }

  setPreset(preset: FireColorPreset): void {
    this.preset = preset;
    for (const mesh of this.meshes) {
      mesh.setPreset(preset);
    }
  }

  reset(): void {
    for (const mesh of this.meshes) {
      mesh.visible = false;
    }
    for (const light of this.lights) {
      light.visible = false;
    }
    for (const state of this.tipStates) {
      state.initialized = false;
      state.smoothVelX = 0;
      state.smoothVelY = 0;
      state.smoothVelZ = 0;
      state.windOffsetX = 0;
      state.windOffsetY = 0;
      state.windOffsetZ = 0;
    }
    this.time = 0;
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      this.parent?.remove(mesh);
      mesh.dispose();
    }
    for (const light of this.lights) {
      this.parent?.remove(light);
      light.dispose();
    }
    this.meshes = [];
    this.lights = [];
    this.parent = null;
  }
}
