/**
 * Position Transition Graph
 *
 * Builds a bidirectional adjacency graph from a set of variations that have
 * already been filtered by hard constraints. Each edge represents a valid
 * transition: one variation's startPosition → endPosition.
 *
 * Used by PositionReachabilityAnalyzer to propagate reachability backward
 * from the LOOP goal and forward from the start, ensuring the beam search
 * only explores positions that can participate in a complete path.
 */

import type { PictographData } from "../constraints/types.js";

export class PositionTransitionGraph {
  private readonly forward: Map<string, Set<string>> = new Map();
  private readonly reverse: Map<string, Set<string>> = new Map();

  constructor(variations: PictographData[]) {
    for (const v of variations) {
      const { startPosition, endPosition } = v;

      let fwd = this.forward.get(startPosition);
      if (!fwd) {
        fwd = new Set();
        this.forward.set(startPosition, fwd);
      }
      fwd.add(endPosition);

      let rev = this.reverse.get(endPosition);
      if (!rev) {
        rev = new Set();
        this.reverse.set(endPosition, rev);
      }
      rev.add(startPosition);
    }
  }

  getReachableFrom(position: string): Set<string> {
    return this.forward.get(position) ?? new Set();
  }

  /** Positions that can reach TO the given position (one step backward). */
  getReachableTo(position: string): Set<string> {
    return this.reverse.get(position) ?? new Set();
  }

  getAllPositions(): Set<string> {
    const all = new Set<string>();
    for (const pos of this.forward.keys()) all.add(pos);
    for (const pos of this.reverse.keys()) all.add(pos);
    return all;
  }
}
