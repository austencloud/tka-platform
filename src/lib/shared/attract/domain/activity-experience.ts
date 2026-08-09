/**
 * General activity learning for the Ghost.
 *
 * Activities say what kind of result they want. This module measures the
 * result, remembers it, and retrieves similar episodes before the next choice.
 * No activity gets a private reward rule.
 */

import type {
  ActiveGhostActivity,
  GhostActivityEpisode,
  GhostActivityGoal,
  GhostActivityObservation,
  GhostActivityPrediction,
  GhostActivitySituation,
  GhostContext,
  GhostExperienceMemory,
  GhostSequenceBand,
  Intention,
} from "./intention";
import { evaluateActivityPrediction } from "./activity-prediction";

export const MAX_ACTIVITY_EPISODES = 200;
export const INITIAL_PREDICTION_WINDOW = 30;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sequenceBand(length: number): GhostSequenceBand {
  if (length === 0) return "empty";
  if (length < 4) return "fragment";
  if (length <= 10) return "formed";
  return "long";
}

export function activitySituation(ctx: GhostContext): GhostActivitySituation {
  return {
    moduleId: ctx.moduleId,
    tabId: ctx.tabId,
    sequenceBand: sequenceBand(ctx.sequenceLength),
    hasEffects: ctx.activeEffectIds.length > 0,
    galleryBudgetSpent: ctx.budgets.galleryOpens >= 8,
    cameraGranted: ctx.cameraGranted,
    capabilities: Object.entries(ctx.available)
      .filter(([, count]) => count > 0)
      .map(([kind]) => kind)
      .sort(),
  };
}

export function observeActivityWorld(
  ctx: GhostContext
): GhostActivityObservation {
  return {
    situation: activitySituation(ctx),
    sequenceLength: ctx.sequenceLength,
    sequenceWord: ctx.sequenceWord,
    effectIds: [...ctx.activeEffectIds].sort(),
    presentationRevision: ctx.playback.presentationRevision,
    understoodConcepts: [...ctx.concepts.values()].filter(
      (stage) => stage === "understood"
    ).length,
    encounteredControls: ctx.askedAbout.size,
  };
}

export function beginActivityExperience(
  memory: GhostExperienceMemory,
  activity: ActiveGhostActivity,
  goal: GhostActivityGoal,
  prediction: GhostActivityPrediction,
  ctx: GhostContext,
  now: number
): void {
  memory.active = {
    activityId: activity.id,
    variantId: activity.variantId,
    goal,
    startedAt: now,
    before: observeActivityWorld(ctx),
    prediction,
    successfulActions: 0,
    perceptions: 0,
    watchedPayoffs: 0,
    failedSteps: 0,
  };
}

export function observeActivityIntention(
  memory: GhostExperienceMemory,
  intention: Intention,
  ok: boolean,
  watchedPayoff: boolean
): void {
  const active = memory.active;
  if (!active) return;
  if (!ok) {
    active.failedSteps += 1;
    return;
  }
  if (intention.operation === "perceive") {
    active.perceptions += 1;
  } else if (
    intention.id !== "go-to-module" &&
    intention.id !== "escape-room"
  ) {
    active.successfulActions += 1;
  }
  if (watchedPayoff) active.watchedPayoffs += 1;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function achievementFor(
  goal: GhostActivityGoal,
  active: NonNullable<GhostExperienceMemory["active"]>,
  evidence: GhostActivityEpisode["evidence"]
): number {
  const changed =
    evidence.presentationChanged ||
    evidence.sequenceChanged ||
    evidence.effectsChanged;

  switch (goal) {
    case "make":
      return changed ? 1 : active.successfulActions > 0 ? 0.35 : 0;
    case "inspect":
      if (active.watchedPayoffs > 0) return 1;
      if (active.perceptions > 0) return 0.75;
      return active.successfulActions > 0 ? 0.5 : 0;
    case "discover":
      if (evidence.conceptsLearned > 0 || evidence.encountersLearned > 0)
        return 1;
      return active.successfulActions > 0 ? 0.65 : 0;
    case "correct":
      return changed ? 1 : active.successfulActions > 0 ? 0.5 : 0;
  }
}

function resultSignature(
  after: GhostActivityObservation,
  evidence: GhostActivityEpisode["evidence"]
): string {
  return JSON.stringify({
    moduleId: after.situation.moduleId,
    tabId: after.situation.tabId,
    sequenceLength: after.sequenceLength,
    sequenceWord: after.sequenceWord,
    effectIds: after.effectIds,
    conceptsLearned: evidence.conceptsLearned,
    encountersLearned: evidence.encountersLearned,
  });
}

export function finishActivityExperience(
  memory: GhostExperienceMemory,
  activity: ActiveGhostActivity,
  outcome: GhostActivityEpisode["outcome"],
  ctx: GhostContext,
  now: number
): GhostActivityEpisode | null {
  const active = memory.active;
  if (active?.activityId !== activity.id) return null;

  const after = observeActivityWorld(ctx);
  const evidence: GhostActivityEpisode["evidence"] = {
    presentationChanged:
      after.presentationRevision !== active.before.presentationRevision,
    sequenceChanged:
      after.sequenceLength !== active.before.sequenceLength ||
      after.sequenceWord !== active.before.sequenceWord,
    effectsChanged: !arraysEqual(after.effectIds, active.before.effectIds),
    conceptsLearned: Math.max(
      0,
      after.understoodConcepts - active.before.understoodConcepts
    ),
    encountersLearned: Math.max(
      0,
      after.encounteredControls - active.before.encounteredControls
    ),
  };
  const achievement = achievementFor(active.goal, active, evidence);
  const completionValue = outcome === "completed" ? 1 : 0;
  const signature = resultSignature(after, evidence);
  const identicalResults = memory.episodes.filter(
    (episode) =>
      episode.activityId === activity.id &&
      episode.resultSignature === signature
  ).length;
  const novelty = identicalResults === 0 ? 1 : 1 / (1 + identicalResults);
  // Novelty is part of worth, not just a side channel: reproducing an
  // identical result is worth less each time. This is the deterministic
  // negative-learning pressure — without it the world only ever rewards, and
  // the predictor's value forecasts have nothing real to be wrong about.
  const rawValue =
    achievement * 0.6 + completionValue * 0.2 + clamp01(novelty) * 0.2;
  const value = outcome === "completed" ? rawValue : Math.min(0.45, rawValue);
  const predictionEvaluation = evaluateActivityPrediction(active.prediction, {
    completion: outcome === "completed" ? 1 : 0,
    achievement: clamp01(achievement),
    presentationChange: evidence.presentationChanged ? 1 : 0,
    discovery:
      evidence.conceptsLearned > 0 || evidence.encountersLearned > 0 ? 1 : 0,
    novelty: clamp01(novelty),
    value: clamp01(value),
  });

  const episode: GhostActivityEpisode = {
    activityId: activity.id,
    variantId: active.variantId,
    goal: active.goal,
    situation: active.before.situation,
    outcome,
    startedAt: active.startedAt,
    endedAt: now,
    successfulActions: active.successfulActions,
    perceptions: active.perceptions,
    watchedPayoffs: active.watchedPayoffs,
    failedSteps: active.failedSteps,
    evidence,
    achievement: clamp01(achievement),
    novelty: clamp01(novelty),
    value: clamp01(value),
    prediction: active.prediction,
    predictionError: predictionEvaluation.error,
    predictionAccuracy: predictionEvaluation.accuracy,
    surprises: predictionEvaluation.surprises,
    resultSignature: signature,
  };

  memory.episodes.push(episode);
  if (memory.episodes.length > MAX_ACTIVITY_EPISODES) {
    memory.episodes.splice(0, memory.episodes.length - MAX_ACTIVITY_EPISODES);
  }
  memory.active = null;
  memory.last = episode;
  memory.recorded += 1;
  memory.valueTotal += episode.value;
  if (episode.value < 0.5) memory.lowValueEpisodes += 1;
  if (episode.value >= 0.8) memory.highValueEpisodes += 1;
  memory.predictionsRecorded += 1;
  memory.predictionErrorTotal += episode.predictionError;
  if (memory.initialPredictionCount < INITIAL_PREDICTION_WINDOW) {
    memory.initialPredictionCount += 1;
    memory.initialPredictionErrorTotal += episode.predictionError;
  }
  if (episode.predictionAccuracy >= 0.75) memory.accuratePredictions += 1;
  if (episode.prediction.confidence >= 0.6 && episode.predictionError >= 0.35) {
    memory.confidentMisses += 1;
  }
  return episode;
}
