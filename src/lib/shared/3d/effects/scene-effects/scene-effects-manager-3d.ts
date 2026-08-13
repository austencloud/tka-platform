import type { Object3D } from "three";
import { BubbleRenderer3D } from "../bubbles/bubble-renderer-3d";
import { PetalPoolRenderer3D } from "../petals/petal-pool-renderer-3d";
import {
  NEUTRAL_PETAL_ENVIRONMENT_PROFILE,
  type PetalEnvironmentProfile3D,
} from "../petals/petal-world-art-direction";
import { SparkleRenderer3D } from "../particles/sparkle-renderer-3d";
import { SmokePoolRenderer3D } from "../smoke/smoke-pool-renderer-3d";
import { GooRenderer3D } from "../water/goo-renderer-3d";
import { InkRenderer3D } from "../ink/ink-renderer-3d";
import { SilkRenderer3D } from "../silk/silk-renderer-3d";
import { AnimalRenderer3D } from "../animal/animal-renderer-3d";
import { PulseRenderer3D } from "../pulse/pulse-renderer-3d";
import { BloomRenderer3D } from "../bloom/bloom-renderer-3d";
import type {
  BubbleTipSource3D,
  GooTipSource3D,
  PetalTipSource3D,
  SceneEffectRigFrame3D,
  SmokeTipSource3D,
  SparkleTipSource3D,
  InkTipSource3D,
  SilkTipSource3D,
  AnimalTipSource3D,
  PulseTipSource3D,
  BloomTipSource3D,
} from "./scene-effect-source-3d";

export interface SceneEffectsRigRegistration3D {
  /** Four consecutive IDs, one for each prop tip in canonical order. */
  sourceIdBase: number;
  dispose(): void;
}

/**
 * Owns one renderer per pooled visual effect for one Three.js scene.
 *
 * Orchestrators only publish stable tip inputs. This manager gathers every rig
 * after Threlte's main stage and advances each effect exactly once, so particle
 * count no longer multiplies draw calls or Svelte component work.
 */
export class SceneEffectsManager3D {
  private readonly rigs = new Set<SceneEffectRigFrame3D>();
  private readonly sparkles: SparkleTipSource3D[] = [];
  private readonly goo: GooTipSource3D[] = [];
  private readonly bubbles: BubbleTipSource3D[] = [];
  private readonly petals: PetalTipSource3D[] = [];
  private readonly smoke: SmokeTipSource3D[] = [];
  private readonly ink: InkTipSource3D[] = [];
  private readonly silk: SilkTipSource3D[] = [];
  private readonly animal: AnimalTipSource3D[] = [];
  private readonly pulse: PulseTipSource3D[] = [];
  private readonly bloom: BloomTipSource3D[] = [];
  private sparkleRenderer: SparkleRenderer3D | null = null;
  private gooRenderer: GooRenderer3D | null = null;
  private bubbleRenderer: BubbleRenderer3D | null = null;
  private petalRenderer: PetalPoolRenderer3D | null = null;
  private smokeRenderer: SmokePoolRenderer3D | null = null;
  private inkRenderer: InkRenderer3D | null = null;
  private silkRenderer: SilkRenderer3D | null = null;
  private animalRenderer: AnimalRenderer3D | null = null;
  private pulseRenderer: PulseRenderer3D | null = null;
  private bloomRenderer: BloomRenderer3D | null = null;
  private parent: Object3D | null = null;
  private nextSourceId = 1;
  private petalEnvironmentProfile = NEUTRAL_PETAL_ENVIRONMENT_PROFILE;

  registerRig(frame: SceneEffectRigFrame3D): SceneEffectsRigRegistration3D {
    this.rigs.add(frame);
    const sourceIdBase = this.nextSourceId;
    this.nextSourceId += 4;
    let registered = true;
    return {
      sourceIdBase,
      dispose: () => {
        if (!registered) return;
        registered = false;
        this.rigs.delete(frame);
        if (this.rigs.size === 0) this.clear();
      },
    };
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    if (this.parent) this.disposeRenderers();
    this.parent = parent;
    this.sparkleRenderer = new SparkleRenderer3D();
    this.gooRenderer = new GooRenderer3D();
    this.bubbleRenderer = new BubbleRenderer3D();
    this.petalRenderer = new PetalPoolRenderer3D();
    this.petalRenderer.setEnvironmentProfile(this.petalEnvironmentProfile);
    this.smokeRenderer = new SmokePoolRenderer3D();
    this.inkRenderer = new InkRenderer3D();
    this.silkRenderer = new SilkRenderer3D();
    this.animalRenderer = new AnimalRenderer3D();
    this.pulseRenderer = new PulseRenderer3D();
    this.bloomRenderer = new BloomRenderer3D();
    this.sparkleRenderer.initialize(parent);
    this.gooRenderer.initialize(parent);
    this.bubbleRenderer.initialize(parent);
    this.petalRenderer.initialize(parent);
    this.smokeRenderer.initialize(parent);
    this.inkRenderer.initialize(parent);
    this.silkRenderer.initialize(parent);
    this.animalRenderer.initialize(parent);
    this.pulseRenderer.initialize(parent);
    this.bloomRenderer.initialize(parent);
  }

  setPetalEnvironmentProfile(profile: PetalEnvironmentProfile3D): void {
    if (profile === this.petalEnvironmentProfile) return;
    this.petalEnvironmentProfile = profile;
    this.petalRenderer?.setEnvironmentProfile(profile);
  }

  update(delta: number): void {
    if (!this.parent) return;
    this.sparkles.length = 0;
    this.goo.length = 0;
    this.bubbles.length = 0;
    this.petals.length = 0;
    this.smoke.length = 0;
    this.ink.length = 0;
    this.silk.length = 0;
    this.animal.length = 0;
    this.pulse.length = 0;
    this.bloom.length = 0;
    let anyPlaying = false;

    for (const rig of this.rigs) {
      if (rig.playing) anyPlaying = true;
      for (const source of rig.sources) {
        if (source.effect === "bloom") {
          this.bloom.push(source);
          continue;
        }
        if (!rig.playing) continue;
        switch (source.effect) {
          case "sparkles":
            this.sparkles.push(source);
            break;
          case "goo":
            this.goo.push(source);
            break;
          case "bubbles":
            this.bubbles.push(source);
            break;
          case "petals":
            this.petals.push(source);
            break;
          case "smoke":
            this.smoke.push(source);
            break;
          case "ink":
            this.ink.push(source);
            break;
          case "silk":
            this.silk.push(source);
            break;
          case "animal":
            this.animal.push(source);
            break;
          case "pulse":
            this.pulse.push(source);
            break;
        }
      }
    }

    // Bloom pulse remains clock-driven while paused, matching its 2D contract.
    // Emission-based effects still freeze with the animation.
    this.bloomRenderer?.update(this.bloom, delta);
    if (!anyPlaying) return;
    this.sparkleRenderer?.update(this.sparkles, delta);
    this.gooRenderer?.update(this.goo, delta);
    this.bubbleRenderer?.update(this.bubbles, delta);
    this.petalRenderer?.update(this.petals, delta);
    this.smokeRenderer?.update(this.smoke, delta);
    this.inkRenderer?.update(this.ink, delta);
    this.silkRenderer?.update(this.silk, delta);
    this.animalRenderer?.update(this.animal, delta);
    this.pulseRenderer?.update(this.pulse, delta);
  }

  clear(): void {
    this.sparkleRenderer?.clear();
    this.gooRenderer?.clear();
    this.bubbleRenderer?.clear();
    this.petalRenderer?.clear();
    this.smokeRenderer?.clear();
    this.inkRenderer?.clear();
    this.silkRenderer?.clear();
    this.animalRenderer?.clear();
    this.pulseRenderer?.clear();
    this.bloomRenderer?.clear();
  }

  dispose(): void {
    this.rigs.clear();
    this.disposeRenderers();
    this.parent = null;
  }

  private disposeRenderers(): void {
    this.sparkleRenderer?.dispose();
    this.gooRenderer?.dispose();
    this.bubbleRenderer?.dispose();
    this.petalRenderer?.dispose();
    this.smokeRenderer?.dispose();
    this.inkRenderer?.dispose();
    this.silkRenderer?.dispose();
    this.animalRenderer?.dispose();
    this.pulseRenderer?.dispose();
    this.bloomRenderer?.dispose();
    this.sparkleRenderer = null;
    this.gooRenderer = null;
    this.bubbleRenderer = null;
    this.petalRenderer = null;
    this.smokeRenderer = null;
    this.inkRenderer = null;
    this.silkRenderer = null;
    this.animalRenderer = null;
    this.pulseRenderer = null;
    this.bloomRenderer = null;
  }
}
