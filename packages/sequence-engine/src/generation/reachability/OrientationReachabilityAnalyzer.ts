/**
 * Orientation Reachability Analyzer
 *
 * Parallel to PositionReachabilityAnalyzer but for orientation closure.
 * Given a required (blueEndOri, redEndOri) and the remaining beats in a
 * partial sequence, determines the set of (blueOri, redOri) states from
 * which the end state is reachable via valid motions.
 *
 * ## Status
 *
 * This file is the scoped skeleton. The analyzer is wired into no caller
 * today — beam search still runs without orientation pruning. The skeleton
 * exposes the interface so future Phase 4 iteration can plug it into
 * SequenceBuilder's beam-search prune step.
 *
 * ## Design
 *
 * Input:
 *   - requiredBlueEnd, requiredRedEnd (Orientation)
 *   - remainingBeats (count)
 *   - turnIntensity (cap on turn values per beat)
 *   - level (gates feature availability — L1 has 0 turns only)
 *
 * Output:
 *   - Set of reachable (blueOri, redOri) pairs, one per beat index
 *   - feasibility flag: false when no state reaches the required end
 *
 * Algorithm (when wired):
 *   Work backward from the required end orientations. At each remaining beat
 *   position, compute the set of orientations from which a single-beat motion
 *   can reach the "next-beat reachable" set. A beat at level L can apply
 *   ±0, ±0.5 (float), ±1, ±1.5, ..., turnIntensity quarter-turn multiples
 *   to the current orientation.
 */

import type { Orientation } from "../../core/types/sequence-engine-types.js";

/**
 * Per-beat reachable orientation states.
 */
export interface OrientationReachabilityResult {
  /** Is the end state reachable from some valid start? */
  feasible: boolean;
  /** If infeasible, which beat has no reachable states. */
  emptyBeatIndex?: number;
  /**
   * For each beat index (0 = first beat), the set of (blueOri, redOri)
   * pairs from which the required end state is still reachable in the
   * remaining beats.
   */
  reachablePerBeat: Array<Set<string>>; // key: "blueOri|redOri"
}

export interface OrientationReachabilityArgs {
  requiredBlueEnd: Orientation;
  requiredRedEnd: Orientation;
  remainingBeats: number;
  /**
   * Per-beat maximum orientation delta in quarter turns. Level 1 allows 0
   * only; level 2 adds ±2 (180° half turn), etc. Passing `[0]` models a
   * level-1-like environment.
   */
  allowedDeltas: readonly number[];
}

/**
 * Analyzer for orientation reachability. Deliberately simple and pure;
 * intended to be instantiated per-search without shared state.
 */
export class OrientationReachabilityAnalyzer {
  /**
   * Analyze whether the required end orientation is reachable in the given
   * remaining beats, and return the reachable state set per beat.
   *
   * Algorithm works backward: at beat N-1 (the last), reachable = {end state}.
   * At beat N-2, reachable = states from which one allowed-delta motion
   * reaches the beat N-1 reachable set. Continues until beat 0.
   *
   * NOTE: Current implementation assumes independent blue/red orientations.
   * TKA-specific constraints (e.g., both hands receive same turn amount in
   * Type-1 shifts) are enforced by per-type closure constraints, not here.
   */
  analyze(args: OrientationReachabilityArgs): OrientationReachabilityResult {
    const { requiredBlueEnd, requiredRedEnd, remainingBeats, allowedDeltas } =
      args;

    const reachablePerBeat: Array<Set<string>> = [];
    const endKey = `${requiredBlueEnd}|${requiredRedEnd}`;

    // Beat (remainingBeats - 1) must land on the exact end state.
    let currentReachable = new Set<string>([endKey]);
    reachablePerBeat.push(new Set(currentReachable));

    // Work backward. At each step, find all states from which a one-beat
    // motion with an allowed delta lands in currentReachable.
    for (let beat = remainingBeats - 2; beat >= 0; beat--) {
      const prevReachable = new Set<string>();
      for (const key of currentReachable) {
        const [blueStr, redStr] = key.split("|");
        const blueIdx = orientationIndex(blueStr as Orientation);
        const redIdx = orientationIndex(redStr as Orientation);
        if (blueIdx === null || redIdx === null) continue;

        // Walk backward: what (blueStartIdx, redStartIdx) could land here?
        for (const dBlue of allowedDeltas) {
          for (const dRed of allowedDeltas) {
            const bs = mod4(blueIdx - dBlue);
            const rs = mod4(redIdx - dRed);
            prevReachable.add(
              `${indexToOrientation(bs)}|${indexToOrientation(rs)}`
            );
          }
        }
      }
      if (prevReachable.size === 0) {
        return {
          feasible: false,
          emptyBeatIndex: beat,
          reachablePerBeat,
        };
      }
      reachablePerBeat.unshift(prevReachable);
      currentReachable = prevReachable;
    }

    return { feasible: true, reachablePerBeat };
  }
}

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}

function orientationIndex(ori: Orientation): number | null {
  const idx = { in: 0, clock: 1, out: 2, counter: 3 }[ori as string];
  return idx === undefined ? null : idx;
}

function indexToOrientation(idx: number): Orientation {
  return (["in", "clock", "out", "counter"][mod4(idx)] as Orientation);
}

export const orientationReachabilityAnalyzer =
  new OrientationReachabilityAnalyzer();
