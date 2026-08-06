/**
 * Scoring — the whole brain, and deliberately not clever
 * (spec: docs/superpowers/specs/2026-08-04-ghost-mind-design.md §Scoring).
 *
 *   final = appeal × novelty × freshness × momentum
 *
 * Novelty stops repetition, fatigue produces boredom ("I'm bored of doing
 * effects, let's see what this tunnel button is" emerges rather than being
 * scripted), momentum produces the chain of thought. Selection is
 * weighted-random over the top few, never argmax — argmax retraces an
 * identical tour every session, which is the exact failure this design exists
 * to avoid.
 *
 * Pure functions, no DOM, no runes: this is where the unit tests live.
 */

import {
  FOLLOWS,
  INTENTION_CATEGORIES,
  type GhostContext,
  type GhostMemory,
  type Intention,
  type IntentionCategory,
} from "./intention";
import type { Rng } from "../services/rng";
import type { Trail } from "../services/trail";

/** Fatigue added to a category each time one of its intentions performs. */
export const FATIGUE_GAIN = 0.35;
/**
 * Fatigue added by a `repeatable` intention. Much smaller, for the same reason
 * novelty is skipped: at the normal rate two steps in a row take `build`
 * freshness to 0.3 and the spree dies on the third — so the ghost could never
 * sit and make a sequence the way a person does.
 */
export const FATIGUE_GAIN_REPEATABLE = 0.08;
/** Fatigue bled off every category on every tick. */
export const FATIGUE_DECAY = 0.04;
/** Multiplier when a category naturally follows the last one. */
export const MOMENTUM_BONUS = 1.6;
/** The winner is drawn from this many best candidates, weighted by score. */
export const TOP_N = 5;

export interface ScoredIntention {
  intention: Intention;
  score: number;
}

export function createMemory(rng: Rng, trail: Trail): GhostMemory {
  return {
    performed: new Map(),
    visitedModules: new Set(),
    lastCategory: null,
    fatigue: new Map(INTENTION_CATEGORIES.map((c) => [c, 0])),
    moduleDwellMs: 0,
    askedAbout: new Set(),
    budgets: { galleryOpens: 0, invites: 0, lastInviteAt: 0, lastPayoffAt: 0 },
    barrenModules: new Set(),
    concepts: new Map(),
    conceptNotes: new Map(),
    rng,
    trail,
  };
}

export const noveltyOf = (ctx: GhostContext, id: string) =>
  1 / (1 + (ctx.performed.get(id) ?? 0));

export const freshnessOf = (ctx: GhostContext, category: IntentionCategory) =>
  Math.max(0, 1 - (ctx.fatigue.get(category) ?? 0));

export const momentumOf = (ctx: GhostContext, category: IntentionCategory) =>
  ctx.lastCategory && FOLLOWS[ctx.lastCategory].includes(category)
    ? MOMENTUM_BONUS
    : 1;

export function scoreIntention(intention: Intention, ctx: GhostContext): number {
  return (
    Math.max(0, intention.appeal(ctx)) *
    // An intention whose job is repetition (adding steps) must not be punished
    // for repeating — see Intention.repeatable. It brakes itself instead.
    (intention.repeatable ? 1 : noveltyOf(ctx, intention.id)) *
    freshnessOf(ctx, intention.category) *
    momentumOf(ctx, intention.category)
  );
}

/** Every satisfiable intention, best first. */
export function scoreAll(
  intentions: readonly Intention[],
  ctx: GhostContext,
): ScoredIntention[] {
  return intentions
    .filter((intention) => {
      try {
        return intention.can(ctx);
      } catch {
        // A sensor that throws must never take the loop down with it.
        return false;
      }
    })
    .map((intention) => ({ intention, score: scoreIntention(intention, ctx) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Weighted-random over the top N. Null when nothing is satisfiable. */
export function selectIntention(
  intentions: readonly Intention[],
  ctx: GhostContext,
): Intention | null {
  const candidates = scoreAll(intentions, ctx).slice(0, TOP_N);
  if (!candidates.length) return null;
  return ctx.rng.weighted(candidates, (c) => c.score)?.intention ?? null;
}

/** Bleed fatigue back toward zero. Called once per tick, before scoring. */
export function decayFatigue(memory: GhostMemory): void {
  for (const category of INTENTION_CATEGORIES) {
    const current = memory.fatigue.get(category) ?? 0;
    memory.fatigue.set(category, Math.max(0, current - FATIGUE_DECAY));
  }
}

/** Fold a performed intention into memory. */
export function remember(memory: GhostMemory, intention: Intention): void {
  memory.performed.set(intention.id, (memory.performed.get(intention.id) ?? 0) + 1);
  memory.fatigue.set(
    intention.category,
    Math.min(
      1,
      (memory.fatigue.get(intention.category) ?? 0) +
        (intention.repeatable ? FATIGUE_GAIN_REPEATABLE : FATIGUE_GAIN),
    ),
  );
  memory.lastCategory = intention.category;
}
