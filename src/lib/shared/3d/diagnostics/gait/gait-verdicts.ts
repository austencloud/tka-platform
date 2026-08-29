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

export function verdictRows(
  report: GaitReport | null,
  scope: GaitReportScope = "gait",
  maneuver: GaitManeuverProfile = "walk"
): VerdictRow[] {
  const r = report;
  if (!r || r.stances.length === 0) return [];
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
  ]);
  if (scope === "arrival") {
    return rows.filter((row) => arrivalMetrics.has(row.name));
  }

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
