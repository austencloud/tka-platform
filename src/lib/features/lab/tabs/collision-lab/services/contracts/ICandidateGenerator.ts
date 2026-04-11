/**
 * ICandidateGenerator
 *
 * Produces a set of visibly distinct candidate stances for one pose so
 * the reviewer can pick from a grid instead of wrestling with sliders
 * to fix whichever single stance the optimizer proposed.
 *
 * The generator has two modes:
 *
 *   "diverse" — used when starting fresh on a pose or when the reviewer
 *               rejects all current candidates. Six seeds sampled from a
 *               diverse strategy set (face the work, 90° rotations,
 *               behind-the-back, etc.), each optimized from its seed.
 *               Lower-loss solutions in each basin are surfaced.
 *
 *   "refine"  — used after the reviewer has picked a candidate but wants
 *               small variations. Six perturbations of the picked stance
 *               (±5° yaw, ±5 cm foot offsets), each optimized from its
 *               perturbed start with a short budget since we're already
 *               in a good basin.
 *
 * The generator also handles deduplication: two candidates that land on
 * the same stance within a tight tolerance merge, and the remaining
 * slots are backfilled with small perturbations so the reviewer always
 * sees six distinct options.
 *
 * Domain: Collision Lab — AI-assisted multiple-choice labeling
 */

import type { CandidateSet, PoseDefinition, StancePose } from "../../domain/types";
import type { OptimizerInput, OptimizerBounds } from "./IStanceOptimizer";

export interface ICandidateGenerator {
  /**
   * Generate a fresh set of six diverse candidates for the given pose.
   * Called on first visit to a pose, or when the reviewer clicks
   * "Different options" to reject the current set.
   *
   * If `priorLabel` is supplied, the reviewer's previously-saved stance
   * becomes candidate 0 (with zero optimizer work — just the sim
   * evaluated for its verdict), and five diverse seeds fill slots 1–5.
   * This lets the reviewer see what they picked before alongside fresh
   * alternatives when returning to an already-labeled pose.
   */
  generateDiverse(
    pose: PoseDefinition,
    input: OptimizerInput,
    bounds: OptimizerBounds,
    priorStance?: StancePose
  ): CandidateSet;

  /**
   * Generate a set of six refinements around the picked stance. Each
   * candidate is a small perturbation of `picked` (yaw ±5°, foot offsets
   * ±5 cm) re-optimized with a short budget so the reviewer can see
   * tiny variations they might not have thought to try manually.
   *
   * `previousHistory` is the running list of every stance the reviewer
   * has seen for this pose across all regenerations — the new set is
   * appended to it so we can record the full preference trail when the
   * reviewer eventually commits or gives up.
   */
  generateRefinements(
    pose: PoseDefinition,
    input: OptimizerInput,
    bounds: OptimizerBounds,
    picked: StancePose,
    previousHistory: StancePose[]
  ): CandidateSet;
}
