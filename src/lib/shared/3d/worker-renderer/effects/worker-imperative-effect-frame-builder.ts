import { Matrix3, Quaternion, Vector3, type Matrix4 } from "three";
import { PropType } from "@austencloud/scene-3d";
import type { PropBuild, PropState3D } from "@austencloud/scene-3d";
import { resolveEffect } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import type { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import { ledBrightnessToFloat } from "$lib/shared/animation-engine/domain/types/led-types";
import { LedPatternMaterializer } from "$lib/shared/animation-engine/services/led/led-pattern-materializer";
import { patternFrameIndex } from "$lib/shared/animation-engine/services/led-sampler";
import type {
  LedIntent,
  TrailsIntent,
} from "$lib/shared/effects/domain/effects-config";
import {
  resolveLed3D,
  resolveTrails3D,
} from "$lib/shared/effects/translators/webgl3d-translator";
import {
  getPixel,
  type StripPattern,
} from "$lib/shared/poi/domain/strip-pattern";
import {
  resolveRigLocalPropCenter3D,
  resolveTrailSources3D,
  TipPositionBridge3D,
} from "../../effects/tip-position-bridge-3d";
import { MOON_FAN_LED_COUNT } from "../../effects/led/moon-fan-diffuser-renderer-3d";
import { shutterToPovPersistence } from "../../effects/poi/pov-strip-renderer-3d";
import type {
  WorkerEffectQualityTier,
  WorkerImperativeEffectFrame,
  WorkerLedTipFrame,
} from "../domain/worker-renderer-protocol";

const LED_SUPERSAMPLE_BY_TIER: Record<WorkerEffectQualityTier, number> = {
  high: 8,
  medium: 4,
  low: 1,
};

export interface WorkerEffectPropFrameInput {
  state: PropState3D | null;
  propType: PropType;
  handPosition: { x: number; z: number };
}

export interface WorkerImperativeEffectFrameInput {
  performerId: string;
  playing: boolean;
  deltaSeconds: number;
  sampledAtMs: number;
  qualityTier: WorkerEffectQualityTier;
  staffHalfLength: number;
  propBuild: PropBuild;
  effectSpaceMatrix: Matrix4;
  left: WorkerEffectPropFrameInput;
  right: WorkerEffectPropFrameInput;
  tipEffectMap?: TipEffectMap;
  globalTipEffectMap?: TipEffectMap;
  trailTrackingMode?: TrackingMode;
  trails: TrailsIntent;
  led: LedIntent;
}

interface PerformerEffectState {
  readonly tipBridge: TipPositionBridge3D;
  readonly patternMaterializer: LedPatternMaterializer;
  readonly previousLedPositions: Map<string, Vector3>;
}

function performerState(): PerformerEffectState {
  return {
    tipBridge: new TipPositionBridge3D(),
    patternMaterializer: new LedPatternMaterializer(),
    previousLedPositions: new Map(),
  };
}

function trailTierBoost(tier: WorkerEffectQualityTier): number {
  return tier === "high" ? 1.6 : tier === "medium" ? 1.3 : 1;
}

function worldPoint(
  local: { x: number; y: number; z: number },
  matrix: Matrix4
) {
  return new Vector3(local.x, local.y, local.z).applyMatrix4(matrix);
}

function worldDirection(
  local: { x: number; y: number; z: number },
  matrix: Matrix3
) {
  return new Vector3(local.x, local.y, local.z).applyMatrix3(matrix);
}

function stripColors(pattern: StripPattern, frameIndex: number) {
  return Array.from({ length: pattern.ledCount }, (_, index) => {
    const color = getPixel(pattern, frameIndex, index);
    return { r: color.r / 255, g: color.g / 255, b: color.b / 255 };
  });
}

/**
 * App-thread owner for non-pooled worker effect frames.
 *
 * It runs the same tip bridge, effect resolver, LED materializer, and Choreo
 * clock as the production Svelte orchestrator. Only final numbers and typed
 * arrays cross the worker boundary; the worker is never allowed to reinterpret
 * a card or choose a visual effect itself.
 */
export class WorkerImperativeEffectFrameBuilder {
  private readonly performers = new Map<string, PerformerEffectState>();
  private sampleSequence = 0;

  build(
    input: WorkerImperativeEffectFrameInput
  ): WorkerImperativeEffectFrame[] {
    const state = this.getPerformer(input.performerId);
    if (!input.playing) {
      state.tipBridge.reset();
      state.previousLedPositions.clear();
    }

    const sequence = ++this.sampleSequence;
    const output: WorkerImperativeEffectFrame[] = [];
    const linearTransform = new Matrix3().setFromMatrix4(
      input.effectSpaceMatrix
    );
    const rootRotation = new Quaternion();
    input.effectSpaceMatrix.decompose(
      new Vector3(),
      rootRotation,
      new Vector3()
    );
    const resolvedTrails = resolveTrails3D(input.trails);
    const resolvedLed = resolveLed3D(input.led);
    const ledCount = Math.max(1, Math.round(resolvedLed.device.ledCount));
    const ledPattern = state.patternMaterializer.resolve(
      resolvedLed.pattern,
      ledCount
    );
    const ledFrame = ledPattern
      ? patternFrameIndex(
          input.sampledAtMs,
          resolvedLed.cycleDuration,
          ledPattern.frameCount
        )
      : 0;
    const moonPattern = state.patternMaterializer.resolve(
      resolvedLed.pattern,
      MOON_FAN_LED_COUNT
    );
    const moonFrame = moonPattern
      ? patternFrameIndex(
          input.sampledAtMs,
          resolvedLed.cycleDuration,
          moonPattern.frameCount
        )
      : 0;
    const brightness = ledBrightnessToFloat(resolvedLed.look.brightness);

    const props = [input.left, input.right] as const;
    for (const [propIndex, prop] of props.entries()) {
      if (!prop.state) continue;
      const rigCenter = resolveRigLocalPropCenter3D(
        prop.state.worldPosition,
        prop.handPosition
      );
      const tipFrame = state.tipBridge.update(
        propIndex,
        prop.state,
        rigCenter,
        input.staffHalfLength,
        Math.min(input.deltaSeconds, 1 / 15),
        prop.propType,
        input.propBuild
      );
      const effectAt = (tipIndex: 0 | 1) =>
        resolveEffect(
          propIndex,
          tipIndex,
          input.tipEffectMap,
          input.globalTipEffectMap ?? {}
        );

      const trailSources = resolveTrailSources3D(
        input.trailTrackingMode ??
          (resolvedTrails.trackingMode as TrackingMode),
        tipFrame.tips,
        rigCenter
      );
      for (const source of trailSources) {
        if (effectAt(source.effectTipIndex) !== "trails") continue;
        output.push({
          renderer: "trail",
          sourceId: `${input.performerId}:${propIndex}:${source.sourceId}`,
          sampleSequence: sequence,
          enabled: input.playing,
          position: worldPoint(
            source.position,
            input.effectSpaceMatrix
          ).toArray(),
          config: {
            maxPoints: resolvedTrails.maxPoints,
            width: resolvedTrails.tubeRadius,
            color: resolvedTrails.rainbow
              ? "rainbow"
              : propIndex === 0
                ? resolvedTrails.leftColor
                : resolvedTrails.rightColor,
            opacity: resolvedTrails.brightness,
            rainbow: resolvedTrails.rainbow,
            qualityTier: input.qualityTier,
            mode: "fade",
            fadeDuration: 2,
            emissiveStrength:
              resolvedTrails.emissive * trailTierBoost(input.qualityTier),
          },
        });
      }

      const ledAssigned = tipFrame.tips.some(
        (tip) => effectAt(tip.tipIndex) === "led"
      );
      if (!ledAssigned) continue;
      const isMoonFan =
        input.propBuild.fanBuild === "moon" &&
        (prop.propType === PropType.FAN || prop.propType === PropType.BIGFAN);

      if (isMoonFan && moonPattern) {
        output.push({
          renderer: "moon-fan",
          sourceId: `${input.performerId}:${propIndex}:moon-fan`,
          sampleSequence: sequence,
          enabled: true,
          worldCenter: worldPoint(rigCenter, input.effectSpaceMatrix).toArray(),
          worldRotation: rootRotation
            .clone()
            .multiply(prop.state.worldRotation)
            .toArray(),
          ledColors: stripColors(moonPattern, moonFrame),
          brightness,
          scale: prop.propType === PropType.BIGFAN ? 1.4 : 1,
        });
        continue;
      }

      if (resolvedLed.device.kind === "pixel-staff" && ledPattern) {
        const leftTip = tipFrame.tips.find((tip) => tip.tipIndex === 0);
        const rightTip = tipFrame.tips.find((tip) => tip.tipIndex === 1);
        const first = leftTip?.position ?? rigCenter;
        const last = rightTip?.position ?? leftTip?.position;
        if (!last) continue;
        const firstWorld = worldPoint(first, input.effectSpaceMatrix);
        const lastWorld = worldPoint(last, input.effectSpaceMatrix);
        const axis = lastWorld.clone().sub(firstWorld);
        const span = axis.length();
        if (span < 1e-6) continue;
        output.push({
          renderer: "pov",
          sourceId: `${input.performerId}:${propIndex}:pov`,
          sampleSequence: sequence,
          enabled: input.playing,
          qualityTier: input.qualityTier,
          ledCount,
          staffAxis: axis.normalize().toArray(),
          staffCenter: firstWorld.add(lastWorld).multiplyScalar(0.5).toArray(),
          staffHalfLength: span / 2,
          frameIndex: ledFrame,
          pattern: ledPattern,
          sampledAtSeconds: input.sampledAtMs / 1000,
          brightness,
          persistenceDuration: shutterToPovPersistence(
            resolvedLed.look.shutter
          ),
        });
        continue;
      }

      if (!ledPattern) continue;
      const tips: WorkerLedTipFrame[] = [];
      for (const tip of tipFrame.tips) {
        if (effectAt(tip.tipIndex) !== "led") continue;
        const color = getPixel(
          ledPattern,
          ledFrame,
          tip.tipIndex % ledPattern.ledCount
        );
        this.pushLedSamples({
          output: tips,
          state,
          key: `${propIndex}-${tip.tipIndex}`,
          current: tip.position,
          velocity: tip.velocity,
          speed: tip.speed,
          color,
          brightness,
          sampleCount: LED_SUPERSAMPLE_BY_TIER[input.qualityTier],
          transform: input.effectSpaceMatrix,
          linearTransform,
        });
      }
      output.push({
        renderer: "led",
        sourceId: `${input.performerId}:${propIndex}:led`,
        sampleSequence: sequence,
        enabled: input.playing,
        qualityTier: input.qualityTier,
        sampledAtSeconds: input.sampledAtMs / 1000,
        tips,
      });
    }

    return output;
  }

  removePerformer(performerId: string): void {
    const state = this.performers.get(performerId);
    state?.tipBridge.reset();
    state?.patternMaterializer.reset();
    state?.previousLedPositions.clear();
    this.performers.delete(performerId);
  }

  reset(): void {
    for (const performerId of this.performers.keys()) {
      this.removePerformer(performerId);
    }
    this.sampleSequence = 0;
  }

  private getPerformer(performerId: string): PerformerEffectState {
    let state = this.performers.get(performerId);
    if (!state) {
      state = performerState();
      this.performers.set(performerId, state);
    }
    return state;
  }

  private pushLedSamples(input: {
    output: WorkerLedTipFrame[];
    state: PerformerEffectState;
    key: string;
    current: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    speed: number;
    color: { r: number; g: number; b: number };
    brightness: number;
    sampleCount: number;
    transform: Matrix4;
    linearTransform: Matrix3;
  }): void {
    const previous = input.state.previousLedPositions.get(input.key);
    const count = previous ? input.sampleCount : 1;
    for (let index = 1; index <= count; index++) {
      const t = index / count;
      const local = previous
        ? previous
            .clone()
            .lerp(
              new Vector3(input.current.x, input.current.y, input.current.z),
              t
            )
        : new Vector3(input.current.x, input.current.y, input.current.z);
      const velocity = worldDirection(input.velocity, input.linearTransform);
      input.output.push({
        position: local.applyMatrix4(input.transform).toArray(),
        r: input.color.r / 255,
        g: input.color.g / 255,
        b: input.color.b / 255,
        brightness: input.brightness,
        velocity: velocity.toArray(),
        speed: velocity.length(),
      });
    }
    let cached = input.state.previousLedPositions.get(input.key);
    if (!cached) {
      cached = new Vector3();
      input.state.previousLedPositions.set(input.key, cached);
    }
    cached.set(input.current.x, input.current.y, input.current.z);
  }
}
