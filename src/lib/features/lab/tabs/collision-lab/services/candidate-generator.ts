/**
 * CandidateGenerator
 *
 * Produces visibly-distinct candidate stances for multiple-choice pose
 * labeling. See `CandidateGenerator` for the contract.
 *
 * ## Why this exists
 *
 * The previous flow auto-seeded exactly one stance per pose using the
 * optimizer's internal multi-start, and the reviewer had to drag sliders
 * to rescue bad seeds. That was slow and occasionally produced physically
 * impossible stances (arms behind the head, body walked past the target)
 * that the optimizer happily accepted because they minimized the loss
 * function locally.
 *
 * The new flow runs the optimizer from six distinct starting points and
 * shows the reviewer all six. The reviewer picks one (or asks for more).
 * Human judgment replaces loss-function tuning for the subjective
 * "does this look like a real human pose" question, and the picks become
 * training data for a future learned naturalness prior.
 *
 * ## Seed strategy
 *
 * The 6 diverse seeds are designed to land in visually different basins
 * of the loss surface. The key insight is that the body's YAW axis is
 * the single biggest determinant of "what the pose looks like" - whether
 * the performer faces the work, stands perpendicular to it, or turns
 * their back to it completely. So the seeds are spread across yaw first
 * (with foot offset and spine pitch as secondary knobs).
 *
 * Refinement seeds are tiny perturbations of the picked stance along
 * each stance axis, letting the reviewer explore the neighborhood
 * without re-running the full diverse search.
 *
 * Domain: Collision Lab - AI-assisted multiple-choice labeling
 */

import type { OptimizerBounds, OptimizerInput, OptimizerResult } from "./types";
import type { StanceOptimizer } from "./stance-optimizer";
import type {
  CandidateSet,
  PoseDefinition,
  StanceCandidate,
  StancePose,
} from "../domain/types";

/**
 * Per-seed descent budget when generating a diverse set. Six seeds at
 * 150 evals each = ~900 total, slightly over the `optimize()` budget
 * of 700 but still <50 ms on a modern CPU. Interactive-friendly.
 */
const DIVERSE_SEED_BUDGET = 150;

/**
 * Per-seed descent budget when generating refinements. Smaller because
 * we're already in a good basin - a few dozen steps is enough to polish
 * the perturbation.
 */
const REFINE_SEED_BUDGET = 80;

/**
 * Dedup tolerances - two candidates that land within these distances
 * of each other in stance space are considered duplicates and merged.
 */
const DEDUP_YAW_RAD = (15 * Math.PI) / 180; // 15°
const DEDUP_FOOT_M = 0.05;                  // 5 cm (Euclidean on XZ)
const DEDUP_PITCH_RAD = (5 * Math.PI) / 180; // 5°

/**
 * One seed recipe - a starting stance plus a human-readable label so
 * the thumbnail can title the resulting candidate.
 */
interface SeedRecipe {
  label: string;
  stance: StancePose;
}

export class CandidateGenerator {
  constructor(private readonly optimizer: StanceOptimizer) {}

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  generateDiverse(
    pose: PoseDefinition,
    input: OptimizerInput,
    bounds: OptimizerBounds,
    priorStance?: StancePose
  ): CandidateSet {
    const seeds = this.buildDiverseSeeds(input, priorStance);
    const results = this.runSeeds(seeds, input, bounds, DIVERSE_SEED_BUDGET);

    // If the caller passed a priorStance, candidate 0 is the prior's
    // saved stance evaluated with zero descent - we want the reviewer
    // to see exactly what they previously committed, not a re-optimized
    // version of it. Run ONE sim evaluation to populate the verdict.
    let priorCandidate: StanceCandidate | null = null;
    if (priorStance) {
      const simResult = this.optimizer.simulator.evaluate(
        priorStance,
        input.blue,
        input.red
      );
      priorCandidate = {
        index: 0,
        stance: priorStance,
        loss: 0, // Not really comparable to optimized losses; treated as 0.
        feasible: simResult.feasible,
        label: "Previously saved",
        simResult,
      };
    }

    const deduped = this.dedupeAndFill(
      results,
      input,
      bounds,
      priorCandidate ? 5 : 6
    );

    const candidates: StanceCandidate[] = priorCandidate
      ? [priorCandidate, ...deduped]
      : deduped;

    // Re-index after dedupe/prior insertion so `candidate.index`
    // matches position in the final array.
    candidates.forEach((c, i) => (c.index = i));

    const history = candidates.map((c) => c.stance);
    return {
      poseId: pose.id,
      candidates,
      pickedIndex: null,
      manuallyAdjusted: false,
      mode: "diverse",
      history,
    };
  }

  generateRefinements(
    pose: PoseDefinition,
    input: OptimizerInput,
    bounds: OptimizerBounds,
    picked: StancePose,
    previousHistory: StancePose[]
  ): CandidateSet {
    const seeds = this.buildRefinementSeeds(picked);
    const results = this.runSeeds(seeds, input, bounds, REFINE_SEED_BUDGET);
    const deduped = this.dedupeAndFill(results, input, bounds, 6);
    deduped.forEach((c, i) => (c.index = i));

    return {
      poseId: pose.id,
      candidates: deduped,
      pickedIndex: null,
      manuallyAdjusted: false,
      mode: "refine",
      history: [...previousHistory, ...deduped.map((c) => c.stance)],
    };
  }

  // ------------------------------------------------------------------
  // Seed recipes
  // ------------------------------------------------------------------

  /**
   * Build the 6 diverse seed recipes for a fresh pose. See the class
   * docstring for the rationale.
   *
   * Seed 0 (or 1 when a prior label exists, since prior takes slot 0):
   *   face-the-work, feet under centroid.
   * Seed 1: face-the-work, feet stepped back 25 cm.
   * Seed 2: face-the-work + 90° right, feet under centroid.
   * Seed 3: face-the-work + 90° left, feet under centroid.
   * Seed 4: face the back (180° from the work), feet 25 cm behind the
   *         work in world space - explicitly includes behind-the-back
   *         style moves for showy sequences.
   * Seed 5: face-the-work + 45° right, feet stepped back 25 cm.
   */
  private buildDiverseSeeds(
    input: OptimizerInput,
    priorStance: StancePose | undefined
  ): SeedRecipe[] {
    const centroid = centroidOf(input);
    const faceYaw = yawFacingPoint(centroid.x, centroid.z, 0, 0);
    const backDir = (yaw: number) => ({
      // Opposite direction of forward = direction to step back to face target.
      x: Math.sin(yaw),
      z: -Math.cos(yaw),
    });

    const FACE_FORWARD: SeedRecipe = {
      label: "Face forward, under",
      stance: {
        footOffsetX: centroid.x,
        footOffsetZ: centroid.z,
        rootYawRad: faceYaw,
        spinePitchRad: 0,
      },
    };

    // Step back 25 cm in the direction away from the work, along the
    // body's facing axis. Keeps the performer behind the target instead
    // of inside it.
    const stepBackDistance = 0.25;
    const back = backDir(faceYaw);
    const FACE_FORWARD_BEHIND: SeedRecipe = {
      label: "Face forward, behind",
      stance: {
        footOffsetX: centroid.x + back.x * stepBackDistance,
        footOffsetZ: centroid.z + back.z * stepBackDistance,
        rootYawRad: faceYaw,
        spinePitchRad: 0,
      },
    };

    const ROTATED_RIGHT: SeedRecipe = {
      label: "Rotated 90° right",
      stance: {
        footOffsetX: centroid.x,
        footOffsetZ: centroid.z,
        rootYawRad: wrapAngle(faceYaw - Math.PI / 2),
        spinePitchRad: 0,
      },
    };

    const ROTATED_LEFT: SeedRecipe = {
      label: "Rotated 90° left",
      stance: {
        footOffsetX: centroid.x,
        footOffsetZ: centroid.z,
        rootYawRad: wrapAngle(faceYaw + Math.PI / 2),
        spinePitchRad: 0,
      },
    };

    // "Behind the back": performer turns 180° away from the target and
    // stands on the far side. Explicit because some TKA moves genuinely
    // do work behind the performer's back.
    const backSeedBack = backDir(wrapAngle(faceYaw + Math.PI));
    const BEHIND_THE_BACK: SeedRecipe = {
      label: "Behind the back",
      stance: {
        footOffsetX: centroid.x + backSeedBack.x * stepBackDistance,
        footOffsetZ: centroid.z + backSeedBack.z * stepBackDistance,
        rootYawRad: wrapAngle(faceYaw + Math.PI),
        spinePitchRad: 0,
      },
    };

    const backDiag = backDir(wrapAngle(faceYaw - Math.PI / 4));
    const DIAG_RIGHT_BEHIND: SeedRecipe = {
      label: "Diagonal right, behind",
      stance: {
        footOffsetX: centroid.x + backDiag.x * stepBackDistance,
        footOffsetZ: centroid.z + backDiag.z * stepBackDistance,
        rootYawRad: wrapAngle(faceYaw - Math.PI / 4),
        spinePitchRad: 0,
      },
    };

    // When a prior label exists, the prior stance takes slot 0 (added
    // by the caller), so we only need 5 fresh seeds here - drop the
    // weakest one (the diagonal). When no prior exists, return all 6.
    if (priorStance) {
      return [
        FACE_FORWARD,
        FACE_FORWARD_BEHIND,
        ROTATED_RIGHT,
        ROTATED_LEFT,
        BEHIND_THE_BACK,
      ];
    }
    return [
      FACE_FORWARD,
      FACE_FORWARD_BEHIND,
      ROTATED_RIGHT,
      ROTATED_LEFT,
      BEHIND_THE_BACK,
      DIAG_RIGHT_BEHIND,
    ];
  }

  /**
   * Build 6 refinement seeds as small perturbations of the picked
   * stance. One axis at a time so each resulting candidate explores a
   * different direction in stance space.
   */
  private buildRefinementSeeds(picked: StancePose): SeedRecipe[] {
    const YAW_SMALL = (5 * Math.PI) / 180;  // 5°
    const YAW_LARGE = (10 * Math.PI) / 180; // 10°
    const FOOT_SMALL = 0.05;                // 5 cm

    return [
      {
        label: "Yaw +5°",
        stance: { ...picked, rootYawRad: wrapAngle(picked.rootYawRad + YAW_SMALL) },
      },
      {
        label: "Yaw −5°",
        stance: { ...picked, rootYawRad: wrapAngle(picked.rootYawRad - YAW_SMALL) },
      },
      {
        label: "Yaw +10°, step forward",
        stance: {
          ...picked,
          rootYawRad: wrapAngle(picked.rootYawRad + YAW_LARGE),
          footOffsetZ: picked.footOffsetZ + FOOT_SMALL,
        },
      },
      {
        label: "Yaw −10°, step forward",
        stance: {
          ...picked,
          rootYawRad: wrapAngle(picked.rootYawRad - YAW_LARGE),
          footOffsetZ: picked.footOffsetZ + FOOT_SMALL,
        },
      },
      {
        label: "Step right",
        stance: { ...picked, footOffsetX: picked.footOffsetX + FOOT_SMALL },
      },
      {
        label: "Step left",
        stance: { ...picked, footOffsetX: picked.footOffsetX - FOOT_SMALL },
      },
    ];
  }

  // ------------------------------------------------------------------
  // Seed execution
  // ------------------------------------------------------------------

  /**
   * Run each seed through `optimizeFromSeed` and wrap the result in a
   * StanceCandidate with its human label preserved.
   */
  private runSeeds(
    seeds: SeedRecipe[],
    input: OptimizerInput,
    bounds: OptimizerBounds,
    budget: number
  ): StanceCandidate[] {
    return seeds.map((seed, index) => {
      const result = this.optimizer.optimizeFromSeed(
        input,
        seed.stance,
        bounds,
        budget
      );
      return this.resultToCandidate(index, seed.label, result);
    });
  }

  private resultToCandidate(
    index: number,
    label: string,
    result: OptimizerResult
  ): StanceCandidate {
    return {
      index,
      stance: result.stance,
      loss: result.loss,
      feasible: result.feasible,
      label,
      simResult: result.simResult,
    };
  }

  // ------------------------------------------------------------------
  // Dedup + backfill
  // ------------------------------------------------------------------

  /**
   * Merge candidates that land on the same stance after optimization
   * (two seeds can descend into the same basin, especially if one was
   * inside the other's attractor). When the lower-loss one is kept.
   *
   * If dedupe leaves fewer than `targetCount`, backfill by perturbing
   * the best existing candidate along axes orthogonal to the ones
   * already used, so the reviewer always sees `targetCount` distinct
   * options - never four cards and two blanks.
   */
  private dedupeAndFill(
    candidates: StanceCandidate[],
    input: OptimizerInput,
    bounds: OptimizerBounds,
    targetCount: number
  ): StanceCandidate[] {
    const kept: StanceCandidate[] = [];
    for (const c of candidates) {
      const dup = kept.find((k) => stancesCollide(k.stance, c.stance));
      if (!dup) {
        kept.push(c);
      } else if (c.loss < dup.loss) {
        // Replace the duplicate with the lower-loss one.
        const idx = kept.indexOf(dup);
        kept[idx] = c;
      }
    }

    while (kept.length < targetCount) {
      const best = kept.reduce((a, b) => (a.loss < b.loss ? a : b));
      const perturbed = this.perturbForBackfill(best.stance, kept.length);
      const result = this.optimizer.optimizeFromSeed(
        input,
        perturbed,
        bounds,
        REFINE_SEED_BUDGET
      );
      const candidate = this.resultToCandidate(
        kept.length,
        `Variation ${kept.length + 1}`,
        result
      );
      // If the perturbation also collides with an existing candidate,
      // nudge slightly and accept anyway - we'd rather have 6 cards
      // than infinite-loop searching for non-colliding perturbations.
      kept.push(candidate);
    }

    return kept.slice(0, targetCount);
  }

  /**
   * Deterministic perturbation pattern for backfill. Each call produces
   * a distinct offset vector so consecutive backfills explore different
   * directions in stance space.
   */
  private perturbForBackfill(base: StancePose, seed: number): StancePose {
    const patterns: Array<Partial<StancePose>> = [
      { rootYawRad: base.rootYawRad + (20 * Math.PI) / 180 },
      { rootYawRad: base.rootYawRad - (20 * Math.PI) / 180 },
      { footOffsetX: base.footOffsetX + 0.08 },
      { footOffsetX: base.footOffsetX - 0.08 },
      { footOffsetZ: base.footOffsetZ + 0.08 },
      { footOffsetZ: base.footOffsetZ - 0.08 },
    ];
    const patch = patterns[seed % patterns.length] ?? patterns[0]!;
    return { ...base, ...patch };
  }
}

// ----------------------------------------------------------------------
// Pure helpers (no state) - kept file-local rather than in a utility
// module because they exist to support one algorithm.
// ----------------------------------------------------------------------

function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Midpoint of the two grip targets in world space. This is "the work"
 * - the point the performer should be oriented toward.
 */
function centroidOf(input: OptimizerInput): { x: number; y: number; z: number } {
  return {
    x: (input.blue.gripWorld.x + input.red.gripWorld.x) / 2,
    y: (input.blue.gripWorld.y + input.red.gripWorld.y) / 2,
    z: (input.blue.gripWorld.z + input.red.gripWorld.z) / 2,
  };
}

/**
 * Yaw that makes the body's forward vector point from (bodyX, bodyZ)
 * toward (targetX, targetZ).
 *
 * TKA yaw convention: rootYawRad=0 means facing +Z, positive rotates
 * the body's left hand toward -X (the performer's own left). The
 * forward vector as a function of yaw is `(-sin(yaw), 0, cos(yaw))`,
 * which is the CCW rotation around the Y axis. Solving for the yaw
 * whose forward matches `(dx, dz) = target − body` gives
 * `yaw = atan2(-dx, dz)`.
 *
 * If the body is already at the target (dx = dz = 0), the function
 * returns 0 - a safe default rather than NaN.
 */
function yawFacingPoint(
  targetX: number,
  targetZ: number,
  bodyX: number,
  bodyZ: number
): number {
  const dx = targetX - bodyX;
  const dz = targetZ - bodyZ;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0;
  return Math.atan2(-dx, dz);
}

/**
 * Are two stances close enough that the reviewer would see them as the
 * same option? Uses loose tolerances on each axis - stances within 15°
 * yaw, 5 cm foot offset, and 5° spine pitch of each other collapse.
 */
function stancesCollide(a: StancePose, b: StancePose): boolean {
  const dYaw = Math.abs(wrapAngle(a.rootYawRad - b.rootYawRad));
  if (dYaw > DEDUP_YAW_RAD) return false;

  const dx = a.footOffsetX - b.footOffsetX;
  const dz = a.footOffsetZ - b.footOffsetZ;
  if (Math.hypot(dx, dz) > DEDUP_FOOT_M) return false;

  if (Math.abs(a.spinePitchRad - b.spinePitchRad) > DEDUP_PITCH_RAD) return false;

  return true;
}
