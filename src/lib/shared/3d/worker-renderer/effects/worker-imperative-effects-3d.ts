import { Quaternion, Vector3, type Camera, type Object3D } from "three";
import type { DynamicLightManager } from "../../effects/lighting/dynamic-light-manager";
import {
  LedRenderer3D,
  type LedTipInput,
} from "../../effects/led/led-renderer-3d";
import { MoonFanDiffuserRenderer3D } from "../../effects/led/moon-fan-diffuser-renderer-3d";
import { PovStripRenderer3D } from "../../effects/poi/pov-strip-renderer-3d";
import { QualityTier } from "../../effects/types";
import type {
  WorkerImperativeEffectFrame,
  WorkerLedEffectFrame,
  WorkerMoonFanEffectFrame,
  WorkerPovEffectFrame,
  WorkerTrailEffectFrame,
} from "../domain/worker-renderer-protocol";
import { WorkerTrailEffect3D } from "./worker-trail-effect-3d";

interface LedRuntime {
  key: string;
  lastSampleSequence: number;
  renderer: LedRenderer3D;
}

interface PovRuntime {
  key: string;
  lastSampleSequence: number;
  renderer: PovStripRenderer3D;
}

interface MoonRuntime {
  lastSampleSequence: number;
  renderer: MoonFanDiffuserRenderer3D;
}

function qualityTier(value: string): QualityTier {
  switch (value) {
    case "low":
      return QualityTier.LOW;
    case "medium":
      return QualityTier.MEDIUM;
    default:
      return QualityTier.HIGH;
  }
}

/**
 * Worker lifecycle for effect renderers that are not owned by
 * SceneEffectsManager3D. Inputs are final app-thread decisions.
 */
export class WorkerImperativeEffects3D {
  private readonly parent: Object3D;
  private readonly lights: DynamicLightManager | null;
  private readonly trails = new Map<string, WorkerTrailEffect3D>();
  private readonly leds = new Map<string, LedRuntime>();
  private readonly povs = new Map<string, PovRuntime>();
  private readonly moonFans = new Map<string, MoonRuntime>();
  private disposed = false;

  constructor(parent: Object3D, lights: DynamicLightManager | null) {
    this.parent = parent;
    this.lights = lights;
  }

  apply(frames: readonly WorkerImperativeEffectFrame[], camera: Camera): void {
    if (this.disposed) return;
    const active = new Set<string>();
    for (const frame of frames) {
      active.add(`${frame.renderer}:${frame.sourceId}`);
      switch (frame.renderer) {
        case "trail":
          this.applyTrail(frame);
          break;
        case "led":
          this.applyLed(frame, camera);
          break;
        case "pov":
          this.applyPov(frame, camera);
          break;
        case "moon-fan":
          this.applyMoonFan(frame);
          break;
      }
    }

    for (const [sourceId, trail] of this.trails) {
      if (!active.has(`trail:${sourceId}`)) trail.setEnabled(false);
    }
    for (const [sourceId, runtime] of this.leds) {
      if (!active.has(`led:${sourceId}`)) runtime.renderer.reset();
    }
    for (const [sourceId, runtime] of this.povs) {
      if (!active.has(`pov:${sourceId}`)) runtime.renderer.reset();
    }
    for (const [sourceId, runtime] of this.moonFans) {
      if (!active.has(`moon-fan:${sourceId}`)) runtime.renderer.reset();
    }
  }

  update(deltaSeconds: number, camera: Camera): void {
    if (this.disposed) return;
    for (const trail of this.trails.values()) {
      trail.update(deltaSeconds, camera);
    }
  }

  private applyTrail(frame: WorkerTrailEffectFrame): void {
    let trail = this.trails.get(frame.sourceId);
    if (trail && !trail.matchesCapacity(frame)) {
      trail.dispose();
      this.trails.delete(frame.sourceId);
      trail = undefined;
    }
    if (!trail) {
      trail = new WorkerTrailEffect3D(this.parent, this.lights, frame);
      this.trails.set(frame.sourceId, trail);
    } else {
      trail.setFrame(frame);
    }
  }

  private applyLed(frame: WorkerLedEffectFrame, camera: Camera): void {
    const key = frame.qualityTier;
    let runtime = this.leds.get(frame.sourceId);
    if (runtime?.key !== key) {
      runtime?.renderer.dispose();
      const renderer = new LedRenderer3D(qualityTier(frame.qualityTier));
      renderer.initialize(this.parent);
      renderer.primeTipCapacity(2);
      runtime = { key, lastSampleSequence: -1, renderer };
      this.leds.set(frame.sourceId, runtime);
    }
    if (!frame.enabled || frame.tips.length === 0) {
      runtime.renderer.reset();
      return;
    }
    if (runtime.lastSampleSequence === frame.sampleSequence) return;
    runtime.lastSampleSequence = frame.sampleSequence;
    const tips: LedTipInput[] = frame.tips.map((tip) => ({
      position: new Vector3().fromArray(tip.position),
      r: tip.r,
      g: tip.g,
      b: tip.b,
      brightness: tip.brightness,
      velocityX: tip.velocity[0],
      velocityY: tip.velocity[1],
      velocityZ: tip.velocity[2],
      speed: tip.speed,
    }));
    runtime.renderer.update(tips, camera, frame.sampledAtSeconds);
  }

  private applyPov(frame: WorkerPovEffectFrame, camera: Camera): void {
    const key = `${frame.qualityTier}:${frame.ledCount}`;
    let runtime = this.povs.get(frame.sourceId);
    if (runtime?.key !== key) {
      runtime?.renderer.dispose();
      const renderer = new PovStripRenderer3D(
        qualityTier(frame.qualityTier),
        frame.ledCount
      );
      renderer.initialize(this.parent);
      runtime = { key, lastSampleSequence: -1, renderer };
      this.povs.set(frame.sourceId, runtime);
    }
    if (!frame.enabled) {
      runtime.renderer.reset();
      return;
    }
    if (runtime.lastSampleSequence === frame.sampleSequence) return;
    runtime.lastSampleSequence = frame.sampleSequence;
    runtime.renderer.setPersistenceDuration(frame.persistenceDuration);
    runtime.renderer.update(
      new Vector3().fromArray(frame.staffAxis),
      new Vector3().fromArray(frame.staffCenter),
      frame.staffHalfLength,
      frame.frameIndex,
      frame.pattern,
      camera,
      frame.sampledAtSeconds,
      frame.brightness
    );
  }

  private applyMoonFan(frame: WorkerMoonFanEffectFrame): void {
    let runtime = this.moonFans.get(frame.sourceId);
    if (!runtime) {
      const renderer = new MoonFanDiffuserRenderer3D();
      renderer.initialize(this.parent);
      runtime = { lastSampleSequence: -1, renderer };
      this.moonFans.set(frame.sourceId, runtime);
    }
    if (!frame.enabled) {
      runtime.renderer.reset();
      return;
    }
    if (runtime.lastSampleSequence === frame.sampleSequence) return;
    runtime.lastSampleSequence = frame.sampleSequence;
    const rotation = new Quaternion().fromArray(frame.worldRotation);
    runtime.renderer.update({
      propState: {
        worldPosition: { x: 0, y: 0, z: 0 },
        worldRotation: {
          x: rotation.x,
          y: rotation.y,
          z: rotation.z,
          w: rotation.w,
        },
      },
      rigLocalCenter: {
        x: frame.worldCenter[0],
        y: frame.worldCenter[1],
        z: frame.worldCenter[2],
      },
      ledColors: frame.ledColors,
      brightness: frame.brightness,
      scale: frame.scale,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const trail of this.trails.values()) trail.dispose();
    for (const runtime of this.leds.values()) runtime.renderer.dispose();
    for (const runtime of this.povs.values()) runtime.renderer.dispose();
    for (const runtime of this.moonFans.values()) runtime.renderer.dispose();
    this.trails.clear();
    this.leds.clear();
    this.povs.clear();
    this.moonFans.clear();
  }
}
