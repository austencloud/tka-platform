/**
 * Read side of the committed prop-continuity sweep.
 *
 * `docs/diagnostics/prop-continuity-findings.json` is produced offline by
 * `npx vitest run --config tests/config/vitest.diagnostics.config.ts` (the
 * sweep imports the Node-only TnD seeder, so it can never run in a browser).
 * Everything in the app that wants to know where a sequence loses prop
 * continuity reads that artifact through this module instead of re-sampling.
 *
 * This module is telemetry. It does not influence pose, grip, or the solve.
 */

import type {
  ContinuityFinding,
  ContinuityPropId,
} from "./prop-continuity-audit";
import artifact from "../../../../../docs/diagnostics/prop-continuity-findings.json";

/** Which corpus a swept sequence came from. */
export type ContinuityGroup = "core-tnd" | "lab-fixture";

export interface ContinuitySequenceReport {
  readonly sequenceId: string;
  readonly word: string;
  readonly group: ContinuityGroup;
  /** Steps of motion the sweep walked (a LOOP's start position is not a step). */
  readonly motionStepCount: number;
  /** Phase samples taken across those steps. */
  readonly sampleCount: number;
  readonly findings: readonly ContinuityFinding[];
}

export interface ContinuitySweepMeta {
  readonly generatedBy: string;
  readonly detector: string;
  readonly sampler: string;
  readonly planeMode: string;
  readonly phaseStep: number;
  readonly phaseAxis: string;
  readonly totals: {
    readonly sequences: number;
    readonly sequencesWithFindings: number;
    readonly findings: number;
    readonly byClass: Readonly<Record<string, number>>;
  };
}

interface RawArtifact extends ContinuitySweepMeta {
  readonly sequences: readonly ContinuitySequenceReport[];
}

const report = artifact as unknown as RawArtifact;

export const PROP_CONTINUITY_SWEEP: ContinuitySweepMeta = {
  generatedBy: report.generatedBy,
  detector: report.detector,
  sampler: report.sampler,
  planeMode: report.planeMode,
  phaseStep: report.phaseStep,
  phaseAxis: report.phaseAxis,
  totals: report.totals,
};

const BY_SEQUENCE_ID = new Map<string, ContinuitySequenceReport>(
  report.sequences.map((entry) => [entry.sequenceId, entry]),
);

/**
 * The sweep's record for one sequence, or `undefined` when that sequence was
 * never swept. Absent is not the same as clean, and callers must say so.
 */
export function continuityReport(
  sequenceId: string,
): ContinuitySequenceReport | undefined {
  return BY_SEQUENCE_ID.get(sequenceId);
}

/** Every sequence the committed sweep covers, in artifact order. */
export function continuityReports(): readonly ContinuitySequenceReport[] {
  return report.sequences;
}

/**
 * One discontinuity event, as opposed to one prop's view of it.
 *
 * Blue and red are sampled independently, so a single depth flip shows up as
 * two findings whose phase spans overlap almost exactly — in the committed
 * artifact every cluster is one such blue/red pair, and consecutive clusters
 * sit at least 1.3 steps apart. Presenting the pair as one event is what lets
 * both props stay readable instead of one hiding the other under a marker
 * three pixels wide.
 */
export interface ContinuityCluster {
  /** Stable within a sequence: the earliest phase in the cluster. */
  readonly key: string;
  /** Earliest `phaseStart` across the cluster's findings. */
  readonly phaseStart: number;
  /** Latest `phaseEnd` across the cluster's findings. */
  readonly phaseEnd: number;
  readonly findings: readonly ContinuityFinding[];
  /** The props involved, in stage order, deduplicated. */
  readonly props: readonly ContinuityPropId[];
  /** Largest `magnitudeCm` in the cluster — how big the worst jump is. */
  readonly peakMagnitudeCm: number;
}

/** Findings whose spans touch or overlap belong to the same physical event. */
function overlaps(
  aEnd: number,
  bStart: number,
  tolerance: number,
): boolean {
  return bStart <= aEnd + tolerance;
}

/**
 * Group findings into physical events. `tolerance` defaults to the sweep's own
 * sampling interval, so spans that merely touch across one sample still merge.
 */
export function clusterContinuityFindings(
  findings: readonly ContinuityFinding[],
  tolerance: number = report.phaseStep,
): readonly ContinuityCluster[] {
  if (findings.length === 0) return [];

  const ordered = [...findings].sort((a, b) => a.phaseStart - b.phaseStart);
  const groups: ContinuityFinding[][] = [];
  let currentEnd = Number.NEGATIVE_INFINITY;

  for (const finding of ordered) {
    const current = groups.at(-1);
    if (current && overlaps(currentEnd, finding.phaseStart, tolerance)) {
      current.push(finding);
      currentEnd = Math.max(currentEnd, finding.phaseEnd);
      continue;
    }
    groups.push([finding]);
    currentEnd = finding.phaseEnd;
  }

  return groups.map((group) => {
    const phaseStart = Math.min(...group.map((f) => f.phaseStart));
    const phaseEnd = Math.max(...group.map((f) => f.phaseEnd));
    const props: ContinuityPropId[] = [];
    for (const prop of ["blue", "red"] as const) {
      if (group.some((f) => f.prop === prop)) props.push(prop);
    }
    return {
      key: phaseStart.toFixed(3),
      phaseStart,
      phaseEnd,
      findings: group,
      props,
      peakMagnitudeCm: Math.max(...group.map((f) => f.magnitudeCm)),
    } satisfies ContinuityCluster;
  });
}

/** The clustered events for one swept sequence. Empty when clean or unswept. */
export function continuityClusters(
  sequenceId: string,
): readonly ContinuityCluster[] {
  const entry = BY_SEQUENCE_ID.get(sequenceId);
  if (!entry) return [];
  return clusterContinuityFindings(entry.findings);
}

/** The span one prop occupies inside a cluster, or `undefined` if uninvolved. */
export function clusterPropSpan(
  cluster: ContinuityCluster,
  prop: ContinuityPropId,
): { readonly phaseStart: number; readonly phaseEnd: number } | undefined {
  const own = cluster.findings.filter((finding) => finding.prop === prop);
  if (own.length === 0) return undefined;
  return {
    phaseStart: Math.min(...own.map((finding) => finding.phaseStart)),
    phaseEnd: Math.max(...own.map((finding) => finding.phaseEnd)),
  };
}
