/**
 * The rule that turns measurements into a red, amber, or green cell.
 *
 * This is written down rather than felt out, for two reasons. A matrix that
 * colours cells by vibe cannot be argued with when someone disagrees about a
 * cell, and a UI that re-derives severity from raw numbers will drift from
 * whatever the engine believed. So the thresholds live here as one exported
 * table, every criterion is a named number with a warn and a fail value, and
 * the classification is a pure function a test can pin at each boundary.
 *
 * Every criterion is oriented so that larger is worse, and each reports a
 * ratio against its own failure threshold. Ratio 1 is exactly the failure
 * boundary, which makes the criteria comparable: the largest ratio names the
 * thing most responsible for the cell's colour, and the same number orders
 * phases inside a configuration to find its worst moment.
 */

import type { SweepPhaseSample, CollisionSeverity } from "./sweep-sample";

export type SweepSeverity = "pass" | "warn" | "fail" | "blocked";

export type SweepCriterionId =
  | "body-penetration"
  | "body-collision-kind"
  | "prop-overlap"
  | "grip-axis-error"
  | "grip-contact-offset"
  | "stance-yaw-error"
  | "prop-overrun"
  | "grip-convergence"
  | "reach-too-short"
  | "body-clip-ratio";

export interface SweepThreshold {
  id: SweepCriterionId;
  label: string;
  unit: string;
  warn: number;
  fail: number;
}

/**
 * Why these numbers.
 *
 * `body-penetration` is the measured depth of a prop or limb inside the body.
 * A graze at a couple of millimetres is the collision detector resolving a
 * near-touch and is not a defect; 5 mm is where a viewer starts to see the
 * shaft enter the silhouette, and 20 mm is unambiguous — the prop is inside
 * the performer.
 *
 * `body-collision-kind` carries the detector's own severity word so a shallow
 * but categorically wrong contact still colours the cell. A `graze` scores
 * below the warn line on purpose: a graze is not a failure the way a
 * penetration is.
 *
 * `prop-overlap` is one staff through the other. It is wrong, but it is two
 * held objects rather than a body, so its thresholds sit above the body ones.
 *
 * `grip-axis-error` is the angle between the hand's grip axis and the shaft.
 * Ten degrees reads as a slightly slack hand; twenty-five is a hand that is
 * plainly not holding the prop it is attached to.
 *
 * `grip-contact-offset` is the gap between the palm and the grip point the
 * prop is rendered at. Beyond 25 mm the prop floats off the hand; 60 mm is a
 * visible disconnection.
 *
 * `stance-yaw-error` is how much of the requested body turn the rig failed to
 * deliver. Eight degrees is within the animator's smoothing; twenty means the
 * turn the choreography asked for did not happen.
 *
 * `prop-overrun` is the configured prop length minus the longest prop this
 * measured body can hold inside its own converged hold. Any positive value is
 * already a body being asked to do something its arms do not allow.
 *
 * `grip-convergence` is how far two confirmation reads at the same held phase
 * disagreed about where the grips are. A converged solve reads the same twice.
 * Five millimetres of disagreement means it is still settling; fifteen means
 * it is not settling at all, and every other number from that phase is
 * untrustworthy.
 *
 * `body-clip-ratio` is the share of a configuration's phases that reached a
 * clip or worse against the body. One bad frame in a long sequence is a
 * moment to fix; one frame in five is a configuration that does not work.
 */
export const SWEEP_THRESHOLDS: Record<SweepCriterionId, SweepThreshold> = {
  "body-penetration": {
    id: "body-penetration",
    label: "Body penetration",
    unit: "mm",
    warn: 5,
    fail: 20,
  },
  "body-collision-kind": {
    id: "body-collision-kind",
    label: "Body collision kind",
    unit: "rank",
    warn: 0.5,
    fail: 1,
  },
  "prop-overlap": {
    id: "prop-overlap",
    label: "Prop through prop",
    unit: "mm",
    warn: 10,
    fail: 40,
  },
  "grip-axis-error": {
    id: "grip-axis-error",
    label: "Grip axis error",
    unit: "deg",
    warn: 10,
    fail: 25,
  },
  "grip-contact-offset": {
    id: "grip-contact-offset",
    label: "Grip contact offset",
    unit: "mm",
    warn: 25,
    fail: 60,
  },
  "stance-yaw-error": {
    id: "stance-yaw-error",
    label: "Stance yaw shortfall",
    unit: "deg",
    warn: 8,
    fail: 20,
  },
  "prop-overrun": {
    id: "prop-overrun",
    label: "Prop longer than body can hold",
    unit: "cm",
    warn: 0.0001,
    fail: 5,
  },
  "grip-convergence": {
    id: "grip-convergence",
    label: "Grip convergence spread",
    unit: "mm",
    warn: 5,
    fail: 15,
  },
  "reach-too-short": {
    id: "reach-too-short",
    label: "Reach below supported prop",
    unit: "flag",
    warn: 0.5,
    fail: 1,
  },
  "body-clip-ratio": {
    id: "body-clip-ratio",
    label: "Share of phases clipping the body",
    unit: "fraction",
    warn: 0.05,
    fail: 0.2,
  },
};

/**
 * The detector's severity words as a number the same shape as every other
 * criterion. `graze` deliberately lands below the warn line.
 */
const BODY_SEVERITY_VALUE: Record<CollisionSeverity, number> = {
  graze: 0.2,
  clip: 0.6,
  penetrate: 1,
};

export interface SweepCriterionScore {
  id: SweepCriterionId;
  value: number;
  /** `value / fail`, clamped at zero. One is exactly the failure boundary. */
  ratio: number;
  severity: SweepSeverity;
}

export interface SweepScore {
  severity: SweepSeverity;
  /** Largest criterion ratio. Orders phases and configurations by how bad they are. */
  score: number;
  /** The criterion holding that largest ratio: what to fix first. */
  dominant: SweepCriterionId | null;
  criteria: SweepCriterionScore[];
}

function scoreCriterion(
  id: SweepCriterionId,
  value: number | null
): SweepCriterionScore | null {
  if (value === null || !Number.isFinite(value)) return null;
  const threshold = SWEEP_THRESHOLDS[id];
  const clamped = Math.max(0, value);
  return {
    id,
    value,
    ratio: threshold.fail > 0 ? clamped / threshold.fail : 0,
    severity:
      clamped >= threshold.fail
        ? "fail"
        : clamped >= threshold.warn
          ? "warn"
          : "pass",
  };
}

const SEVERITY_RANK: Record<SweepSeverity, number> = {
  blocked: -1,
  pass: 0,
  warn: 1,
  fail: 2,
};

function combine(criteria: SweepCriterionScore[]): SweepScore {
  let severity: SweepSeverity = "pass";
  let score = 0;
  let dominant: SweepCriterionId | null = null;
  for (const criterion of criteria) {
    if (SEVERITY_RANK[criterion.severity] > SEVERITY_RANK[severity]) {
      severity = criterion.severity;
    }
    if (criterion.ratio > score) {
      score = criterion.ratio;
      dominant = criterion.id;
    }
  }
  return { severity, score, dominant, criteria };
}

/** Score one settled phase. Everything measurable at that phase, nothing else. */
export function scoreSweepSample(sample: SweepPhaseSample): SweepScore {
  const criteria = [
    scoreCriterion(
      "body-penetration",
      sample.collisions.deepestBodyPenetrationMm
    ),
    scoreCriterion(
      "body-collision-kind",
      sample.collisions.worstBodySeverity
        ? BODY_SEVERITY_VALUE[sample.collisions.worstBodySeverity]
        : null
    ),
    scoreCriterion("prop-overlap", sample.collisions.deepestPropPenetrationMm),
    scoreCriterion("grip-axis-error", sample.grip.axisErrorDeg),
    scoreCriterion("grip-contact-offset", sample.grip.contactOffsetMm),
    scoreCriterion("stance-yaw-error", sample.stance.yawErrorDeg),
    scoreCriterion("prop-overrun", sample.reach.propOverrunCm),
    scoreCriterion(
      "grip-convergence",
      sample.convergence.gripSeparationSpreadMm
    ),
    scoreCriterion("reach-too-short", sample.reach.reachTooShort ? 1 : 0),
  ].filter((criterion): criterion is SweepCriterionScore => criterion !== null);
  return combine(criteria);
}

/**
 * Share of a configuration's phases that clipped the body or worse. This is
 * the one criterion no single phase can express: a configuration that clips
 * once is different from one that clips constantly, and the matrix has to say
 * which it is.
 */
export function bodyClipRatio(samples: readonly SweepPhaseSample[]): number {
  if (samples.length === 0) return 0;
  const clipping = samples.filter((sample) => {
    const severity = sample.collisions.worstBodySeverity;
    return severity === "clip" || severity === "penetrate";
  }).length;
  return clipping / samples.length;
}

/**
 * Score a whole configuration from its settled phases.
 *
 * The colour is the worst of two things: the single worst phase, and how often
 * the body was being clipped across the whole sequence. A configuration with
 * too few settled samples is `blocked` rather than green — an unmeasured cell
 * that reads as passing is the exact lie this engine exists to avoid.
 */
export function scoreSweepConfiguration(
  samples: readonly SweepPhaseSample[],
  minimumSamples: number
): SweepScore {
  if (samples.length < minimumSamples) {
    return { severity: "blocked", score: 0, dominant: null, criteria: [] };
  }
  const worstSample = samples
    .map((sample) => scoreSweepSample(sample))
    .reduce<SweepScore | null>(
      (worst, current) =>
        !worst ||
        SEVERITY_RANK[current.severity] > SEVERITY_RANK[worst.severity] ||
        (SEVERITY_RANK[current.severity] === SEVERITY_RANK[worst.severity] &&
          current.score > worst.score)
          ? current
          : worst,
      null
    );
  const ratio = scoreCriterion("body-clip-ratio", bodyClipRatio(samples));
  const criteria = [...(worstSample?.criteria ?? [])];
  if (ratio) criteria.push(ratio);
  return combine(criteria);
}
