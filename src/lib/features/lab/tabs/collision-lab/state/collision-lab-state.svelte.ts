/**
 * Collision Lab State
 *
 * Factory that wires pose enumeration, labels, filters, cursor, and the
 * live collision snapshot into a single reactive object. Returned object
 * uses getter accessors so consumers can destructure in templates without
 * losing reactivity.
 *
 * Services are passed in as arguments — never resolved from the container
 * inside the factory. This matches the state-management rule.
 */

import type { IPoseEnumerator } from "../services/contracts/IPoseEnumerator";
import type { IPoseLabelRepository } from "../services/contracts/IPoseLabelRepository";
import type { IStanceVariantProvider } from "../services/contracts/IStanceVariantProvider";
import type {
  PoseDefinition,
  PoseLabel,
  LabelStatus,
  HandOrientation,
  CollisionSnapshot,
} from "../domain/types";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

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

export async function createCollisionLabState(
  poseEnumerator: IPoseEnumerator,
  labelRepo: IPoseLabelRepository,
  stanceProvider: IStanceVariantProvider
) {
  const allPoses: PoseDefinition[] = poseEnumerator.enumerateDiamondInOut();
  const initialLabels = await labelRepo.loadAll();

  let labels = $state<Record<string, PoseLabel>>(initialLabels);

  // Filters
  let planeFilter = $state<PlaneFilter>("all");
  let blueOrientationFilter = $state<OrientationFilter>("all");
  let redOrientationFilter = $state<OrientationFilter>("all");
  let statusFilter = $state<StatusFilter>("all");

  // Cursor + variant
  let cursorIndex = $state(0);
  let currentVariantIndex = $state(0);

  // Collision state
  let currentCollision = $state<CollisionSnapshot | null>(null);

  const filteredPoses = $derived(
    allPoses.filter(
      (p) =>
        (planeFilter === "all" || p.plane === planeFilter) &&
        (blueOrientationFilter === "all" || p.blueHand.orientation === blueOrientationFilter) &&
        (redOrientationFilter === "all" || p.redHand.orientation === redOrientationFilter) &&
        matchesStatusFilter(labels[p.id], statusFilter)
    )
  );

  const currentPose = $derived<PoseDefinition | null>(
    filteredPoses.length > 0 ? filteredPoses[cursorIndex] ?? null : null
  );

  const currentLabel = $derived<PoseLabel | null>(
    currentPose ? labels[currentPose.id] ?? null : null
  );

  const currentStanceVariant = $derived(stanceProvider.getVariant(currentVariantIndex));

  const progress = $derived({
    total: allPoses.length,
    labeled: countLabels(labels, (s) => s !== "unlabeled"),
    clear: countLabels(labels, (s) => s === "clear"),
    needsAdjustment: countLabels(labels, (s) => s === "needs-adjustment"),
    unreachable: countLabels(labels, (s) => s === "unreachable"),
    skipped: countLabels(labels, (s) => s === "skip"),
  });

  return {
    // Readers
    get allPoses() { return allPoses; },
    get filteredPoses() { return filteredPoses; },
    get currentPose() { return currentPose; },
    get currentLabel() { return currentLabel; },
    get currentStanceVariant() { return currentStanceVariant; },
    get currentVariantIndex() { return currentVariantIndex; },
    get currentCollision() { return currentCollision; },
    get labels() { return labels; },
    get progress() { return progress; },
    get cursorIndex() { return cursorIndex; },
    get planeFilter() { return planeFilter; },
    get blueOrientationFilter() { return blueOrientationFilter; },
    get redOrientationFilter() { return redOrientationFilter; },
    get statusFilter() { return statusFilter; },
    get stanceVariants() { return stanceProvider.getAll(); },

    // Cursor
    stepForward() {
      if (filteredPoses.length === 0) return;
      cursorIndex = Math.min(cursorIndex + 1, filteredPoses.length - 1);
      currentVariantIndex = 0;
    },
    stepBackward() {
      cursorIndex = Math.max(cursorIndex - 1, 0);
      currentVariantIndex = 0;
    },
    jumpTo(index: number) {
      const max = Math.max(0, filteredPoses.length - 1);
      cursorIndex = Math.max(0, Math.min(index, max));
      currentVariantIndex = 0;
    },

    // Variant
    setVariant(index: number) {
      currentVariantIndex = Math.max(0, Math.min(index, stanceProvider.count() - 1));
    },

    // Filters — all reset cursor to 0
    setPlaneFilter(p: PlaneFilter) {
      planeFilter = p;
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
      const next: Record<string, PoseLabel> = {
        ...labels,
        [pose.id]: {
          poseId: pose.id,
          status,
          stanceVariantIndex: currentVariantIndex,
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
          currentVariantIndex = 0;
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
