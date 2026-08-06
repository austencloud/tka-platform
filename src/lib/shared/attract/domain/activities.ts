/**
 * Activities give the Ghost enough commitment to finish a visible idea.
 *
 * Utility still decides what deserves attention. Once selected, an activity
 * owns a short list of the existing intentions until the list completes or a
 * required task becomes impossible. This is the same split the fish use:
 * context selects a behavior, then the behavior persists long enough to read
 * as one behavior instead of a new coin flip every frame.
 */

import type {
  ActiveGhostActivity,
  GhostActivityGoal,
  GhostActivityId,
  GhostActivityMemory,
  GhostActivityPrediction,
  GhostActivityStep,
  GhostContext,
} from "./intention";
import {
  activitySituation,
  beginActivityExperience,
} from "./activity-experience";
import {
  activityPredictionMultiplier,
  predictActivityOutcome,
} from "./activity-prediction";

export interface GhostActivityDefinition {
  id: GhostActivityId;
  goal: GhostActivityGoal;
  cooldownMs: number;
  can: (ctx: GhostContext) => boolean;
  appeal: (ctx: GhostContext) => number;
  plan: (ctx: GhostContext) => GhostActivityStep[];
}

export interface ScoredGhostActivity {
  definition: GhostActivityDefinition;
  baseScore: number;
  prediction: GhostActivityPrediction;
  predictionMultiplier: number;
  score: number;
}

const step = (
  intentionId: string,
  options: Omit<GhostActivityStep, "intentionId"> = {}
): GhostActivityStep => ({ intentionId, ...options });

const navigateToModule = (targetModuleId?: string): GhostActivityStep[] => [
  step("consider-navigation", { targetModuleId }),
  step("go-to-module", { targetModuleId }),
];

const navigateToTab = (targetTabId: string): GhostActivityStep[] => [
  step("consider-navigation", { targetTabId }),
  step("change-tab", { targetTabId }),
];

const has = (
  ctx: GhostContext,
  kind: keyof GhostContext["available"]
): boolean => (ctx.available[kind] ?? 0) > 0;

const activityCount = (ctx: GhostContext, id: GhostActivityId): number =>
  ctx.activities.completed.get(id) ?? 0;

const warmedUp = (ctx: GhostContext): boolean => ctx.performed.size >= 4;

function visitableModules(ctx: GhostContext): string[] {
  const excluded = new Set([
    "create",
    "browse",
    "library",
    "practice",
    "museum",
  ]);
  return ctx.reachableModules.filter(
    (id) =>
      id !== ctx.moduleId && !excluded.has(id) && !ctx.barrenModules.has(id)
  );
}

export const GHOST_ACTIVITIES: readonly GhostActivityDefinition[] = [
  {
    id: "compose",
    goal: "make",
    cooldownMs: 20_000,
    can: (ctx) =>
      ctx.moduleId === "create" &&
      ctx.tabId === "construct" &&
      ctx.sequenceLength < 8 &&
      (has(ctx, "start-position") || has(ctx, "option")),
    appeal: (ctx) => (ctx.hasSequence ? 0.82 : 1),
    plan: (ctx) => {
      const targetLength = 7 + ctx.rng.int(4);
      const currentLength = ctx.hasSequence ? ctx.sequenceLength : 1;
      const additions = Math.max(0, targetLength - currentLength);
      const steps: GhostActivityStep[] = [];
      if (!ctx.hasSequence) {
        steps.push(step("overwhelmed", { optional: true }), step("pick-start"));
      }
      for (let i = 0; i < additions; i++) {
        if (i === 2) steps.push(step("filter-continuous", { optional: true }));
        if (i === 4) steps.push(step("fiddle-turns", { optional: true }));
        steps.push(step("add-step"));
      }
      steps.push(step("play-it"));
      return steps;
    },
  },
  {
    id: "generate",
    goal: "make",
    cooldownMs: 70_000,
    can: (ctx) =>
      ctx.moduleId === "create" &&
      (ctx.tabId === "generate" || has(ctx, "nav-module")),
    appeal: (ctx) => (ctx.hasSequence ? 0.38 : 0.72),
    plan: (ctx) => [
      ...(ctx.tabId === "generate" ? [] : navigateToTab("generate")),
      ...(ctx.rng.next() < 0.55
        ? [step("change-the-recipe", { optional: true })]
        : []),
      step("generate-one"),
      step("play-it", { optional: true }),
      ...navigateToTab("construct"),
    ],
  },
  {
    id: "inspect",
    goal: "inspect",
    cooldownMs: 55_000,
    can: (ctx) =>
      ctx.moduleId === "create" &&
      ctx.hasSequence &&
      ctx.sequenceLength >= 4 &&
      !ctx.isPlaying &&
      has(ctx, "play") &&
      has(ctx, "step-nav"),
    appeal: () => 0.82,
    plan: (ctx) => [
      step("play-it", { optional: true }),
      ...(ctx.rng.next() < 0.35
        ? [step("pause-to-look", { optional: true })]
        : []),
      step("step-through-it"),
      ...(ctx.rng.next() < 0.65
        ? [step("change-the-view", { optional: true })]
        : []),
      ...(ctx.rng.next() < 0.45
        ? [
            step("scrub-back", { optional: true }),
            step("edit-one-step", { optional: true }),
          ]
        : []),
      ...(ctx.rng.next() < 0.35
        ? [step("change-tempo", { optional: true })]
        : []),
    ],
  },
  {
    id: "reconsider",
    goal: "correct",
    cooldownMs: 90_000,
    can: (ctx) =>
      has(ctx, "undo") &&
      ["add-step", "edit-one-step", "transform-it"].includes(
        ctx.lastIntentionId ?? ""
      ),
    appeal: () => 0.18,
    plan: () => [step("undo-that"), step("play-it", { optional: true })],
  },
  {
    id: "finish",
    goal: "make",
    cooldownMs: 75_000,
    can: (ctx) =>
      ctx.moduleId === "create" &&
      ctx.tabId === "construct" &&
      ctx.sequenceLength >= 4 &&
      ctx.sequenceLength <= 10 &&
      (has(ctx, "sequence-actions") ||
        has(ctx, "transform") ||
        has(ctx, "extend")),
    appeal: () => 0.78,
    plan: (ctx) => [
      step("open-sequence-actions", { optional: true }),
      ...(ctx.sequenceLength % 2 === 0
        ? [step("extend-it", { optional: true })]
        : []),
      step("transform-it", { optional: true }),
      step("play-it", { optional: true }),
    ],
  },
  {
    id: "style",
    goal: "make",
    cooldownMs: 65_000,
    can: (ctx) => ctx.hasSequence && has(ctx, "effect"),
    appeal: () => 0.58,
    plan: (ctx) => [
      step("try-effect"),
      step("tune-effect", { optional: true }),
      step("play-it", { optional: true }),
      step("linger", { optional: true }),
      ...(ctx.rng.next() < 0.35
        ? [step("reject-effect", { optional: true })]
        : []),
    ],
  },
  {
    id: "change-prop",
    goal: "make",
    cooldownMs: 85_000,
    can: (ctx) => ctx.hasSequence && has(ctx, "prop-picker"),
    appeal: () => 0.42,
    plan: () => [
      step("open-props"),
      step("try-prop"),
      step("play-it", { optional: true }),
    ],
  },
  {
    id: "practice",
    goal: "inspect",
    cooldownMs: 150_000,
    can: (ctx) => ctx.hasSequence && ctx.cameraGranted && has(ctx, "practice"),
    appeal: () => 0.28,
    plan: () => [
      step("try-practice"),
      step("linger", { optional: true }),
      step("leave-practice"),
    ],
  },
  {
    id: "viewer",
    goal: "inspect",
    cooldownMs: 120_000,
    can: (ctx) => ctx.hasSequence && !ctx.viewerOpen && has(ctx, "viewer"),
    appeal: () => 0.38,
    plan: () => [
      step("open-viewer"),
      step("play-it", { optional: true }),
      step("linger", { optional: true }),
      step("leave-viewer"),
    ],
  },
  {
    id: "browse",
    goal: "discover",
    cooldownMs: 160_000,
    can: (ctx) =>
      warmedUp(ctx) &&
      (ctx.moduleId === "library" || ctx.lastIntentionId !== "go-to-module") &&
      (ctx.moduleId === "library" || ctx.reachableModules.includes("library")),
    appeal: (ctx) => 0.32 + Math.min(0.18, ctx.moduleDwellMs / 600_000),
    plan: (ctx) => [
      ...(ctx.moduleId === "library" ? [] : navigateToModule("library")),
      step("filter-the-library"),
      step("browse-gallery"),
      step("jump-to-section", { optional: true }),
      // After the Firestore budget is spent, Library stays a place to browse
      // without becoming permission to keep opening paid records forever.
      step("open-someone-elses", { optional: true }),
      step("clear-the-filters", { optional: true }),
      ...navigateToModule("create"),
    ],
  },
  {
    id: "visit",
    goal: "discover",
    cooldownMs: 110_000,
    can: (ctx) =>
      warmedUp(ctx) &&
      ctx.lastIntentionId !== "go-to-module" &&
      visitableModules(ctx).length > 0,
    appeal: () => 0.25,
    plan: () => [
      ...navigateToModule(),
      step("take-in-the-room"),
      step("what-is-this-button", { optional: true }),
      step("overwhelmed", { optional: true }),
      ...navigateToModule("create"),
    ],
  },
  {
    id: "museum",
    goal: "inspect",
    cooldownMs: 360_000,
    can: (ctx) =>
      warmedUp(ctx) &&
      ctx.lastIntentionId !== "go-to-module" &&
      ctx.moduleId !== "museum" &&
      ctx.reachableModules.includes("museum") &&
      (ctx.performed.get("let-it-show-me") ?? 0) === 0,
    appeal: () => 0.2,
    plan: () => [...navigateToModule("museum"), step("let-it-show-me")],
  },
  {
    id: "reset",
    goal: "make",
    cooldownMs: 100_000,
    can: (ctx) =>
      ctx.sequenceLength >= 6 &&
      has(ctx, "clear") &&
      ctx.trail.lastAt() - ctx.budgets.lastPayoffAt > 60_000,
    // Once the one-minute payoff embargo has genuinely elapsed, beginning a
    // new piece should compete with the strongest ordinary activities. Tying
    // this to module dwell made Reset impossible immediately after returning
    // from a long museum visit, which was the only natural quiet window.
    appeal: () => 0.7,
    plan: () => [step("clear-and-restart")],
  },
  {
    id: "admire",
    goal: "inspect",
    cooldownMs: 80_000,
    can: (ctx) => ctx.lingerCount > 0,
    appeal: () => 0.32,
    plan: () => [step("linger")],
  },
] as const;

/** Intentions whose order is owned by an activity rather than the fallback bag. */
export const ACTIVITY_INTENTION_IDS = new Set<string>([
  "pick-start",
  "add-step",
  "filter-continuous",
  "fiddle-turns",
  "play-it",
  "pause-to-look",
  "consider-navigation",
  "change-tab",
  "change-the-recipe",
  "generate-one",
  "step-through-it",
  "change-the-view",
  "scrub-back",
  "edit-one-step",
  "change-tempo",
  "undo-that",
  "open-sequence-actions",
  "extend-it",
  "transform-it",
  "try-effect",
  "tune-effect",
  "linger",
  "reject-effect",
  "open-props",
  "try-prop",
  "try-practice",
  "leave-practice",
  "open-viewer",
  "leave-viewer",
  "go-to-module",
  "take-in-the-room",
  "filter-the-library",
  "browse-gallery",
  "jump-to-section",
  "open-someone-elses",
  "clear-the-filters",
  "what-is-this-button",
  "overwhelmed",
  "let-it-show-me",
  "clear-and-restart",
]);

export function scoreActivities(
  definitions: readonly GhostActivityDefinition[],
  ctx: GhostContext,
  now: number
): ScoredGhostActivity[] {
  return definitions
    .filter((definition) => {
      try {
        if (!definition.can(ctx)) return false;
        const lastEndedAt = ctx.activities.lastEndedAt.get(definition.id);
        return (
          lastEndedAt === undefined ||
          now - lastEndedAt >= definition.cooldownMs
        );
      } catch {
        return false;
      }
    })
    .map((definition) => {
      const baseScore =
        Math.max(0, Math.min(1, definition.appeal(ctx))) /
        (1 + activityCount(ctx, definition.id));
      const prediction = predictActivityOutcome(
        ctx.experience,
        definition.id,
        definition.goal,
        activitySituation(ctx)
      );
      const predictionMultiplier = activityPredictionMultiplier(prediction);
      return {
        definition,
        baseScore,
        prediction,
        predictionMultiplier,
        score: baseScore * predictionMultiplier,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}

export function startNextActivity(
  definitions: readonly GhostActivityDefinition[],
  ctx: GhostContext,
  now: number
): ActiveGhostActivity | null {
  const candidates = scoreActivities(definitions, ctx, now).slice(0, 4);
  const selected = ctx.rng.weighted(candidates, (candidate) => candidate.score);
  if (!selected) return null;
  const steps = selected.definition.plan(ctx);
  if (!steps.length) return null;
  const activity: ActiveGhostActivity = {
    id: selected.definition.id,
    steps,
    stepIndex: 0,
    startedAt: now,
  };
  ctx.activities.current = activity;
  ctx.experience.lastPrediction = {
    prediction: selected.prediction,
    multiplier: selected.predictionMultiplier,
  };
  if (selected.prediction.source !== "prior") {
    ctx.experience.informedSelections += 1;
    if (selected.predictionMultiplier > 1) {
      ctx.experience.boostedSelections += 1;
    } else if (selected.predictionMultiplier < 1) {
      ctx.experience.reducedSelections += 1;
    }
  }
  if (selected.prediction.uncertainty >= 0.65) {
    ctx.experience.exploratorySelections += 1;
  }
  beginActivityExperience(
    ctx.experience,
    activity,
    selected.definition.goal,
    selected.prediction,
    ctx,
    now
  );
  return activity;
}

export function currentActivityStep(
  memory: GhostActivityMemory
): GhostActivityStep | null {
  const activity = memory.current;
  return activity?.steps[activity.stepIndex] ?? null;
}

function endActivity(
  memory: GhostActivityMemory,
  outcome: "completed" | "abandoned",
  now: number
): ActiveGhostActivity | null {
  const activity = memory.current;
  if (!activity) return null;
  const counts = memory[outcome];
  counts.set(activity.id, (counts.get(activity.id) ?? 0) + 1);
  memory.lastEndedAt.set(activity.id, now);
  memory.current = null;
  return activity;
}

export function advanceActivity(
  memory: GhostActivityMemory,
  now: number
): ActiveGhostActivity | null {
  const activity = memory.current;
  if (!activity) return null;
  activity.stepIndex += 1;
  if (activity.stepIndex >= activity.steps.length) {
    return endActivity(memory, "completed", now);
  }
  return null;
}

export function abandonActivity(
  memory: GhostActivityMemory,
  now: number
): ActiveGhostActivity | null {
  return endActivity(memory, "abandoned", now);
}
