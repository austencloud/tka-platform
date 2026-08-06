/**
 * Counterfactual activity judgment for the Ghost.
 *
 * The predictor turns similar measured episodes into an explicit forecast,
 * then scores that forecast against the result. It is pure and session-local:
 * no activity-specific reward rules, model calls, or hidden persistence.
 */

import type {
  GhostActivityEpisode,
  GhostActivityGoal,
  GhostActivityId,
  GhostActivityPrediction,
  GhostActivityPredictionDimension,
  GhostActivitySituation,
  GhostExperienceMemory,
} from "./intention";

export const NEUTRAL_EXPECTED_VALUE = 0.72;
const MAX_RETRIEVED_EPISODES = 6;
const MIN_SIMILARITY = 0.55;
const SAME_GOAL_EVIDENCE_SCALE = 0.55;
const SURPRISE_THRESHOLD = 0.45;

interface PredictionVector {
  completion: number;
  achievement: number;
  presentationChange: number;
  discovery: number;
  novelty: number;
  value: number;
}

export type GhostActivityActualOutcome = PredictionVector;

export interface GhostActivityPredictionEvaluation {
  error: number;
  accuracy: number;
  surprises: GhostActivityPredictionDimension[];
}

const DIMENSIONS: readonly GhostActivityPredictionDimension[] = [
  "completion",
  "achievement",
  "presentationChange",
  "discovery",
  "novelty",
  "value",
];

const ERROR_WEIGHTS: Record<GhostActivityPredictionDimension, number> = {
  completion: 0.15,
  achievement: 0.25,
  presentationChange: 0.15,
  discovery: 0.15,
  novelty: 0.1,
  value: 0.2,
};

/** Cold-start beliefs describe goal shape while admitting zero confidence. */
const GOAL_PRIORS: Record<GhostActivityGoal, PredictionVector> = {
  make: {
    completion: 0.82,
    achievement: 0.62,
    presentationChange: 0.68,
    discovery: 0.08,
    novelty: 0.85,
    value: NEUTRAL_EXPECTED_VALUE,
  },
  inspect: {
    completion: 0.85,
    achievement: 0.68,
    presentationChange: 0.22,
    discovery: 0.16,
    novelty: 0.72,
    value: NEUTRAL_EXPECTED_VALUE,
  },
  discover: {
    completion: 0.78,
    achievement: 0.58,
    presentationChange: 0.18,
    discovery: 0.5,
    novelty: 0.9,
    value: NEUTRAL_EXPECTED_VALUE,
  },
  correct: {
    completion: 0.75,
    achievement: 0.55,
    presentationChange: 0.58,
    discovery: 0.08,
    novelty: 0.72,
    value: NEUTRAL_EXPECTED_VALUE,
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function jaccard(left: readonly string[], right: readonly string[]): number {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  const rightSet = new Set(right);
  const overlap = left.filter((value) => rightSet.has(value)).length;
  return overlap / union.size;
}

export function activitySituationSimilarity(
  left: GhostActivitySituation,
  right: GhostActivitySituation
): number {
  return (
    (left.moduleId === right.moduleId ? 0.25 : 0) +
    (left.tabId === right.tabId ? 0.1 : 0) +
    (left.sequenceBand === right.sequenceBand ? 0.2 : 0) +
    (left.hasEffects === right.hasEffects ? 0.1 : 0) +
    (left.galleryBudgetSpent === right.galleryBudgetSpent ? 0.1 : 0) +
    (left.cameraGranted === right.cameraGranted ? 0.05 : 0) +
    jaccard(left.capabilities, right.capabilities) * 0.2
  );
}

function episodeVector(episode: GhostActivityEpisode): PredictionVector {
  return {
    completion: episode.outcome === "completed" ? 1 : 0,
    achievement: episode.achievement,
    presentationChange: episode.evidence.presentationChanged ? 1 : 0,
    discovery:
      episode.evidence.conceptsLearned > 0 ||
      episode.evidence.encountersLearned > 0
        ? 1
        : 0,
    novelty: episode.novelty,
    value: episode.value,
  };
}

function blend(prior: number, learned: number, confidence: number): number {
  return clamp01(prior + (learned - prior) * confidence);
}

export function predictActivityOutcome(
  memory: GhostExperienceMemory,
  activityId: GhostActivityId,
  goal: GhostActivityGoal,
  situation: GhostActivitySituation
): GhostActivityPrediction {
  const prior = GOAL_PRIORS[goal];
  const eligible = memory.episodes
    .map((episode, index) => ({
      episode,
      similarity: activitySituationSimilarity(episode.situation, situation),
      recency: 1 / (1 + (memory.episodes.length - 1 - index) * 0.12),
    }))
    .filter(
      ({ episode, similarity }) =>
        episode.goal === goal && similarity >= MIN_SIMILARITY
    );
  const sameActivity = eligible.filter(
    ({ episode }) => episode.activityId === activityId
  );
  const source = sameActivity.length
    ? "activity"
    : eligible.length
      ? "goal"
      : "prior";
  const evidence = (sameActivity.length ? sameActivity : eligible)
    .sort(
      (left, right) =>
        right.similarity * right.recency - left.similarity * left.recency
    )
    .slice(0, MAX_RETRIEVED_EPISODES);

  if (!evidence.length) {
    return {
      activityId,
      goal,
      source: "prior",
      matches: 0,
      ...prior,
      confidence: 0,
      reliability: 0.5,
      uncertainty: 1,
    };
  }

  const evidenceScale = source === "activity" ? 1 : SAME_GOAL_EVIDENCE_SCALE;
  const totals: PredictionVector = {
    completion: 0,
    achievement: 0,
    presentationChange: 0,
    discovery: 0,
    novelty: 0,
    value: 0,
  };
  let totalWeight = 0;
  let weightedAccuracy = 0;
  for (const { episode, similarity, recency } of evidence) {
    const weight = similarity * similarity * recency * evidenceScale;
    const actual = episodeVector(episode);
    totalWeight += weight;
    weightedAccuracy += weight * episode.predictionAccuracy;
    for (const dimension of DIMENSIONS) {
      totals[dimension] += weight * actual[dimension];
    }
  }

  const sampleConfidence = clamp01(totalWeight / 2.2);
  const reliabilityEvidence = clamp01(totalWeight / 3);
  const observedAccuracy = weightedAccuracy / totalWeight;
  const reliability = clamp01(
    0.5 + (observedAccuracy - 0.5) * reliabilityEvidence
  );
  const transferScale = source === "activity" ? 1 : 0.58;
  const confidence = clamp01(
    sampleConfidence * transferScale * (0.65 + reliability * 0.35)
  );

  return {
    activityId,
    goal,
    source,
    matches: evidence.length,
    completion: blend(
      prior.completion,
      totals.completion / totalWeight,
      confidence
    ),
    achievement: blend(
      prior.achievement,
      totals.achievement / totalWeight,
      confidence
    ),
    presentationChange: blend(
      prior.presentationChange,
      totals.presentationChange / totalWeight,
      confidence
    ),
    discovery: blend(
      prior.discovery,
      totals.discovery / totalWeight,
      confidence
    ),
    novelty: blend(prior.novelty, totals.novelty / totalWeight, confidence),
    value: blend(prior.value, totals.value / totalWeight, confidence),
    confidence,
    reliability,
    uncertainty: 1 - confidence,
  };
}

/** Prediction may advise selection, but its total leverage remains bounded. */
export function activityPredictionMultiplier(
  prediction: GhostActivityPrediction
): number {
  const learnedValue =
    NEUTRAL_EXPECTED_VALUE +
    (prediction.value - NEUTRAL_EXPECTED_VALUE) * prediction.confidence;
  const valueSignal = (learnedValue - NEUTRAL_EXPECTED_VALUE) * 0.9;
  const explorationBonus = prediction.uncertainty * prediction.novelty * 0.06;
  const reliabilityPenalty =
    prediction.confidence * Math.max(0, 0.65 - prediction.reliability) * 0.08;
  return Math.max(
    0.75,
    Math.min(1.25, 1 + valueSignal + explorationBonus - reliabilityPenalty)
  );
}

export function evaluateActivityPrediction(
  prediction: GhostActivityPrediction,
  actual: GhostActivityActualOutcome
): GhostActivityPredictionEvaluation {
  let error = 0;
  const surprises: GhostActivityPredictionDimension[] = [];
  for (const dimension of DIMENSIONS) {
    const dimensionError = Math.abs(prediction[dimension] - actual[dimension]);
    error += dimensionError * ERROR_WEIGHTS[dimension];
    if (dimensionError >= SURPRISE_THRESHOLD) surprises.push(dimension);
  }
  const boundedError = clamp01(error);
  return {
    error: boundedError,
    accuracy: 1 - boundedError,
    surprises,
  };
}
