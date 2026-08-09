import {
  GridMode,
  type GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  BuilderPhase,
  BuilderStartPose,
  BuilderStep,
  BuilderStepEditMode,
} from "./assemble-state-types";

export interface AssembleDocumentState {
  phase: BuilderPhase;
  activeHand: MotionColor;
  gridMode: GridMode;
  showCenter: boolean;
  keyboardMode: boolean;
  blueSteps: BuilderStep[];
  redSteps: BuilderStep[];
  startPoses: Partial<Record<MotionColor, BuilderStartPose>>;
  currentPosition: GridLocation | null;
  currentOrientation: Orientation;
  rotationDirection: RotationDirection;
  turnCount: number;
  selectedStepIndex: number | null;
  stepEditMode: BuilderStepEditMode | null;
  showOrientationArrow: boolean;
  arrowOrientation: Orientation;
  readonly activeSteps: BuilderStep[];
  readonly stepCount: number;
  readonly canFinishHand: boolean;
  readonly canChangeGridMode: boolean;
  readonly canReorderSteps: boolean;
  readonly canReplaceSelectedStep: boolean;
  readonly candidateStartPosition: GridLocation | null;
  readonly candidateStartOrientation: Orientation;
  readonly candidateRotationDirection: RotationDirection;
  readonly candidateTurnCount: number;

  poseForHand(hand: MotionColor): BuilderStartPose | null;
  syncActiveCursor(): void;
}

export function cloneBuilderSteps(
  steps: readonly BuilderStep[]
): BuilderStep[] {
  return steps.map((step) => ({ ...step }));
}

export function cloneStartPoses(
  poses: Partial<Record<MotionColor, BuilderStartPose>>
): Partial<Record<MotionColor, BuilderStartPose>> {
  const next: Partial<Record<MotionColor, BuilderStartPose>> = {};
  const blue = poses[MotionColor.BLUE];
  const red = poses[MotionColor.RED];
  if (blue) next[MotionColor.BLUE] = { ...blue };
  if (red) next[MotionColor.RED] = { ...red };
  return next;
}

export function handLabel(hand: MotionColor): string {
  return hand === MotionColor.BLUE ? "Left" : "Right";
}

export function createAssembleDocumentState(): AssembleDocumentState {
  let phase = $state<BuilderPhase>("idle");
  let activeHand = $state<MotionColor>(MotionColor.BLUE);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showCenter = $state(false);
  let keyboardMode = $state(false);
  let blueSteps = $state<BuilderStep[]>([]);
  let redSteps = $state<BuilderStep[]>([]);
  let startPoses = $state<Partial<Record<MotionColor, BuilderStartPose>>>({});
  let currentPosition = $state<GridLocation | null>(null);
  let currentOrientation = $state<Orientation>(Orientation.IN);
  let rotationDirection = $state<RotationDirection>(
    RotationDirection.CLOCKWISE
  );
  let turnCount = $state(0);
  let selectedStepIndex = $state<number | null>(null);
  let stepEditMode = $state<BuilderStepEditMode | null>(null);
  let showOrientationArrow = $state(false);
  let arrowOrientation = $state<Orientation>(Orientation.IN);

  const activeSteps = $derived(
    activeHand === MotionColor.BLUE ? blueSteps : redSteps
  );
  const stepCount = $derived(blueSteps.length + redSteps.length);
  const canFinishHand = $derived(
    (phase === "building" || phase === "animating") &&
      blueSteps.length > 0 &&
      redSteps.length > 0 &&
      blueSteps.length === redSteps.length
  );
  const canChangeGridMode = $derived(
    blueSteps.length === 0 && redSteps.length === 0
  );
  const canReorderSteps = $derived(
    blueSteps.length > 1 && blueSteps.length === redSteps.length
  );
  const canReplaceSelectedStep = $derived(
    selectedStepIndex !== null &&
      selectedStepIndex >= 0 &&
      selectedStepIndex < activeSteps.length &&
      phase !== "animating" &&
      phase !== "complete"
  );
  const candidateStartPosition = $derived.by(() => {
    if (stepEditMode === "replace" && selectedStepIndex !== null) {
      return activeSteps[selectedStepIndex]?.startPosition ?? null;
    }
    return currentPosition;
  });
  const candidateStartOrientation = $derived.by(() => {
    if (stepEditMode === "replace" && selectedStepIndex !== null) {
      return (
        activeSteps[selectedStepIndex]?.startOrientation ?? currentOrientation
      );
    }
    return currentOrientation;
  });
  const candidateRotationDirection = $derived.by(() => {
    if (stepEditMode === "replace" && selectedStepIndex !== null) {
      return (
        activeSteps[selectedStepIndex]?.rotationDirection ?? rotationDirection
      );
    }
    return rotationDirection;
  });
  const candidateTurnCount = $derived.by(() => {
    if (stepEditMode === "replace" && selectedStepIndex !== null) {
      return activeSteps[selectedStepIndex]?.turnCount ?? turnCount;
    }
    return turnCount;
  });

  function poseForHand(hand: MotionColor): BuilderStartPose | null {
    const pose = startPoses[hand];
    if (pose) return pose;
    const steps = hand === MotionColor.BLUE ? blueSteps : redSteps;
    const first = steps[0];
    return first
      ? {
          location: first.startPosition,
          orientation: first.startOrientation,
        }
      : null;
  }

  function syncActiveCursor(): void {
    const steps = activeHand === MotionColor.BLUE ? blueSteps : redSteps;
    const last = steps[steps.length - 1];
    if (last) {
      currentPosition = last.endPosition;
      currentOrientation = last.endOrientation;
      phase = "building";
      return;
    }

    const pose = poseForHand(activeHand);
    if (pose) {
      currentPosition = pose.location;
      currentOrientation = pose.orientation;
      phase = "placing";
      return;
    }

    currentPosition = null;
    currentOrientation = Orientation.IN;
    phase = "idle";
  }

  return {
    get phase() {
      return phase;
    },
    set phase(value) {
      phase = value;
    },
    get activeHand() {
      return activeHand;
    },
    set activeHand(value) {
      activeHand = value;
    },
    get gridMode() {
      return gridMode;
    },
    set gridMode(value) {
      gridMode = value;
    },
    get showCenter() {
      return showCenter;
    },
    set showCenter(value) {
      showCenter = value;
    },
    get keyboardMode() {
      return keyboardMode;
    },
    set keyboardMode(value) {
      keyboardMode = value;
    },
    get blueSteps() {
      return blueSteps;
    },
    set blueSteps(value) {
      blueSteps = value;
    },
    get redSteps() {
      return redSteps;
    },
    set redSteps(value) {
      redSteps = value;
    },
    get startPoses() {
      return startPoses;
    },
    set startPoses(value) {
      startPoses = value;
    },
    get currentPosition() {
      return currentPosition;
    },
    set currentPosition(value) {
      currentPosition = value;
    },
    get currentOrientation() {
      return currentOrientation;
    },
    set currentOrientation(value) {
      currentOrientation = value;
    },
    get rotationDirection() {
      return rotationDirection;
    },
    set rotationDirection(value) {
      rotationDirection = value;
    },
    get turnCount() {
      return turnCount;
    },
    set turnCount(value) {
      turnCount = value;
    },
    get selectedStepIndex() {
      return selectedStepIndex;
    },
    set selectedStepIndex(value) {
      selectedStepIndex = value;
    },
    get stepEditMode() {
      return stepEditMode;
    },
    set stepEditMode(value) {
      stepEditMode = value;
    },
    get showOrientationArrow() {
      return showOrientationArrow;
    },
    set showOrientationArrow(value) {
      showOrientationArrow = value;
    },
    get arrowOrientation() {
      return arrowOrientation;
    },
    set arrowOrientation(value) {
      arrowOrientation = value;
    },
    get activeSteps() {
      return activeSteps;
    },
    get stepCount() {
      return stepCount;
    },
    get canFinishHand() {
      return canFinishHand;
    },
    get canChangeGridMode() {
      return canChangeGridMode;
    },
    get canReorderSteps() {
      return canReorderSteps;
    },
    get canReplaceSelectedStep() {
      return canReplaceSelectedStep;
    },
    get candidateStartPosition() {
      return candidateStartPosition;
    },
    get candidateStartOrientation() {
      return candidateStartOrientation;
    },
    get candidateRotationDirection() {
      return candidateRotationDirection;
    },
    get candidateTurnCount() {
      return candidateTurnCount;
    },
    poseForHand,
    syncActiveCursor,
  };
}
