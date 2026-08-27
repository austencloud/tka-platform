/**
 * Position Reachability Analyzer
 *
 * Implements Directional Arc Consistency (DAC) for the chain-structured CSP
 * that sequence generation represents. Before the beam search runs, this
 * analyzer pre-computes which positions at each step can participate in a
 * valid path from start to goal.
 *
 * Algorithm:
 *   1. Build a position transition graph from hard-constraint-filtered variations
 *   2. Backward pass: propagate goal requirement backward through each step
 *   3. Apply blocked start positions to step 0
 *   4. Forward pass: prune positions that can't be reached from step 0
 *   5. Return per-step reachable position sets + feasibility flag
 *
 * After this preprocessing, the beam search can filter candidates at every
 * step — not just the final one — guaranteeing it never wastes lanes on
 * paths that dead-end at a future constraint.
 *
 * Complexity: O(seedLength × |positions|²) — with ~56 positions and seeds
 * up to ~8 steps, this is under 25,000 operations. Negligible.
 */

import type { PictographData } from "../constraints/types.js";
import { PositionTransitionGraph } from "./PositionTransitionGraph.js";

export interface ReachabilityResult {
  /** reachableAt[i] = positions valid as startPosition for step i */
  reachableAt: Set<string>[];

  /** True if the goal is reachable from at least one non-blocked start */
  feasible: boolean;

  /** If !feasible, the first step index where the reachable set is empty */
  emptyStepIndex?: number;
}

export class PositionReachabilityAnalyzer {
  analyze(
    seedLength: number,
    requiredEndPositions: Set<string>,
    validVariations: PictographData[],
    blockedStartPositions?: Set<string>,
  ): ReachabilityResult {
    const graph = new PositionTransitionGraph(validVariations);
    const allPositions = graph.getAllPositions();

    // Edge case: single-step seed. The only valid start positions are those
    // with a direct transition to a required end position.
    if (seedLength === 1) {
      const reachable = new Set<string>();
      for (const pos of allPositions) {
        const reachableEnds = graph.getReachableFrom(pos);
        for (const end of requiredEndPositions) {
          if (reachableEnds.has(end)) {
            reachable.add(pos);
            break;
          }
        }
      }

      if (blockedStartPositions) {
        for (const blocked of blockedStartPositions) {
          reachable.delete(blocked);
        }
      }

      return {
        reachableAt: [reachable],
        feasible: reachable.size > 0,
        emptyStepIndex: reachable.size === 0 ? 0 : undefined,
      };
    }

    // reachableAt[i] = set of positions that, as the startPosition of step i,
    // can eventually reach a requiredEndPosition by step seedLength-1.
    const reachableAt: Set<string>[] = new Array(seedLength);

    // Final step: positions whose forward transitions include at least one
    // required end position.
    const finalStep = new Set<string>();
    reachableAt[seedLength - 1] = finalStep;
    for (const pos of allPositions) {
      const reachableEnds = graph.getReachableFrom(pos);
      for (const end of requiredEndPositions) {
        if (reachableEnds.has(end)) {
          finalStep.add(pos);
          break;
        }
      }
    }

    // Propagate backward: step i is reachable if at least one of its forward
    // transitions lands in the reachable set of step i+1.
    for (let i = seedLength - 2; i >= 0; i--) {
      const currentStep = new Set<string>();
      reachableAt[i] = currentStep;
      const nextStep = reachableAt[i + 1]!;
      for (const pos of allPositions) {
        const reachableEnds = graph.getReachableFrom(pos);
        for (const nextPos of nextStep) {
          if (reachableEnds.has(nextPos)) {
            currentStep.add(pos);
            break;
          }
        }
      }
    }

    // --- Apply blocked start positions to step 0 ---
    if (blockedStartPositions) {
      const step0 = reachableAt[0]!;
      for (const blocked of blockedStartPositions) {
        step0.delete(blocked);
      }
    }

    // A position at step i is only useful if it can be reached from some
    // position at step i-1 (which itself was reachable). This prunes positions
    // that survived the backward pass but have no valid incoming path.
    for (let i = 1; i < seedLength; i++) {
      const forwardReachable = new Set<string>();
      const currentStep = reachableAt[i]!;
      const prevStep = reachableAt[i - 1]!;
      for (const pos of currentStep) {
        // pos is valid at step i if some position at step i-1 can transition to it
        const predecessors = graph.getReachableTo(pos);
        for (const pred of prevStep) {
          if (predecessors.has(pred)) {
            forwardReachable.add(pos);
            break;
          }
        }
      }
      reachableAt[i] = forwardReachable;
    }

    let emptyStepIndex: number | undefined;
    for (let i = 0; i < seedLength; i++) {
      if (reachableAt[i]!.size === 0) {
        emptyStepIndex = i;
        break;
      }
    }

    return {
      reachableAt,
      feasible: emptyStepIndex === undefined,
      emptyStepIndex,
    };
  }
}
