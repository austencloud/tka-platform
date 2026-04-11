/**
 * Collision Lab State
 *
 * Factory that wires pose enumeration, labels, filters, cursor, and the
 * live collision snapshot into a single reactive object. Returned object
 * uses getter accessors so consumers can destructure in templates without
 * losing reactivity.
 *
 * The reviewer adjusts the performer's floor position (footOffsetX,
 * footOffsetZ), body yaw, and spine pitch as live sliders — no preset
 * variant indices. When they commit a label with labelCurrent(), the
 * current stance values are captured inline in the PoseLabel.
 *
 * Services are passed in as arguments — never resolved from the container
 * inside the factory. This matches the state-management rule.
 */

import type { IPoseEnumerator } from "../services/contracts/IPoseEnumerator";
import type { IPoseLabelRepository } from "../services/contracts/IPoseLabelRepository";
import type {
  PoseDefinition,
  PoseLabel,
  LabelStatus,
  HandOrientation,
  CollisionSnapshot,
  StancePose,
  DiamondPosition,
} from "../domain/types";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { STAGE } from "$lib/shared/3d/scale/scale-constants";

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

// ──────────────────────────────────────────────────────────────────────
// Reachability check
// ──────────────────────────────────────────────────────────────────────

/**
 * Approximate shoulder half-width in scene units (meters).
 * Mixamo base avatar has shoulder width ≈ 44 cm for a 188 cm model,
 * so half-width ≈ 22 cm. Close enough for a conservative reach check.
 */
const SHOULDER_HALF_WIDTH = 0.22;

/**
 * Tolerance added to the neutral-stance distance before we flag a stance
 * as unreachable. Accounts for the small extra reach contributed by
 * torso twist and anatomical wiggle that the strict math can't model
 * without running full IK. 5 cm is generous without being a lie.
 */
const REACH_TOLERANCE_M = 0.05;

const POSITION_TO_GRID: Record<DiamondPosition, GridLocation> = {
  N: GridLocation.NORTH,
  E: GridLocation.EAST,
  S: GridLocation.SOUTH,
  W: GridLocation.WEST,
};

const reachMapper = new PlaneCoordinateMapper();

interface ShoulderPos {
  x: number;
  y: number;
  z: number;
}

/** Rest shoulder positions in rig-local space (shoulders at y=0). */
const REST_LEFT_SHOULDER: ShoulderPos = { x: SHOULDER_HALF_WIDTH, y: 0, z: 0 };
const REST_RIGHT_SHOULDER: ShoulderPos = { x: -SHOULDER_HALF_WIDTH, y: 0, z: 0 };

function rotateAndTranslateShoulder(
  rest: ShoulderPos,
  yawRad: number,
  footOffsetX: number,
  footOffsetZ: number
): ShoulderPos {
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  return {
    x: rest.x * cos + rest.z * sin + footOffsetX,
    y: rest.y,
    z: -rest.x * sin + rest.z * cos + footOffsetZ,
  };
}

interface Vec3Lite {
  x: number;
  y: number;
  z: number;
}

function distance3(a: Vec3Lite, b: Vec3Lite): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute the prop's world position for a given (plane, cardinal) pair.
 * The plane mapper returns grid-local coordinates; we add the standard
 * grid-forward offset (0.3 m) to get world coordinates relative to the
 * performer's default rig root at world origin. Blue and red props are
 * at the same y in rig space (y=0 = shoulder height).
 */
function propWorldPos(plane: Plane, position: DiamondPosition): Vec3Lite {
  const loc = POSITION_TO_GRID[position];
  const local = reachMapper.gridLocationToPosition3D(plane, loc);
  return {
    x: local.x,
    y: local.y,
    z: local.z + STAGE.AVATAR_GRID_OFFSET,
  };
}

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
 * Per-pose reach budget is the neutral-stance distance + tolerance. This
 * auto-calibrates against the known-reachable default stance, so we
 * don't have to hard-code an arm length that depends on avatar height.
 */
function computeReachability(
  pose: PoseDefinition | null,
  footOffsetX: number,
  footOffsetZ: number,
  rootYawRad: number
): ReachabilityInfo {
  if (!pose) {
    return {
      reachable: true,
      blueDistance: 0,
      redDistance: 0,
      blueBudget: 0,
      redBudget: 0,
      blueExcess: 0,
      redExcess: 0,
    };
  }

  // Each hand can be on its own plane in the full cross-plane catalog.
  // Blue prop → performer's left hand → LeftShoulder (+X in rig-local)
  // Red prop  → performer's right hand → RightShoulder (-X in rig-local)
  const blueWorld = propWorldPos(pose.blueHand.plane, pose.blueHand.position);
  const redWorld = propWorldPos(pose.redHand.plane, pose.redHand.position);

  // Reach budget: distance at neutral stance + tolerance.
  // At neutral, the grid is calibrated to be reachable by design, so the
  // neutral distance is an upper bound on what IK was designed to solve.
  const blueBudget = distance3(REST_LEFT_SHOULDER, blueWorld) + REACH_TOLERANCE_M;
  const redBudget = distance3(REST_RIGHT_SHOULDER, redWorld) + REACH_TOLERANCE_M;

  // Current shoulder positions after stance transform
  const currentLeft = rotateAndTranslateShoulder(
    REST_LEFT_SHOULDER,
    rootYawRad,
    footOffsetX,
    footOffsetZ
  );
  const currentRight = rotateAndTranslateShoulder(
    REST_RIGHT_SHOULDER,
    rootYawRad,
    footOffsetX,
    footOffsetZ
  );

  const blueDistance = distance3(currentLeft, blueWorld);
  const redDistance = distance3(currentRight, redWorld);

  const blueExcess = Math.max(0, blueDistance - blueBudget);
  const redExcess = Math.max(0, redDistance - redBudget);

  return {
    reachable: blueExcess === 0 && redExcess === 0,
    blueDistance,
    redDistance,
    blueBudget,
    redBudget,
    blueExcess,
    redExcess,
  };
}

export async function createCollisionLabState(
  poseEnumerator: IPoseEnumerator,
  labelRepo: IPoseLabelRepository
) {
  const allPoses: PoseDefinition[] = poseEnumerator.enumerateDiamondInOut();
  const initialLabels = await labelRepo.loadAll();

  let labels = $state<Record<string, PoseLabel>>(initialLabels);

  // Filters — each hand has its own plane filter since planes are per-hand
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

  // Live stance values — the reviewer moves these via sliders.
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
        matchesStatusFilter(labels[p.id], statusFilter)
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

  const currentReachability = $derived<ReachabilityInfo>(
    computeReachability(currentPose, footOffsetX, footOffsetZ, rootYawRad)
  );

  const progress = $derived({
    total: allPoses.length,
    labeled: countLabels(labels, (s) => s !== "unlabeled"),
    clear: countLabels(labels, (s) => s === "clear"),
    needsAdjustment: countLabels(labels, (s) => s === "needs-adjustment"),
    unreachable: countLabels(labels, (s) => s === "unreachable"),
    skipped: countLabels(labels, (s) => s === "skip"),
  });

  /**
   * When the cursor lands on a new pose, seed the stance sliders from
   * whatever was previously saved for that pose (if anything). New poses
   * start from the center stance. This lets the reviewer see the last
   * known good stance for a pose when revisiting it.
   */
  function seedStanceFromLabel(pose: PoseDefinition | null) {
    if (!pose) {
      Object.assign(
        { footOffsetX, footOffsetZ, rootYawRad, spinePitchRad },
        CENTER_STANCE
      );
      footOffsetX = CENTER_STANCE.footOffsetX;
      footOffsetZ = CENTER_STANCE.footOffsetZ;
      rootYawRad = CENTER_STANCE.rootYawRad;
      spinePitchRad = CENTER_STANCE.spinePitchRad;
      return;
    }
    const prior = labels[pose.id];
    const stance = prior?.stance ?? CENTER_STANCE;
    footOffsetX = stance.footOffsetX;
    footOffsetZ = stance.footOffsetZ;
    rootYawRad = stance.rootYawRad;
    spinePitchRad = stance.spinePitchRad;
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

    // Filters — all reset cursor to 0
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
      // "clear" and "needs-adjustment" both make claims about the stance
      // (that it works, or that it ALMOST works). If the hand can't even
      // reach the prop, neither claim is meaningful — silently refuse so
      // we don't corrupt the dataset with physically impossible labels.
      // "skip" and "unreachable" are statements about the pose itself,
      // not the current stance, so they're always allowed.
      if (
        (status === "clear" || status === "needs-adjustment") &&
        !currentReachability.reachable
      ) {
        return;
      }
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
          armRouting: "auto",
          collisionSnapshot: currentCollision,
          labeledAt: Date.now(),
        },
      };
      labels = next;
      labelRepo.save(next);
      // Auto-advance on terminal positive/negative statuses only
      if (status === "clear" || status === "unreachable") {
        if (cursorIndex < filteredPoses.length - 1) {
          cursorIndex += 1;
          seedStanceFromLabel(filteredPoses[cursorIndex] ?? null);
        }
      }
    },

    // Export
    exportLabels() {
      labelRepo.exportJson(labels);
    },
  };
}

export type CollisionLabState = Awaited<ReturnType<typeof createCollisionLabState>>;
