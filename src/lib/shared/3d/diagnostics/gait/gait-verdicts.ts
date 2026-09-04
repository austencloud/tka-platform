/**
 * Gait verdicts
 *
 * What each measurement should look like on a human, in one place, because
 * two surfaces read it: the readout's table and the overlay's per-performer
 * chips. Ranges are ordinary walking-gait figures — this is a diagnostic, so
 * being outside them is information, not a failure of the instrument.
 */

import type { GaitReport } from "./gait-analysis";

export type Verdict = "good" | "warn" | "bad" | "none";
export type GaitReportScope = "gait" | "arrival";
export type GaitManeuverProfile =
  | "walk"
  | "run"
  | "lateral"
  | "crossover"
  | "turn-in-place";

export interface VerdictRow {
  name: string;
  value: string;
  unit: string;
  human: string;
  verdict: Verdict;
  /** What the number means when it is wrong. */
  tell: string;
}

/** cm, one decimal, always the same width so nothing shuffles. */
const cm = (m: number) => (m * 100).toFixed(1);
const pct = (x: number) => (x * 100).toFixed(0);

function band(
  value: number,
  good: [number, number],
  warn: [number, number]
): Verdict {
  if (value >= good[0] && value <= good[1]) return "good";
  if (value >= warn[0] && value <= warn[1]) return "warn";
  return "bad";
}

/**
 * Ground speed the gait itself reports, m/s.
 *
 * Cadence times step length is the distance the feet actually covered, so this
 * is the speed the instrument saw rather than the one the host commanded. A
 * clip played at the wrong rate shows up as a disagreement between the two
 * instead of being smuggled in as truth.
 */
const paceOf = (r: GaitReport) => (r.cadence / 60) * r.meanStepLength;

/**
 * The pace the walking bands were authored at, m/s.
 *
 * Measured, not assumed: the lab's own steady walk on x-bot reads 98 steps a
 * minute at 77cm, which is this. The kinematic ceilings below were calibrated
 * against that walk, so a faster gait is compared to them by how much faster
 * it is going rather than to the raw number.
 */
const WALK_BAND_PACE = 1.26;

/**
 * Whether a knee bends like a knee, which is true of every maneuver.
 *
 * Cadence and step length are walking norms, so they have to be swapped out or
 * dropped when the character is running, stepping sideways or pivoting. These
 * three are not norms, they are anatomy: there is no gait in which a knee is
 * allowed to fold sideways. They stay in every profile.
 */
const ANATOMY_METRICS = [
  "Knee bend plane",
  "Knee sideways offset",
  "Knee bends backward",
] as const;

/**
 * Below this share of frames the knee was too straight to have a bend
 * direction at all, so the angles above would be a handful of moments rather
 * than a reading. Reporting them anyway is how a projection artefact becomes a
 * verdict.
 */
const MIN_ANATOMY_COVERAGE = 0.25;

/**
 * The same measurements, read against running instead of walking.
 *
 * Running is not walking played faster. It trades double support for a flight
 * phase, so the four rows that describe the shape of a gait cycle - cadence,
 * step length, duty factor, double support - have different human ranges, and
 * grading a run against walking figures turns four correct readings red. Duty
 * factor is the definition itself: below 0.5 there is a flight phase and the
 * character is running, whatever clip is playing.
 *
 * The kinematic ceilings are a different problem. Those were calibrated in
 * this lab at a walk, and both scale with pace. Measured on x-bot on the
 * circle: going from 1.26 m/s to 3.95 m/s (x3.13) moved knee jerk from 2111
 * to 6251 (x2.96) and the worst joint acceleration from 106 to 297 (x2.80).
 * Scaling them by measured pace keeps a run and a walk of equal quality on the
 * same verdict, instead of failing every run for being a run.
 *
 * Foot slip is deliberately NOT scaled. A four-centimetre slide is visible at
 * any stride length, and the same walk measures 7.1cm on this pattern, so that
 * band is already reporting the pattern's turning ground rather than the gait.
 */
function runRows(rows: VerdictRow[], r: GaitReport): VerdictRow[] {
  const kinematic = Math.max(1, paceOf(r) / WALK_BAND_PACE);
  const jerkGood = 1500 * kinematic;
  const joltGood = 300 * kinematic;
  const overrides = new Map<
    string,
    Omit<VerdictRow, "name" | "value" | "unit">
  >([
    [
      "Cadence",
      {
        human: "155 to 185",
        verdict: band(r.cadence, [150, 200], [135, 230]),
        tell: "steps per minute at a run; distance runners cluster near 175",
      },
    ],
    [
      "Step length",
      {
        human: "110 to 160",
        verdict: band(r.meanStepLength, [1.0, 1.8], [0.8, 2.2]),
        tell: "heel strike to the other foot's, about double a walking step",
      },
    ],
    [
      "Duty factor",
      {
        human: "0.25 to 0.40",
        verdict: band(r.dutyFactor, [0.22, 0.45], [0.18, 0.5]),
        tell: "share of a stride each foot is down; 0.5 or more is not a run",
      },
    ],
    [
      "Double support",
      {
        human: "0",
        verdict: band(r.doubleSupportFraction, [0, 0.02], [0, 0.08]),
        tell: "a run has none - the overlap becomes flight, so anything here is a fast walk",
      },
    ],
    [
      "Knee jerk",
      {
        human: `under ${Math.round(jerkGood)}`,
        verdict: band(r.kneeJerkRms, [0, jerkGood], [0, 4000 * kinematic]),
        tell: "RMS knee acceleration, against the walk ceiling scaled by this run's pace",
      },
    ],
    [
      "Worst teleport",
      {
        human: `under ${Math.round(joltGood)}`,
        verdict: r.peakJoltJoint
          ? band(r.peakJolt, [0, joltGood], [0, 900 * kinematic])
          : "none",
        tell: `worst single-frame jump was ${cm(r.peakJoltStep)}cm in one frame`,
      },
    ],
    [
      "Knee twitches",
      {
        human: "not measurable at a run",
        verdict: "none",
        tell: `the fixed 4000 deg/s2 pop detector sits below this run's own ${Math.round(r.kneeJerkRms)} RMS, so it counts the stride itself - read Knee jerk instead`,
      },
    ],
  ]);
  return rows.map((row) => {
    const over = overrides.get(row.name);
    return over ? { ...row, ...over } : row;
  });
}

export function verdictRows(
  report: GaitReport | null,
  scope: GaitReportScope = "gait",
  maneuver: GaitManeuverProfile = "walk"
): VerdictRow[] {
  const r = report;
  if (!r || r.stances.length === 0) return [];
  const anatomyMeasured =
    r.anatomy.minConditionedFraction >= MIN_ANATOMY_COVERAGE;
  const rows = [
    {
      name: "Foot slip per step",
      value: cm(r.meanSlip),
      unit: "cm",
      human: "under 2",
      verdict: band(r.meanSlip, [0, 0.02], [0, 0.05]),
      tell: "ground a planted foot covered while it was bearing weight",
    },
    {
      name: "Slip share of step",
      value: pct(r.slipRatio),
      unit: "%",
      human: "under 15",
      verdict: band(r.slipRatio, [0, 0.15], [0, 0.3]),
      tell: "how much of each step was skating rather than stepping",
    },
    {
      name: "Cadence",
      value: r.cadence.toFixed(0),
      unit: "steps/min",
      human: "100 to 120",
      verdict: band(r.cadence, [95, 125], [80, 145]),
      tell: "steps per minute at a normal walk",
    },
    {
      name: "Step length",
      value: cm(r.meanStepLength),
      unit: "cm",
      human: "60 to 80",
      verdict: band(r.meanStepLength, [0.55, 0.85], [0.4, 1.0]),
      tell: "distance from one heel strike to the other foot's",
    },
    {
      name: "Step length spread",
      value: cm(r.stepLengthSpread),
      unit: "cm",
      human: "varies with intent",
      verdict: r.stepLengthSpread < 0.02 ? "warn" : "good",
      tell: "near zero means every step is the same size, forever",
    },
    {
      name: "Duty factor",
      value: r.dutyFactor.toFixed(2),
      unit: "",
      human: "0.55 to 0.65",
      verdict: band(r.dutyFactor, [0.55, 0.68], [0.48, 0.78]),
      tell: "share of a stride each foot spends on the floor",
    },
    {
      name: "Double support",
      value: pct(r.doubleSupportFraction),
      unit: "%",
      human: "15 to 25",
      verdict: band(r.doubleSupportFraction, [0.13, 0.28], [0.05, 0.4]),
      tell: "time both feet share the load; zero means it never transfers",
    },
    {
      name: "Heel lift in stance",
      value: r.hasToes ? cm(r.peakHeelLift) : "--",
      unit: "cm",
      human: "under 2 mid-stance",
      verdict: r.hasToes ? band(r.peakHeelLift, [0, 0.02], [0, 0.05]) : "none",
      tell: "how far the heel peeled off the floor while carrying weight",
    },
    {
      name: "...and how far behind",
      value: r.hasToes ? cm(r.heelLiftBehindHips) : "--",
      unit: "cm",
      human: "behind the pelvis at toe-off only",
      verdict: "none",
      tell: "positive is the heel kicking up behind the character",
    },
    {
      name: "Joint teleports",
      value: r.joltsPerSecond.toFixed(1),
      unit: "/s",
      human: "0",
      verdict: band(r.joltsPerSecond, [0, 0], [0, 0.5]),
      tell: "a joint arriving in one frame instead of travelling there",
    },
    {
      name: "Worst teleport",
      value: r.peakJoltJoint
        ? `${Math.round(r.peakJolt)} (${r.peakJoltJoint})`
        : "--",
      unit: "m/s2",
      human: "under 300",
      verdict: r.peakJoltJoint ? band(r.peakJolt, [0, 300], [0, 900]) : "none",
      tell: `worst single-frame jump was ${cm(r.peakJoltStep)}cm in one frame`,
    },
    {
      name: "Leg self-crossing",
      value: pct(r.legCrossingFraction),
      unit: "%",
      human: "0",
      verdict: band(r.legCrossingFraction, [0, 0], [0, 0.01]),
      tell: `feet reversed the thighs' left/right order; worst margin ${cm(r.minimumLegOrderMargin)}cm`,
    },
    {
      name: "Knee twitches",
      value: r.twitchesPerSecond.toFixed(1),
      unit: "/s",
      human: "0",
      verdict: band(r.twitchesPerSecond, [0, 0.2], [0, 1]),
      tell: "knee direction changes too fast for a muscle",
    },
    {
      name: "Knee jerk",
      value: Math.round(r.kneeJerkRms).toString(),
      unit: "deg/s2",
      human: "under 1500",
      verdict: band(r.kneeJerkRms, [0, 1500], [0, 4000]),
      tell: "RMS of how abruptly the knee changes speed",
    },
    {
      name: "Cycling on the spot",
      value: r.inPlaceCyclingSeconds.toFixed(2),
      unit: "s",
      human: "0",
      verdict: band(r.inPlaceCyclingSeconds, [0, 0.05], [0, 0.3]),
      tell: "feet still walking while the body is going nowhere",
    },
    {
      name: "Weight sway",
      value: cm(r.weightShiftAmplitude),
      unit: "cm",
      human: "6 to 10",
      verdict: band(r.weightShiftAmplitude, [0.05, 0.12], [0.03, 0.18]),
      tell: "how far the pelvis travels across each support foot",
    },
    {
      name: "Body over the foot",
      value: pct(r.overSupportFraction),
      unit: "%",
      human: "over 60",
      verdict: band(r.overSupportFraction, [0.6, 1], [0.35, 1]),
      tell: "share of single support with the body actually above the leg",
    },
    {
      name: "Weight alternates",
      value: r.weightShiftAlternates ? "yes" : "no",
      unit: "",
      human: "yes",
      verdict: r.weightShiftAlternates ? "good" : "bad",
      tell: "the sway must change sides with the foot, or it is not transfer",
    },
    {
      name: "Knee bend plane",
      value: r.anatomy.worstMeanPlaneTilt.toFixed(1),
      unit: "deg",
      human: "under 16",
      verdict: anatomyMeasured
        ? band(r.anatomy.worstMeanPlaneTilt, [0, 16], [0, 25])
        : "none",
      tell: "how far the plane this knee bends in is turned off a hinge's",
    },
    {
      name: "Knee sideways offset",
      value: pct(r.anatomy.worstPeakMedialOffset),
      unit: "%",
      human: "under 6",
      verdict: anatomyMeasured
        ? band(r.anatomy.worstPeakMedialOffset, [0, 0.06], [0, 0.12])
        : "none",
      tell: "knee's worst departure from the hip-ankle line, over leg length",
    },
    {
      name: "Knee bends backward",
      value: pct(r.anatomy.worstReversedFraction),
      unit: "%",
      human: "0",
      verdict: anatomyMeasured
        ? band(r.anatomy.worstReversedFraction, [0, 0.02], [0, 0.1])
        : "none",
      tell: "share of the bend spent with the shank in front of the thigh",
    },
  ];
  const arrivalMetrics = new Set([
    "Foot slip per step",
    "Heel lift in stance",
    "Joint teleports",
    "Worst teleport",
    "Leg self-crossing",
    "Knee twitches",
    "Knee jerk",
    "Cycling on the spot",
    ...ANATOMY_METRICS,
  ]);
  if (scope === "arrival") {
    return rows.filter((row) => arrivalMetrics.has(row.name));
  }

  if (maneuver === "run") return runRows(rows, r);

  // Forward-walk norms are not universal locomotion norms. A pivot has no
  // meaningful forward step length or cycling-on-the-spot score, and lateral
  // gait has different cadence/support ranges. Keep the safety/contact rows
  // that answer the maneuver's real question instead of manufacturing red
  // results from an unrelated human-walking reference.
  if (maneuver === "turn-in-place") {
    const turnMetrics = new Set([
      "Foot slip per step",
      "Slip share of step",
      "Heel lift in stance",
      "Joint teleports",
      "Worst teleport",
      "Leg self-crossing",
      "Knee twitches",
      "Knee jerk",
      "Weight alternates",
      ...ANATOMY_METRICS,
    ]);
    return rows.filter((row) => turnMetrics.has(row.name));
  }
  if (maneuver === "crossover") {
    const crossoverMetrics = new Set([
      "Foot slip per step",
      "Slip share of step",
      "Heel lift in stance",
      "Joint teleports",
      "Worst teleport",
      "Knee twitches",
      "Knee jerk",
      "Cycling on the spot",
      "Body over the foot",
      "Weight alternates",
      ...ANATOMY_METRICS,
    ]);
    return [
      ...rows.filter((row) => crossoverMetrics.has(row.name)),
      {
        name: "Crossing order",
        value: r.legOrderAlternates ? "yes" : "no",
        unit: "",
        human: "front and back order both present",
        verdict: r.legOrderAlternates ? "good" : "bad",
        tell: `signed foot order ranged from ${cm(r.minimumLegOrderMargin)}cm to ${cm(r.maximumLegOrderMargin)}cm`,
      },
      {
        name: "Foot clearance",
        value: cm(r.minimumFootSeparation),
        unit: "cm",
        human: "over 10cm between ankle centres",
        verdict: band(
          r.minimumFootSeparation,
          [0.1, Infinity],
          [0.06, Infinity]
        ),
        tell: "closest 3D ankle-centre separation during the crossover",
      },
      {
        name: "Leg clearance",
        value: cm(r.minimumLegSegmentSeparation),
        unit: "cm",
        human: "over 4cm between leg centre lines",
        verdict: band(
          r.minimumLegSegmentSeparation,
          [0.04, Infinity],
          [0.025, Infinity]
        ),
        tell: "closest 3D thigh or shin centre-line separation",
      },
    ];
  }
  if (maneuver === "lateral") {
    const lateralMetrics = new Set([
      "Foot slip per step",
      "Slip share of step",
      "Heel lift in stance",
      "Joint teleports",
      "Worst teleport",
      "Leg self-crossing",
      "Knee twitches",
      "Knee jerk",
      "Cycling on the spot",
      "Body over the foot",
      "Weight alternates",
      ...ANATOMY_METRICS,
    ]);
    return rows.filter((row) => lateralMetrics.has(row.name));
  }
  return rows;
}

/** How many measurements sit outside the human range. */
export function countFailing(
  report: GaitReport | null,
  scope: GaitReportScope = "gait",
  maneuver: GaitManeuverProfile = "walk"
): number {
  return verdictRows(report, scope, maneuver).filter(
    (row) => row.verdict === "bad"
  ).length;
}
