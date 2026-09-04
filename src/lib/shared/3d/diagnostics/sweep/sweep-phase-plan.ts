/**
 * Which phases of a sequence a sweep actually looks at, and how it decides to
 * look closer.
 *
 * A settled reading is expensive — the rig has to be seeked, left alone long
 * enough for the solve to converge, then read twice to prove it did. Sampling
 * every frame of every configuration would take weeks of wall time, so a run
 * takes a coarse pass first and only spends fine samples around the phases the
 * coarse pass found suspicious. Pure arithmetic; no rig involved.
 */

/** A phase is a continuous position in the sequence: `[0, stepCount)`. */
export type Phase = number;

export interface SweepPhasePlan {
  /** Coarse readings per step. Four is one per quarter of a step. */
  coarseSamplesPerStep: number;
  /** Fine readings per step, used only inside a refinement window. */
  fineSamplesPerStep: number;
  /**
   * How far either side of a suspicious coarse phase the fine pass looks, in
   * steps. Wide enough to bracket the neighbouring coarse samples so the true
   * worst moment cannot hide between them.
   */
  refinementRadiusSteps: number;
  /**
   * Coarse severity score above which a phase earns a fine pass. Scores are
   * the normalized ratios produced by `sweep-scoring`, where 1 is the failure
   * threshold, so 0.5 refines anything already halfway to a failure.
   */
  refinementScoreThreshold: number;
  /** Ceiling on fine readings per configuration, so one bad cell cannot stall a run. */
  maxRefinementSamples: number;
}

export const DEFAULT_SWEEP_PHASE_PLAN: SweepPhasePlan = {
  coarseSamplesPerStep: 4,
  fineSamplesPerStep: 16,
  refinementRadiusSteps: 0.25,
  refinementScoreThreshold: 0.5,
  maxRefinementSamples: 24,
};

function roundPhase(phase: number): number {
  return Math.round(phase * 1e6) / 1e6;
}

/**
 * Evenly spaced phases across the whole sequence. The last sample stops just
 * short of `stepCount` because the phase axis wraps: phase `stepCount` is the
 * same frame as phase 0.
 */
export function planCoarsePhases(
  stepCount: number,
  samplesPerStep: number
): Phase[] {
  if (stepCount <= 0 || samplesPerStep <= 0) return [];
  const total = Math.max(1, Math.round(stepCount * samplesPerStep));
  const spacing = stepCount / total;
  const phases: Phase[] = [];
  for (let index = 0; index < total; index += 1) {
    phases.push(roundPhase(index * spacing));
  }
  return phases;
}

export interface ScoredPhase {
  phase: Phase;
  score: number;
}

/**
 * Extra phases to read around whichever coarse samples looked bad. Windows
 * that overlap are merged before sampling so a run of consecutive suspicious
 * phases costs one sweep of that span rather than one per phase.
 */
export function planRefinementPhases(
  coarse: readonly ScoredPhase[],
  stepCount: number,
  plan: SweepPhasePlan = DEFAULT_SWEEP_PHASE_PLAN
): Phase[] {
  if (stepCount <= 0) return [];
  const suspicious = coarse
    .filter((sample) => sample.score >= plan.refinementScoreThreshold)
    .sort((a, b) => a.phase - b.phase);
  if (suspicious.length === 0) return [];

  const windows: Array<{ start: number; end: number }> = [];
  for (const sample of suspicious) {
    const start = Math.max(0, sample.phase - plan.refinementRadiusSteps);
    const end = Math.min(stepCount, sample.phase + plan.refinementRadiusSteps);
    const last = windows.at(-1);
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
      continue;
    }
    windows.push({ start, end });
  }

  const alreadyRead = new Set(coarse.map((sample) => roundPhase(sample.phase)));
  const spacing = 1 / plan.fineSamplesPerStep;
  const phases: Phase[] = [];
  for (const window of windows) {
    for (
      let phase = window.start;
      phase <= window.end + 1e-9;
      phase += spacing
    ) {
      const rounded = roundPhase(Math.min(phase, stepCount - 1e-6));
      if (rounded < 0) continue;
      if (alreadyRead.has(rounded)) continue;
      alreadyRead.add(rounded);
      phases.push(rounded);
      if (phases.length >= plan.maxRefinementSamples) return phases;
    }
  }
  return phases;
}

export interface SweepCostEstimate {
  configurations: number;
  /** Coarse readings the run is certain to take. */
  coarseSamples: number;
  /** Fine readings, if every configuration hits the refinement ceiling. */
  worstCaseRefinementSamples: number;
  /** Seconds for the coarse pass alone. */
  coarseSeconds: number;
  /** Seconds if every configuration refines to the ceiling. */
  worstCaseSeconds: number;
}

/**
 * What this run will actually cost, before it starts.
 *
 * The whole point of a matrix view is that someone can ask for one and be told
 * "that is nine hours" instead of watching a tab wedge. `secondsPerSample` is
 * the settle-plus-confirm cost from `sweep-settling`, not a guess.
 */
export function estimateSweepCost(
  sequenceStepCounts: readonly number[],
  characterCount: number,
  propCount: number,
  secondsPerSample: number,
  plan: SweepPhasePlan = DEFAULT_SWEEP_PHASE_PLAN
): SweepCostEstimate {
  const bodies = Math.max(0, characterCount) * Math.max(0, propCount);
  const coarsePerSequence = sequenceStepCounts.map(
    (stepCount) => planCoarsePhases(stepCount, plan.coarseSamplesPerStep).length
  );
  const coarseSamples =
    bodies * coarsePerSequence.reduce((total, count) => total + count, 0);
  const configurations = bodies * sequenceStepCounts.length;
  const worstCaseRefinementSamples = configurations * plan.maxRefinementSamples;
  return {
    configurations,
    coarseSamples,
    worstCaseRefinementSamples,
    coarseSeconds: coarseSamples * secondsPerSample,
    worstCaseSeconds:
      (coarseSamples + worstCaseRefinementSamples) * secondsPerSample,
  };
}
