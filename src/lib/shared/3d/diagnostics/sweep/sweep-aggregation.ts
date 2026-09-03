/**
 * One configuration's settled phases, folded into the row a matrix renders and
 * the coordinate a click on that row navigates to.
 *
 * The point of a sweep is not a colour. It is an address: this body, holding
 * this prop, at this moment of this sequence, is where the solve breaks. So
 * every result carries its worst moment as structured coordinates that a lab
 * shell can format into whatever URL it uses, rather than a link this module
 * would have to guess the shape of.
 */

import type { SweepConfiguration } from "./sweep-space";
import type { SweepPhaseSample } from "./sweep-sample";
import {
  bodyClipRatio,
  scoreSweepConfiguration,
  scoreSweepSample,
  type SweepScore,
  type SweepSeverity,
} from "./sweep-scoring";

/** Where to point a viewer to see this failure with your own eyes. */
export interface SweepCoordinate {
  characterId: string;
  propId: string;
  propLengthCm: number;
  sequenceId: string;
  /** Continuous position in the sequence: the value a phase scrubber takes. */
  phase: number;
  /** The same moment as the rig reported it, for cross-checking a scrub. */
  stepNumber: number;
  beatProgress: number;
}

export interface SweepWorstMoment {
  coordinate: SweepCoordinate;
  sample: SweepPhaseSample;
  score: SweepScore;
}

export interface SweepConfigurationResult {
  key: string;
  configuration: SweepConfiguration;
  severity: SweepSeverity;
  score: SweepScore;
  /** Settled phases actually read. Blocked cells report what they managed. */
  sampledPhases: number;
  /** Phases the sampler could not settle, with the reason it gave. */
  unsettledPhases: number;
  blockedReason: string | null;
  collisionPhases: number;
  bodyClipRatio: number;
  deepestBodyPenetrationMm: number;
  deepestPropPenetrationMm: number;
  /** Distinct `zone:severity` kinds seen anywhere in this configuration. */
  collisionKinds: readonly string[];
  maxAxisErrorDeg: number | null;
  maxContactOffsetMm: number | null;
  maxStanceYawErrorDeg: number | null;
  maxGripConvergenceSpreadMm: number | null;
  propOverrunCm: number | null;
  maxHoldableLengthCm: number | null;
  reachMm: number | null;
  worstMoment: SweepWorstMoment | null;
  durationMs: number;
}

/** How many settled phases a configuration needs before it may be graded. */
export const MINIMUM_SETTLED_SAMPLES = 4;

function maxOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? Math.max(...present) : null;
}

/**
 * The moment worth looking at.
 *
 * Ranking by the same normalized score the colour uses means the worst moment
 * is always the phase that drove the verdict, so a reviewer who opens it sees
 * the thing the cell is complaining about rather than an unrelated wobble.
 */
export function selectWorstMoment(
  configuration: SweepConfiguration,
  samples: readonly SweepPhaseSample[]
): SweepWorstMoment | null {
  let worst: SweepWorstMoment | null = null;
  for (const sample of samples) {
    const score = scoreSweepSample(sample);
    if (worst && score.score <= worst.score.score) continue;
    worst = {
      sample,
      score,
      coordinate: {
        characterId: configuration.character.id,
        propId: configuration.prop.id,
        propLengthCm: configuration.prop.lengthCm,
        sequenceId: configuration.sequence.id,
        phase: sample.phase,
        stepNumber: sample.stepNumber,
        beatProgress: sample.beatProgress,
      },
    };
  }
  return worst;
}

export interface AggregateOptions {
  unsettledPhases?: number;
  blockedReason?: string | null;
  durationMs?: number;
  minimumSamples?: number;
}

export function aggregateConfiguration(
  configuration: SweepConfiguration,
  samples: readonly SweepPhaseSample[],
  options: AggregateOptions = {}
): SweepConfigurationResult {
  const minimumSamples = options.minimumSamples ?? MINIMUM_SETTLED_SAMPLES;
  const score = scoreSweepConfiguration(samples, minimumSamples);
  const kinds = new Set<string>();
  for (const sample of samples) {
    for (const kind of sample.collisions.kinds) kinds.add(kind);
  }

  return {
    key: configuration.key,
    configuration,
    severity: score.severity,
    score,
    sampledPhases: samples.length,
    unsettledPhases: options.unsettledPhases ?? 0,
    blockedReason:
      score.severity === "blocked"
        ? (options.blockedReason ??
          `only ${samples.length} of ${minimumSamples} required phases settled`)
        : (options.blockedReason ?? null),
    collisionPhases: samples.filter(
      (sample) => sample.collisions.eventCount > 0
    ).length,
    bodyClipRatio: bodyClipRatio(samples),
    deepestBodyPenetrationMm: Math.max(
      0,
      ...samples.map((sample) => sample.collisions.deepestBodyPenetrationMm)
    ),
    deepestPropPenetrationMm: Math.max(
      0,
      ...samples.map((sample) => sample.collisions.deepestPropPenetrationMm)
    ),
    collisionKinds: [...kinds].sort(),
    maxAxisErrorDeg: maxOrNull(samples.map((sample) => sample.grip.axisErrorDeg)),
    maxContactOffsetMm: maxOrNull(
      samples.map((sample) => sample.grip.contactOffsetMm)
    ),
    maxStanceYawErrorDeg: maxOrNull(
      samples.map((sample) => sample.stance.yawErrorDeg)
    ),
    maxGripConvergenceSpreadMm: maxOrNull(
      samples.map((sample) => sample.convergence.gripSeparationSpreadMm)
    ),
    // Reach is a property of the body, not the moment, so any settled sample
    // reports the same value. Taking the max keeps a still-loading first frame
    // from reporting a body with no arms.
    propOverrunCm: maxOrNull(samples.map((sample) => sample.reach.propOverrunCm)),
    maxHoldableLengthCm: maxOrNull(
      samples.map((sample) => sample.reach.maxHoldableLengthCm)
    ),
    reachMm: maxOrNull(samples.map((sample) => sample.reach.reachMm)),
    worstMoment: selectWorstMoment(configuration, samples),
    durationMs: options.durationMs ?? 0,
  };
}

export interface SweepAxisRollup {
  id: string;
  label: string;
  counts: Record<SweepSeverity, number>;
  worstScore: number;
}

/**
 * Which body, prop, or sequence is carrying the failures.
 *
 * A matrix with a hundred red cells is not actionable; "every red cell is on
 * ch07" is. Rolling the same results up along each axis answers that without
 * a second pass over the rig.
 */
export function rollUpByAxis(
  results: readonly SweepConfigurationResult[],
  axis: "character" | "prop" | "sequence"
): SweepAxisRollup[] {
  const rollups = new Map<string, SweepAxisRollup>();
  for (const result of results) {
    const member =
      axis === "character"
        ? {
            id: result.configuration.character.id,
            label: result.configuration.character.label,
          }
        : axis === "prop"
          ? {
              id: String(result.configuration.prop.id),
              label: result.configuration.prop.label,
            }
          : {
              id: result.configuration.sequence.id,
              label: result.configuration.sequence.label,
            };
    let rollup = rollups.get(member.id);
    if (!rollup) {
      rollup = {
        id: member.id,
        label: member.label,
        counts: { pass: 0, warn: 0, fail: 0, blocked: 0 },
        worstScore: 0,
      };
      rollups.set(member.id, rollup);
    }
    rollup.counts[result.severity] += 1;
    rollup.worstScore = Math.max(rollup.worstScore, result.score.score);
  }
  return [...rollups.values()].sort((a, b) => {
    if (b.counts.fail !== a.counts.fail) return b.counts.fail - a.counts.fail;
    if (b.counts.warn !== a.counts.warn) return b.counts.warn - a.counts.warn;
    return b.worstScore - a.worstScore;
  });
}
