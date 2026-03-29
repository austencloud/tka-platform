import type { LedColor } from "../types/LedPatterns";
import type { TipEvaluationContext } from "./context";

export type PatternEvaluatorFn = (ctx: TipEvaluationContext) => LedColor;

// Registry starts empty. Populated via initializeRegistry() called from LedPatterns.ts
// when all category files are available. No side-effect registration.
let EVALUATOR_REGISTRY: ReadonlyMap<string, PatternEvaluatorFn> = new Map();

/**
 * Called once to populate the registry with all evaluator imports.
 * Category files export pure functions. This file imports from them (not vice versa).
 */
export function initializeRegistry(entries: ReadonlyArray<[string, PatternEvaluatorFn]>): void {
  EVALUATOR_REGISTRY = new Map(entries);
}

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
