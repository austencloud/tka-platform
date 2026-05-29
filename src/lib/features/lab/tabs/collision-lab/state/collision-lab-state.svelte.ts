/**
 * Collision Lab State
 *
 * Factory that wires pose enumeration, labels, filters, cursor, and the
 * live collision snapshot into a single reactive object. Returned object
 * uses getter accessors so consumers can destructure in templates without
 * losing reactivity.
 *
 * The reviewer adjusts the performer's floor position (footOffsetX,
 * footOffsetZ), body yaw, and spine pitch as live sliders - no preset
 * variant indices. When they commit a label with labelCurrent(), the
 * current stance values are captured inline in the PoseLabel.
 *
 * Services are passed in as arguments - never resolved from the container
 * inside the factory. This matches the state-management rule.
 */

import type { LocalPoseLabelRepository } from "../services/local-pose-label-repository";
import type { OptimizerResult } from "../services/types";
import type { SimResult } from "../services/types";
import type { CandidateGenerator } from "../services/candidate-generator";
import type { StanceOptimizer } from "../services/stance-optimizer";
import { REACH_FEASIBILITY_TOLERANCE } from "../services/stance-simulator";
import type {
  PoseDefinition,
  PoseLabel,
  LabelStatus,
  HandOrientation,
  CollisionSnapshot,
  StancePose,
  CandidateSet,
} from "../domain/types";
import type { Plane } from "@austencloud/scene-3d";
import { poseToOptimizerInput, OPTIMIZER_BOUNDS } from "../services/pose-target-mapper";
import { buildDiagnosticReport } from "../services/collision-lab-diagnostic";
type PlaneFilter = Plane | "all";
type OrientationFilter = HandOrientation | "all";
type StatusFilter = LabelStatus | "all" | "unlabeled-only";

function countLabels(
  labels: Record<string, PoseLabel>,
  predicate: (s: LabelStatus) => boolean
): number {
  let n = 0;
  for (const label of Object.values(labels)) {
    if (predicate(label.status)) n++;
  }
  return n;
}

function matchesStatusFilter(
  label: PoseLabel | undefined,
  filter: StatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "unlabeled-only") return !label || label.status === "unlabeled";
  if (!label) return filter === "unlabeled";
  return label.status === filter;
}

const CENTER_STANCE: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};


export interface ReachabilityInfo {
  reachable: boolean;
  /** Distance from the left shoulder to the blue prop (meters). */
  blueDistance: number;
  /** Distance from the right shoulder to the red prop (meters). */
  redDistance: number;
  /** Reach budget for the left shoulder at this pose (meters). */
  blueBudget: number;
  /** Reach budget for the right shoulder at this pose (meters). */
  redBudget: number;
  /** How much the left hand is beyond budget, meters (0 if reachable). */
  blueExcess: number;
  /** How much the right hand is beyond budget, meters (0 if reachable). */
  redExcess: number;
}

/**
 * Baseline ReachabilityInfo used when there is no pose selected or no
 * simulator wired up. Treated as trivially reachable so the UI doesn't
 * gate user actions on a check we can't actually run.
 */
const UNKNOWN_REACHABILITY: ReachabilityInfo = {
  reachable: true,
  blueDistance: 0,
  redDistance: 0,
  blueBudget: 0,
  redBudget: 0,
  blueExcess: 0,
  redExcess: 0,
};

/**
 * Map a pure-JS simulator result into the UI-facing ReachabilityInfo shape.
 *
 * Budget = max arm reach (upper + forearm), pulled from the simulator's
 * anthropometric geometry. Excess = shortfall reported by the IK - already
 * tolerance-adjusted (anything within REACH_FEASIBILITY_TOLERANCE is 0).
 * Distance = budget + excess when the hand can't quite reach, or
 * stretch*budget when it can (stretch is the used fraction of the reach
 * envelope, between 0 and 1).
 *
 * The legacy neutral-distance "budget" is gone - it produced false
 * negatives the moment a rotated stance moved a shoulder AWAY from its
 * target, which happens all the time for cross-plane poses where the
 * performer has to step toward one prop and away from the other.
 */
function reachabilityFromSimResult(
  simResult: SimResult,
  armLengthM: number
): ReachabilityInfo {
  // Raw shortfall (what the UI displays as "X cm short"). Anything
  // within the simulator's REACH_FEASIBILITY_TOLERANCE (3 cm) is still
  // considered reachable - see the tolerance rationale in StanceSimulator.
  const blueExcess = simResult.reachShortfall.blue;
  const redExcess = simResult.reachShortfall.red;
  const blueDistance =
    blueExcess > 0
      ? armLengthM + blueExcess
      : simResult.reachStretch.blue * armLengthM;
  const redDistance =
    redExcess > 0
      ? armLengthM + redExcess
      : simResult.reachStretch.red * armLengthM;
  return {
    reachable:
      blueExcess <= REACH_FEASIBILITY_TOLERANCE &&
      redExcess <= REACH_FEASIBILITY_TOLERANCE,
    blueDistance,
    redDistance,
    blueBudget: armLengthM,
    redBudget: armLengthM,
    blueExcess,
    redExcess,
  };
}

interface PoseEnumeratorLike {
  enumerateDiamondInOut(): PoseDefinition[];
}

export async function createCollisionLabState(
  poseEnumerator: PoseEnumeratorLike,
  labelRepo: LocalPoseLabelRepository,
  optimizer: StanceOptimizer | null = null,
  candidateGenerator: CandidateGenerator | null = null
) {
  const allPoses: PoseDefinition[] = poseEnumerator.enumerateDiamondInOut();
  const initialLabels = await labelRepo.loadAll();

  let labels = $state<Record<string, PoseLabel>>(initialLabels);

  // Last optimizer run for the current pose - exposed so the UI can show
  // reach shortfall, collision depths, and convergence metrics without
  // re-running the solver.
  let lastOptimizerResult = $state<OptimizerResult | null>(null);

  // Whether to auto-seed stance from the optimizer when stepping onto a
  // new pose that doesn't already have a saved label. Default true when
  // an optimizer is provided - reviewers can turn it off to label from
  // scratch.
  let autoSeedEnabled = $state(optimizer !== null);

  // Cached candidate sets, keyed by pose id. When the reviewer steps onto
  // a pose the first time we generate six diverse candidates and cache
  // them here so stepping away and back doesn't re-run six optimizations.
  // Invalidated when the reviewer clicks "Different options" or "Refine".
  let candidateCache = $state<Record<string, CandidateSet>>({});

  // Cached optimizer results from a full-catalog scan. Populated by
  // `scanAllForFeasibility()`. Lets the UI filter/navigate by feasibility
  // without paying to re-run the solver on each candidate.
  let scanCache = $state<Record<string, OptimizerResult>>({});
  /** Progress tracking for an in-flight scan (for the UI progress bar). */
  let scanProgress = $state<{ done: number; total: number; running: boolean }>({
    done: 0,
    total: 0,
    running: false,
  });
  /**
   * "infeasible only" filter: after a scan, only show poses whose cached
   * optimizer result was infeasible. Useful for systematically reviewing
   * the poses the AI couldn't solve on its own.
   */
  let infeasibleOnly = $state(false);

  // Filters - each hand has its own plane filter since planes are per-hand
  let bluePlaneFilter = $state<PlaneFilter>("all");
  let redPlaneFilter = $state<PlaneFilter>("all");
  let blueOrientationFilter = $state<OrientationFilter>("all");
  let redOrientationFilter = $state<OrientationFilter>("all");
  let statusFilter = $state<StatusFilter>("all");
  /**
   * "cross-plane only" convenience filter: show only poses where the
   * two hands are on different planes. Those are the problem cases the
   * lab exists to solve.
   */
  let crossPlaneOnly = $state(false);

  // Cursor
  let cursorIndex = $state(0);

  // Live stance values - the reviewer moves these via sliders.
  let footOffsetX = $state(0);
  let footOffsetZ = $state(0);
  let rootYawRad = $state(0);
  let spinePitchRad = $state(0);

  // Collision state
  let currentCollision = $state<CollisionSnapshot | null>(null);

  const filteredPoses = $derived(
    allPoses.filter(
      (p) =>
        (bluePlaneFilter === "all" || p.blueHand.plane === bluePlaneFilter) &&
        (redPlaneFilter === "all" || p.redHand.plane === redPlaneFilter) &&
        (blueOrientationFilter === "all" || p.blueHand.orientation === blueOrientationFilter) &&
        (redOrientationFilter === "all" || p.redHand.orientation === redOrientationFilter) &&
        (!crossPlaneOnly || p.blueHand.plane !== p.redHand.plane) &&
        matchesStatusFilter(labels[p.id], statusFilter) &&
        (!infeasibleOnly || scanCache[p.id]?.feasible === false)
    )
  );

  const currentPose = $derived<PoseDefinition | null>(
    filteredPoses.length > 0 ? filteredPoses[cursorIndex] ?? null : null
  );

  const currentLabel = $derived<PoseLabel | null>(
    currentPose ? labels[currentPose.id] ?? null : null
  );

  const currentStance = $derived<StancePose>({
    footOffsetX,
    footOffsetZ,
    rootYawRad,
    spinePitchRad,
  });

  // Reachability is answered by the pure-JS simulator, not a hand-rolled
  // shoulder-to-target measurement. The simulator runs a proper analytic
  // IK solve using the avatar's actual anthropometric arm length, so it
  // agrees with what the live rig can reach instead of a false "neutral
  // stance distance" budget that fails the moment the performer rotates.
  const currentReachability = $derived.by<ReachabilityInfo>(() => {
    if (!currentPose || !optimizer) return UNKNOWN_REACHABILITY;
    const simInput = poseToOptimizerInput(currentPose);
    const simResult = optimizer.simulator.evaluate(
      currentStance,
      simInput.blue,
      simInput.red
    );
    const armLengthM =
      optimizer.simulator.restPose.upperArmLength +
      optimizer.simulator.restPose.forearmLength;
    return reachabilityFromSimResult(simResult, armLengthM);
  });

  const progress = $derived({
    total: allPoses.length,
    labeled: countLabels(labels, (s) => s !== "unlabeled"),
    clear: countLabels(labels, (s) => s === "clear"),
    needsAdjustment: countLabels(labels, (s) => s === "needs-adjustment"),
    unreachable: countLabels(labels, (s) => s === "unreachable"),
    skipped: countLabels(labels, (s) => s === "skip"),
  });

  /**
   * Apply a StancePose to the live slider state.
   */
  function applyStance(stance: StancePose) {
    footOffsetX = stance.footOffsetX;
    footOffsetZ = stance.footOffsetZ;
    rootYawRad = stance.rootYawRad;
    spinePitchRad = stance.spinePitchRad;
  }

  /**
   * Run the optimizer on the given pose starting from the center stance.
   * Returns the result without mutating anything - callers decide whether
   * to apply it.
   */
  function runOptimizer(pose: PoseDefinition): OptimizerResult | null {
    if (!optimizer) return null;
    const input = poseToOptimizerInput(pose);
    return optimizer.optimize(input, CENTER_STANCE, OPTIMIZER_BOUNDS);
  }

  /**
   * Ensure a CandidateSet exists for the given pose, generating one if
   * not yet cached. Returns null when the candidate generator isn't
   * wired up (tests and legacy callers).
   *
   * The cached set survives stepping away and back to the same pose.
   * It is invalidated when the reviewer explicitly asks for "Different
   * options" or "Refine" via the action methods below.
   */
  function ensureCandidatesFor(pose: PoseDefinition): CandidateSet | null {
    if (!candidateGenerator) return null;
    const cached = candidateCache[pose.id];
    if (cached) return cached;
    const input = poseToOptimizerInput(pose);
    const prior = labels[pose.id]?.stance;
    const set = candidateGenerator.generateDiverse(
      pose,
      input,
      OPTIMIZER_BOUNDS,
      prior
    );
    candidateCache = { ...candidateCache, [pose.id]: set };
    return set;
  }

  /**
   * When the cursor lands on a pose, figure out what to put on the live
   * stance sliders:
   *   1. If a prior label exists and we don't have candidates yet,
   *      build a candidate set with the prior as candidate 0 and five
   *      fresh alternatives. Apply the prior stance to the live sliders
   *      as the starting preview - but leave pickedIndex null so the
   *      reviewer can still choose something different.
   *   2. If the candidate generator isn't available (tests), fall back
   *      to the old behavior: apply the prior's stance if it exists,
   *      otherwise run the optimizer once, otherwise center stance.
   *   3. If we already have a cached picked candidate, apply that.
   */
  function seedStanceFromLabel(pose: PoseDefinition | null) {
    if (!pose) {
      applyStance(CENTER_STANCE);
      lastOptimizerResult = null;
      return;
    }

    // New flow: generate (or reuse) candidates for this pose.
    const set = ensureCandidatesFor(pose);
    if (set) {
      if (set.pickedIndex !== null && set.candidates[set.pickedIndex]) {
        applyStance(set.candidates[set.pickedIndex]!.stance);
      } else if (set.candidates[0]) {
        // No explicit pick yet - preview the first candidate so the
        // viewer shows a meaningful pose while the reviewer decides.
        applyStance(set.candidates[0].stance);
      } else {
        applyStance(CENTER_STANCE);
      }
      lastOptimizerResult = null;
      return;
    }

    // Legacy fallback: no candidate generator wired up.
    const prior = labels[pose.id];
    if (prior) {
      applyStance(prior.stance);
      lastOptimizerResult = null;
      return;
    }
    if (autoSeedEnabled && optimizer) {
      const result = runOptimizer(pose);
      if (result) {
        lastOptimizerResult = result;
        applyStance(result.stance);
        return;
      }
    }
    applyStance(CENTER_STANCE);
    lastOptimizerResult = null;
  }

  // If we start with a candidate generator (or fallback optimizer) and
  // the first pose is unlabeled, seed it immediately so the reviewer
  // sees meaningful content the moment they open the lab.
  if (allPoses.length > 0) {
    const first = allPoses[0]!;
    if (candidateGenerator) {
      const set = ensureCandidatesFor(first);
      if (set?.candidates[0]) {
        applyStance(set.candidates[0].stance);
      }
    } else if (optimizer && autoSeedEnabled && !initialLabels[first.id]) {
      const result = runOptimizer(first);
      if (result) {
        lastOptimizerResult = result;
        applyStance(result.stance);
      }
    }
  }

  return {
    // Readers
    get allPoses() { return allPoses; },
    get filteredPoses() { return filteredPoses; },
    get currentPose() { return currentPose; },
    get currentLabel() { return currentLabel; },
    get currentStance() { return currentStance; },
    get currentReachability() { return currentReachability; },
    get currentCollision() { return currentCollision; },
    get labels() { return labels; },
    get progress() { return progress; },
    get cursorIndex() { return cursorIndex; },
    get bluePlaneFilter() { return bluePlaneFilter; },
    get redPlaneFilter() { return redPlaneFilter; },
    get blueOrientationFilter() { return blueOrientationFilter; },
    get redOrientationFilter() { return redOrientationFilter; },
    get statusFilter() { return statusFilter; },
    get crossPlaneOnly() { return crossPlaneOnly; },
    get footOffsetX() { return footOffsetX; },
    get footOffsetZ() { return footOffsetZ; },
    get rootYawRad() { return rootYawRad; },
    get spinePitchRad() { return spinePitchRad; },
    get lastOptimizerResult() { return lastOptimizerResult; },
    get autoSeedEnabled() { return autoSeedEnabled; },
    get hasOptimizer() { return optimizer !== null; },
    get hasCandidateGenerator() { return candidateGenerator !== null; },
    /**
     * The candidate set for the current pose, or null if no candidate
     * generator is wired up. Lazily generated on first read via the
     * cache - stepping away and back returns the same set.
     */
    get currentCandidateSet(): CandidateSet | null {
      if (!currentPose) return null;
      return candidateCache[currentPose.id] ?? null;
    },
    get scanCache() { return scanCache; },
    get scanProgress() { return scanProgress; },
    get infeasibleOnly() { return infeasibleOnly; },
    /**
     * Count of infeasible poses discovered by the last scan. Used by
     * the UI to show the reviewer how many problem cases remain.
     */
    get infeasibleCount() {
      let n = 0;
      for (const id in scanCache) {
        if (scanCache[id] && !scanCache[id]!.feasible) n++;
      }
      return n;
    },
    /**
     * Look up the cached scan result for the current pose, if any.
     * Returns null if the pose hasn't been scanned, or if the result
     * was computed but the pose is no longer the current one.
     */
    get currentScanResult(): OptimizerResult | null {
      if (!currentPose) return null;
      return scanCache[currentPose.id] ?? null;
    },
    /**
     * The current pose's cursor index within the ORIGINAL allPoses array,
     * independent of filters. Lets the UI display "pose 15 / 576" so the
     * reviewer can reference specific poses in conversation.
     */
    get currentPoseGlobalIndex(): number {
      if (!currentPose) return -1;
      return allPoses.findIndex((p) => p.id === currentPose.id);
    },

    // Cursor
    stepForward() {
      if (filteredPoses.length === 0) return;
      cursorIndex = Math.min(cursorIndex + 1, filteredPoses.length - 1);
      seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
    },
    stepBackward() {
      cursorIndex = Math.max(cursorIndex - 1, 0);
      seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
    },
    jumpTo(index: number) {
      const max = Math.max(0, filteredPoses.length - 1);
      cursorIndex = Math.max(0, Math.min(index, max));
      seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
    },

    // Stance setters
    setFootOffsetX(v: number) { footOffsetX = v; },
    setFootOffsetZ(v: number) { footOffsetZ = v; },
    setRootYawRad(v: number) { rootYawRad = v; },
    setSpinePitchRad(v: number) { spinePitchRad = v; },
    resetStance() {
      footOffsetX = 0;
      footOffsetZ = 0;
      rootYawRad = 0;
      spinePitchRad = 0;
    },

    // Filters - all reset cursor to 0
    setBluePlaneFilter(p: PlaneFilter) {
      bluePlaneFilter = p;
      cursorIndex = 0;
    },
    setRedPlaneFilter(p: PlaneFilter) {
      redPlaneFilter = p;
      cursorIndex = 0;
    },
    setCrossPlaneOnly(v: boolean) {
      crossPlaneOnly = v;
      cursorIndex = 0;
    },
    setBlueOrientationFilter(o: OrientationFilter) {
      blueOrientationFilter = o;
      cursorIndex = 0;
    },
    setRedOrientationFilter(o: OrientationFilter) {
      redOrientationFilter = o;
      cursorIndex = 0;
    },
    setStatusFilter(s: StatusFilter) {
      statusFilter = s;
      cursorIndex = 0;
    },

    // Collision intake
    updateCollision(snapshot: CollisionSnapshot | null) {
      currentCollision = snapshot;
    },

    // Labeling
    labelCurrent(status: LabelStatus) {
      const pose = currentPose;
      if (!pose) return;
      // "clear" makes a positive claim about the stance ("this works - no
      // collisions, fully reaches both grips"). We refuse to record that
      // claim if the hand literally can't reach, because it'd corrupt the
      // dataset with a physically impossible label.
      //
      // "needs-adjustment" means exactly the opposite - it's a reviewer
      // bookmark for "come back to this one, I'm not settled yet". It's the
      // CORRECT label for a reach that's close but not quite working, so we
      // DON'T gate it on reachability.
      //
      // "skip" and "unreachable" are statements about the pose itself,
      // not the current stance, so they're always allowed.
      if (status === "clear" && !currentReachability.reachable) {
        return;
      }
      // Capture the candidate context at time of labeling. If the
      // reviewer dragged sliders after picking, pickedIndex goes to
      // null so we can see later that the saved stance is a manual
      // adjustment. candidateStances holds the full history of what
      // the reviewer was shown for this pose.
      const set = candidateCache[pose.id];
      const pickedIndex = set
        ? set.manuallyAdjusted
          ? null
          : set.pickedIndex
        : undefined;
      const candidateStances = set ? set.history : undefined;
      const next: Record<string, PoseLabel> = {
        ...labels,
        [pose.id]: {
          poseId: pose.id,
          status,
          stance: {
            footOffsetX,
            footOffsetZ,
            rootYawRad,
            spinePitchRad,
          },
          candidateStances,
          pickedIndex,
          armRouting: "auto",
          collisionSnapshot: currentCollision,
          labeledAt: Date.now(),
        },
      };
      labels = next;
      labelRepo.save(next);
      // Auto-advance on every label. The reviewer has just made a
      // decision - clear / needs-adjustment / unreachable / skip -
      // and wants to move on to the next pose. "Needs adjustment"
      // is a bookmark status, not a "stay here" status; the reviewer
      // can scrub back to it later via the pose stepper. Auto-advance
      // keeps the labeling flow moving at roughly one pose per click.
      if (cursorIndex < filteredPoses.length - 1) {
        cursorIndex += 1;
        seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
      }
    },

    // Export
    exportLabels() {
      labelRepo.exportJson(labels);
    },

    // Optimizer controls
    setAutoSeedEnabled(v: boolean) {
      autoSeedEnabled = v;
    },
    /**
     * Manually re-run the optimizer on the current pose and apply the
     * result to the stance sliders. Useful when the reviewer has moved
     * sliders away from the AI seed and wants to get back to it, or
     * after adjusting some higher-level setting that affects the loss.
     */
    reoptimizeCurrent() {
      const pose = currentPose;
      if (!pose) return;
      const result = runOptimizer(pose);
      if (result) {
        lastOptimizerResult = result;
        applyStance(result.stance);
      }
    },

    // ----------------------------------------------------------------
    // Multiple-choice candidate controls
    // ----------------------------------------------------------------

    /**
     * Pick a candidate from the current candidate set. Applies its
     * stance to the live sliders and records the choice so the UI can
     * highlight which card is active. Clears `manuallyAdjusted` - the
     * reviewer has explicitly agreed with this stance.
     */
    pickCandidate(index: number) {
      const pose = currentPose;
      if (!pose) return;
      const set = candidateCache[pose.id];
      if (!set) return;
      if (index < 0 || index >= set.candidates.length) return;
      const candidate = set.candidates[index]!;
      applyStance(candidate.stance);
      candidateCache = {
        ...candidateCache,
        [pose.id]: { ...set, pickedIndex: index, manuallyAdjusted: false },
      };
    },

    /**
     * Throw out the current candidate set and generate six fresh ones
     * using diverse seeds. Used when the reviewer rejects all current
     * options via the "Different options" button.
     *
     * The rejected candidates are concatenated into `history` so the
     * full preference trail is preserved if the reviewer eventually
     * gives up on the pose.
     */
    regenerateDiverse() {
      const pose = currentPose;
      if (!pose || !candidateGenerator) return;
      const existing = candidateCache[pose.id];
      const input = poseToOptimizerInput(pose);
      const prior = labels[pose.id]?.stance;
      const fresh = candidateGenerator.generateDiverse(
        pose,
        input,
        OPTIMIZER_BOUNDS,
        prior
      );
      // Append existing history to the new set so we keep a continuous
      // record of everything the reviewer has seen for this pose.
      if (existing) {
        fresh.history = [...existing.history, ...fresh.history];
      }
      candidateCache = { ...candidateCache, [pose.id]: fresh };
      if (fresh.candidates[0]) applyStance(fresh.candidates[0].stance);
    },

    /**
     * Generate six refinements around the currently-picked stance.
     * Requires a pick to exist; no-op otherwise.
     */
    regenerateRefine() {
      const pose = currentPose;
      if (!pose || !candidateGenerator) return;
      const existing = candidateCache[pose.id];
      if (existing?.pickedIndex == null) return;
      const picked = existing.candidates[existing.pickedIndex];
      if (!picked) return;
      const input = poseToOptimizerInput(pose);
      const refined = candidateGenerator.generateRefinements(
        pose,
        input,
        OPTIMIZER_BOUNDS,
        picked.stance,
        existing.history
      );
      candidateCache = { ...candidateCache, [pose.id]: refined };
      if (refined.candidates[0]) applyStance(refined.candidates[0].stance);
    },

    /**
     * Mark the current pose as unreachable after the reviewer has
     * rejected all seen candidates. Records the full history so a
     * future analyst can see exactly which stances the reviewer tried.
     */
    giveUpOnPose() {
      const pose = currentPose;
      if (!pose) return;
      const set = candidateCache[pose.id];
      const history = set?.history ?? [];
      const next: Record<string, PoseLabel> = {
        ...labels,
        [pose.id]: {
          poseId: pose.id,
          status: "unreachable",
          stance: {
            footOffsetX,
            footOffsetZ,
            rootYawRad,
            spinePitchRad,
          },
          candidateStances: history,
          pickedIndex: null,
          armRouting: "auto",
          collisionSnapshot: currentCollision,
          labeledAt: Date.now(),
        },
      };
      labels = next;
      labelRepo.save(next);
      if (cursorIndex < filteredPoses.length - 1) {
        cursorIndex += 1;
        seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
      }
    },

    /**
     * Called by the slider UI when the reviewer drags a stance control
     * after picking a candidate. Records that the committed stance no
     * longer matches any candidate exactly, so the label gets saved
     * with `pickedIndex: null`.
     */
    markManuallyAdjusted() {
      const pose = currentPose;
      if (!pose) return;
      const set = candidateCache[pose.id];
      if (!set) return;
      candidateCache = {
        ...candidateCache,
        [pose.id]: { ...set, manuallyAdjusted: true },
      };
    },

    /**
     * Run the optimizer on every unlabeled pose and cache the result.
     * Returns when the whole catalog has been scanned. Use `scanProgress`
     * to drive a UI spinner while this runs.
     *
     * The scan yields to the event loop every 8 evaluations so the UI
     * stays responsive - you can cancel by navigating away or by calling
     * scanCache = {} in devtools.
     */
    async scanAllForFeasibility(): Promise<void> {
      if (!optimizer) return;
      const toScan = allPoses.filter((p) => !labels[p.id]);
      scanProgress = { done: 0, total: toScan.length, running: true };
      const fresh: Record<string, OptimizerResult> = { ...scanCache };
      for (let i = 0; i < toScan.length; i++) {
        const pose = toScan[i]!;
        const result = runOptimizer(pose);
        if (result) fresh[pose.id] = result;
        scanProgress = { done: i + 1, total: toScan.length, running: true };
        // Yield every 8 evals so the browser can repaint. Each optimize
        // call is ~35 ms, so 8 of them is ~280 ms - well under the limit
        // where users feel a freeze.
        if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
      }
      scanCache = fresh;
      scanProgress = { done: toScan.length, total: toScan.length, running: false };
    },

    /**
     * Clear the scan cache. Useful when the reviewer wants to rerun a
     * scan after changing the optimizer weights or after merging new
     * labels from another session.
     */
    clearScanCache() {
      scanCache = {};
      scanProgress = { done: 0, total: 0, running: false };
    },

    setInfeasibleOnly(v: boolean) {
      infeasibleOnly = v;
      cursorIndex = 0;
    },

    /**
     * Jump forward through filteredPoses to the next pose whose cached
     * optimizer result was infeasible. If none is found, does nothing.
     * Runs the optimizer on-the-fly for any pose that hasn't been cached
     * yet, so this works even before a full scan.
     */
    jumpToNextInfeasible() {
      if (!optimizer || filteredPoses.length === 0) return;
      const start = cursorIndex;
      for (let offset = 1; offset <= filteredPoses.length; offset++) {
        const next = (start + offset) % filteredPoses.length;
        const pose = filteredPoses[next]!;
        let result = scanCache[pose.id];
        if (!result) {
          const fresh = runOptimizer(pose);
          if (fresh) {
            scanCache = { ...scanCache, [pose.id]: fresh };
            result = fresh;
          }
        }
        if (result && !result.feasible) {
          cursorIndex = next;
          seedStanceFromLabel(pose);
          return;
        }
      }
    },

    /**
     * Build a JSON-safe diagnostic report for the CURRENT pose. Captures
     * everything I (Claude) would need to debug why a specific pose is
     * misbehaving: pose definition, stance, reachability, optimizer
     * result, rest-pose geometry, and bounds.
     *
     * Returned as an object; the UI layer serializes to JSON and writes
     * to the clipboard.
     */
    buildDiagnosticReport() {
      return buildDiagnosticReport(
        currentPose,
        allPoses,
        currentStance,
        currentReachability,
        optimizer,
        labels
      );
    },
  };
}

export type CollisionLabState = Awaited<ReturnType<typeof createCollisionLabState>>;
