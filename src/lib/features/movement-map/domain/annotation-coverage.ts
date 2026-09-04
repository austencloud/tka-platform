/**
 * How much of the Level 1 world has actually been described.
 *
 * A labeling effort that cannot answer "what have I not done yet" turns into an
 * endless log. This module is the difference: it takes the finite space of
 * Level 1 movements and the annotations recorded so far, and reports which
 * movements are described, which are only partly described, and which have
 * never been looked at - so the next session can go straight at a gap instead of
 * re-describing whatever the last video happened to contain.
 *
 * Coverage is counted per transposition pair. A movement and the same movement
 * on the other side of the body are one thing to describe - the right arm doing
 * it on the right is the left arm doing it mirrored on the left - so describing
 * either one closes both, and the total is the number of pairs rather than the
 * number of signatures.
 *
 * Coverage is counted per phase, not per annotation. Ten observations of the
 * same movement at its landing say much less about what the arm does than three
 * spread across launch, middle and arrival, because the interesting anatomy is
 * in the travel. A movement counts as mapped once at least three of the five
 * phase anchors carry an observation.
 */

import {
  nearestPhaseAnchor,
  signatureKey,
  type MovementAnnotation,
  type PhaseAnchorId,
} from "./movement-annotation";
import type { LevelOneMovement, LevelOneSpace } from "./level-one-space";

/** Phase anchors a movement needs before its travel is considered described. */
export const ANCHORS_FOR_MAPPED = 3;

export type CoverageStatus = "unseen" | "partial" | "mapped";

export interface MovementCoverage {
  readonly movement: LevelOneMovement;
  readonly status: CoverageStatus;
  readonly anchors: ReadonlySet<PhaseAnchorId>;
  readonly annotationCount: number;
}

export interface CoverageReport {
  readonly total: number;
  readonly mapped: number;
  readonly partial: number;
  readonly unseen: number;
  /** Share of the space fully mapped, 0 to 1. */
  readonly fraction: number;
  readonly byKey: ReadonlyMap<string, MovementCoverage>;
  /** Not yet mapped, worst first, so the next gap to attack is at the top. */
  readonly gaps: readonly MovementCoverage[];
  /**
   * Annotations whose movement is not in the Level 1 space. Non-zero means
   * footage above Level 1 got annotated, and the count is surfaced rather than
   * silently dropped so the mismatch is visible instead of inflating nothing.
   */
  readonly outsideSpace: number;
}

function statusFor(anchors: ReadonlySet<PhaseAnchorId>): CoverageStatus {
  if (anchors.size === 0) return "unseen";
  return anchors.size >= ANCHORS_FOR_MAPPED ? "mapped" : "partial";
}

export function buildCoverageReport(
  space: LevelOneSpace,
  annotations: readonly MovementAnnotation[]
): CoverageReport {
  const anchorsByKey = new Map<string, Set<PhaseAnchorId>>();
  const countByKey = new Map<string, number>();
  let outsideSpace = 0;

  for (const annotation of annotations) {
    const anchor = nearestPhaseAnchor(annotation.phase);

    // One annotation describes both arms at once, so it advances whichever
    // movements those arms were performing - two at a time on a two-handed step.
    for (const signature of [
      annotation.leftSignature,
      annotation.rightSignature,
    ]) {
      if (!signature) continue;
      const key = signatureKey(signature);
      // Either side of a transposition pair resolves to the one entry, so an
      // observation of the blue arm credits the red arm doing it mirrored.
      const movement = space.byKey.get(key);
      if (!movement) {
        outsideSpace++;
        continue;
      }
      const classKey = movement.key;
      if (!anchorsByKey.has(classKey)) anchorsByKey.set(classKey, new Set());
      anchorsByKey.get(classKey)!.add(anchor);
      countByKey.set(classKey, (countByKey.get(classKey) ?? 0) + 1);
    }
  }

  const byKey = new Map<string, MovementCoverage>();
  let mapped = 0;
  let partial = 0;
  let unseen = 0;

  for (const movement of space.movements) {
    const anchors = anchorsByKey.get(movement.key) ?? new Set<PhaseAnchorId>();
    const status = statusFor(anchors);
    if (status === "mapped") mapped++;
    else if (status === "partial") partial++;
    else unseen++;

    byKey.set(movement.key, {
      movement,
      status,
      anchors,
      annotationCount: countByKey.get(movement.key) ?? 0,
    });
  }

  // Built before the aliases go in, or a pair would appear in the list twice.
  const gaps = [...byKey.values()]
    .filter((coverage) => coverage.status !== "mapped")
    .sort((a, b) => {
      if (a.anchors.size !== b.anchors.size) {
        return a.anchors.size - b.anchors.size;
      }
      return a.movement.key.localeCompare(b.movement.key);
    });

  // A caller holding a raw signature must be able to look it up from either
  // side, so both keys point at the pair's single coverage record.
  for (const movement of space.movements) {
    if (!movement.transposeKey) continue;
    const coverage = byKey.get(movement.key);
    if (coverage) byKey.set(movement.transposeKey, coverage);
  }

  const total = space.movements.length;

  return {
    total,
    mapped,
    partial,
    unseen,
    fraction: total === 0 ? 0 : mapped / total,
    byKey,
    gaps,
    outsideSpace,
  };
}

/**
 * Coverage for the movements in one sequence, so a video's own progress is
 * visible while working on it rather than only in the whole-space total.
 */
export function coverageForKeys(
  report: CoverageReport,
  keys: readonly string[]
): { mapped: number; partial: number; unseen: number; total: number } {
  let mapped = 0;
  let partial = 0;
  let unseen = 0;
  const counted = new Set<string>();

  for (const key of keys) {
    const coverage = report.byKey.get(key);
    // A sequence that performs a movement and its transposition performs one
    // movement, not two, so both sides collapse onto the pair's own key before
    // being counted. A key outside Level 1 has no pair and stands for itself.
    const identity = coverage ? coverage.movement.key : key;
    if (counted.has(identity)) continue;
    counted.add(identity);

    if (!coverage || coverage.status === "unseen") unseen++;
    else if (coverage.status === "mapped") mapped++;
    else partial++;
  }

  return { mapped, partial, unseen, total: counted.size };
}
