import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

// Direct imports of all evaluators - no lazy initialization, no side effects
import { evaluateSolid, evaluateSplit, evaluateQuad } from "./solid";
import { evaluateBreathe, evaluatePulse, evaluateHeartbeat, evaluateColorMorph } from "./breathe";
import { evaluateChase, evaluateComet, evaluateWave, evaluateCascade } from "./chase";
import { evaluateRainbow, evaluateWarmShift, evaluateCoolShift, evaluateNeon } from "./spectrum";
import { evaluateSparkle, evaluateFlicker, evaluateAurora } from "./texture";
import { evaluateProximity, evaluateVelocity, evaluateMirrorSync, evaluateBeatPulse } from "./tka-aware";

export type PatternEvaluatorFn = (ctx: TipEvaluationContext) => LedColor;

/**
 * Explicit const registry. Populated at module load time.
 * No initializeRegistry() needed - anyone importing evaluatePattern()
 * gets a fully populated registry automatically.
 */
const EVALUATOR_REGISTRY: ReadonlyMap<string, PatternEvaluatorFn> = new Map([
  ["solid", evaluateSolid],
  ["split", evaluateSplit],
  ["quad", evaluateQuad],
  ["breathe", evaluateBreathe],
  ["pulse", evaluatePulse],
  ["heartbeat", evaluateHeartbeat],
  ["color-morph", evaluateColorMorph],
  ["chase", evaluateChase],
  ["comet", evaluateComet],
  ["wave", evaluateWave],
  ["cascade", evaluateCascade],
  ["rainbow", evaluateRainbow],
  ["warm-shift", evaluateWarmShift],
  ["cool-shift", evaluateCoolShift],
  ["neon", evaluateNeon],
  ["sparkle", evaluateSparkle],
  ["flicker", evaluateFlicker],
  ["aurora", evaluateAurora],
  ["proximity", evaluateProximity],
  ["velocity", evaluateVelocity],
  ["mirror-sync", evaluateMirrorSync],
  ["beat-pulse", evaluateBeatPulse],
]);

export function evaluatePattern(id: string, ctx: TipEvaluationContext): LedColor {
  const evaluator = EVALUATOR_REGISTRY.get(id);
  if (!evaluator) {
    return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
  }
  return evaluator(ctx);
}

export function hasPattern(id: string): boolean {
  return EVALUATOR_REGISTRY.has(id);
}
