/**
 * Assemble State - Free-Form Dual-Hand Model
 *
 * Both hand paths share one editable timeline. Every document mutation records
 * a reversible snapshot, while selection and hand switching stay lightweight
 * interface state.
 */

import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { normalizeOrientationForLocation } from "$lib/shared/pictograph/grid/domain/orientation-from-drag";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { CommandStack } from "$lib/shared/history/command-stack.svelte";
import {
  createBuilderStep,
  moveBuilderStep,
  removeBuilderStep,
  replaceBuilderStepDestination,
  type BuilderPose,
} from "../services/builder-path-editor";

export type BuilderPhase =
  | "idle"
  | "placing"
  | "building"
  | "animating"
  | "complete";

export interface BuilderStep {
  readonly startPosition: GridLocation;
  readonly endPosition: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
}

export type BuilderStartPose = BuilderPose;
export type BuilderStepEditMode = "replace";
export type AssembleDocumentChange =
  | { readonly type: "delete-step"; readonly index: number }
  | {
      readonly type: "move-step";
      readonly fromIndex: number;
      readonly toIndex: number;
    };

export interface AssembleStateHydration {
  readonly blueSteps: readonly BuilderStep[];
  readonly redSteps: readonly BuilderStep[];
  readonly gridMode: GridMode;
  readonly startPoses: Partial<Record<MotionColor, BuilderStartPose>>;
}

export interface AssembleStateOptions {
  onDocumentChange?: (change?: AssembleDocumentChange) => void;
  captureDocument?: () => unknown;
  restoreDocument?: (document: unknown) => void;
}

export interface AssembleState {
  readonly phase: BuilderPhase;
  readonly activeHand: MotionColor;
  readonly gridMode: GridMode;
  readonly blueSteps: BuilderStep[];
  readonly redSteps: BuilderStep[];
  readonly startPoses: Partial<Record<MotionColor, BuilderStartPose>>;
  readonly currentPosition: GridLocation | null;
  readonly currentOrientation: Orientation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly showOrientationArrow: boolean;
  readonly arrowOrientation: Orientation;
  readonly activeSteps: BuilderStep[];
  readonly stepCount: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | undefined;
  readonly redoLabel: string | undefined;
  readonly canFinishHand: boolean;
  readonly showCenter: boolean;
  readonly canChangeGridMode: boolean;
  readonly keyboardMode: boolean;
  readonly selectedStepIndex: number | null;
  readonly stepEditMode: BuilderStepEditMode | null;
  readonly canReorderSteps: boolean;
  readonly canReplaceSelectedStep: boolean;
  readonly candidateStartPosition: GridLocation | null;
  readonly candidateStartOrientation: Orientation;
  readonly candidateRotationDirection: RotationDirection;
  readonly candidateTurnCount: number;

  handlePointClick(location: GridLocation): void;
  finishHand(): void;
  undoStep(): boolean;
  redoStep(): boolean;
  clearHistory(): void;
  selectStep(index: number | null): void;
  deleteStepAt(index: number): void;
  deleteSelectedStep(): void;
  moveStep(fromIndex: number, toIndex: number): void;
  moveSelectedStep(direction: -1 | 1): void;
  beginReplaceSelectedStep(): void;
  cancelStepEdit(): void;
  beginExternalEdit(label: string): void;
  hydrateFromExternalSequence(
    snapshot: AssembleStateHydration,
    previousDocument: unknown,
    label?: string
  ): void;
  hydrateFromSequence(snapshot: AssembleStateHydration): void;
  reset(): void;
  setStartPoses(poses: Record<MotionColor, BuilderStartPose>): void;
  setRotationDirection(dir: RotationDirection): void;
  setTurnCount(turns: number): void;
  setOrientation(ori: Orientation): void;
  setGridMode(mode: GridMode): void;
  setShowCenter(show: boolean): void;
  switchToHand(hand: MotionColor): void;
  toggleKeyboardMode(): void;
  setAnimationCallback(
    cb: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): () => void;
}

interface AssembleSnapshot {
  readonly phase: Exclude<BuilderPhase, "animating">;
  readonly activeHand: MotionColor;
  readonly gridMode: GridMode;
  readonly showCenter: boolean;
  readonly startPoses: Partial<Record<MotionColor, BuilderStartPose>>;
  readonly blueSteps: BuilderStep[];
  readonly redSteps: BuilderStep[];
  readonly currentPosition: GridLocation | null;
  readonly currentOrientation: Orientation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly selectedStepIndex: number | null;
  readonly stepEditMode: BuilderStepEditMode | null;
  readonly document: unknown;
}

export function createAssembleState(
  options: AssembleStateOptions = {}
): AssembleState {
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

  const history = new CommandStack();

  let onAnimationRequest = $state<
    ((step: BuilderStep, durationMs?: number) => Promise<void>) | null
  >(null);
  let pendingAction: (() => void) | null = null;
  let pendingExternalEdit: {
    readonly before: AssembleSnapshot;
    readonly label: string;
  } | null = null;
  let externalEditFinalizeScheduled = false;

  const activeSteps = $derived(
    activeHand === MotionColor.BLUE ? blueSteps : redSteps
  );
  const stepCount = $derived(blueSteps.length + redSteps.length);
  const canUndo = $derived(history.canUndo && phase !== "animating");
  const canRedo = $derived(history.canRedo && phase !== "animating");
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

  let showOrientationArrow = $state(false);
  let arrowOrientation = $state<Orientation>(Orientation.IN);
  let arrowTimeout: ReturnType<typeof setTimeout> | null = null;

  function notifyDocumentChange(change?: AssembleDocumentChange): void {
    options.onDocumentChange?.(change);
  }

  function cloneSteps(steps: readonly BuilderStep[]): BuilderStep[] {
    return steps.map((step) => ({ ...step }));
  }

  function cloneStartPoses(
    poses: Partial<Record<MotionColor, BuilderStartPose>>
  ): Partial<Record<MotionColor, BuilderStartPose>> {
    const next: Partial<Record<MotionColor, BuilderStartPose>> = {};
    const blue = poses[MotionColor.BLUE];
    const red = poses[MotionColor.RED];
    if (blue) next[MotionColor.BLUE] = { ...blue };
    if (red) next[MotionColor.RED] = { ...red };
    return next;
  }

  function cloneDocument(document: unknown): unknown {
    if (document === undefined) return undefined;
    return JSON.parse(JSON.stringify(document)) as unknown;
  }

  function stablePhase(): Exclude<BuilderPhase, "animating"> {
    return phase === "animating" ? "building" : phase;
  }

  function takeSnapshot(): AssembleSnapshot {
    return {
      phase: stablePhase(),
      activeHand,
      gridMode,
      showCenter,
      startPoses: cloneStartPoses(startPoses),
      blueSteps: cloneSteps(blueSteps),
      redSteps: cloneSteps(redSteps),
      currentPosition,
      currentOrientation,
      rotationDirection,
      turnCount,
      selectedStepIndex,
      stepEditMode,
      document: cloneDocument(options.captureDocument?.()),
    };
  }

  function restoreSnapshot(snapshot: AssembleSnapshot): void {
    pendingAction = null;
    pendingExternalEdit = null;
    phase = snapshot.phase;
    activeHand = snapshot.activeHand;
    gridMode = snapshot.gridMode;
    showCenter = snapshot.showCenter;
    startPoses = cloneStartPoses(snapshot.startPoses);
    blueSteps = cloneSteps(snapshot.blueSteps);
    redSteps = cloneSteps(snapshot.redSteps);
    currentPosition = snapshot.currentPosition;
    currentOrientation = snapshot.currentOrientation;
    rotationDirection = snapshot.rotationDirection;
    turnCount = snapshot.turnCount;
    selectedStepIndex = snapshot.selectedStepIndex;
    stepEditMode = snapshot.stepEditMode;
    showOrientationArrow = false;
    if (options.restoreDocument && snapshot.document !== undefined) {
      options.restoreDocument(cloneDocument(snapshot.document));
    } else {
      notifyDocumentChange();
    }
  }

  function recordSnapshot(label: string, before: AssembleSnapshot): void {
    const after = takeSnapshot();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    history.record({
      label,
      execute: () => restoreSnapshot(after),
      undo: () => restoreSnapshot(before),
    });
  }

  function finalizeExternalEdit(): void {
    externalEditFinalizeScheduled = false;
    const pending = pendingExternalEdit;
    pendingExternalEdit = null;
    if (pending) recordSnapshot(pending.label, pending.before);
  }

  function scheduleExternalEditFinalization(): void {
    if (externalEditFinalizeScheduled) return;
    externalEditFinalizeScheduled = true;
    queueMicrotask(finalizeExternalEdit);
  }

  function handLabel(hand: MotionColor): string {
    return hand === MotionColor.BLUE ? "Blue" : "Red";
  }

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

  function placeFirstPoint(location: GridLocation): void {
    const before = takeSnapshot();
    const orientation =
      location === GridLocation.CENTER ? Orientation.CENTER_N : Orientation.IN;
    currentPosition = location;
    currentOrientation = orientation;
    startPoses = {
      ...startPoses,
      [activeHand]: { location, orientation },
    };
    phase = "placing";
    notifyDocumentChange();
    recordSnapshot(`Place ${handLabel(activeHand)} start`, before);
  }

  async function addMotion(endLocation: GridLocation): Promise<void> {
    if (currentPosition === null) return;
    const before = takeSnapshot();
    const hand = activeHand;
    const step = createBuilderStep(
      { location: currentPosition, orientation: currentOrientation },
      endLocation,
      rotationDirection,
      turnCount
    );

    phase = "animating";
    const animationPromise = onAnimationRequest
      ? onAnimationRequest(step)
      : Promise.resolve();

    if (hand === MotionColor.BLUE) blueSteps = [...blueSteps, step];
    else redSteps = [...redSteps, step];

    currentPosition = endLocation;
    currentOrientation = step.endOrientation;
    selectedStepIndex = null;
    stepEditMode = null;
    notifyDocumentChange();

    try {
      await animationPromise;
    } finally {
      phase = "building";
      const handSteps = hand === MotionColor.BLUE ? blueSteps : redSteps;
      recordSnapshot(`Add ${handLabel(hand)} step ${handSteps.length}`, before);
    }

    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      action();
    }
  }

  function replaceSelectedDestination(location: GridLocation): void {
    if (!canReplaceSelectedStep || selectedStepIndex === null) return;
    const pose = poseForHand(activeHand);
    if (!pose) return;

    const before = takeSnapshot();
    if (activeHand === MotionColor.BLUE) {
      blueSteps = replaceBuilderStepDestination(
        blueSteps,
        selectedStepIndex,
        location,
        pose
      );
    } else {
      redSteps = replaceBuilderStepDestination(
        redSteps,
        selectedStepIndex,
        location,
        pose
      );
    }
    const replacedIndex = selectedStepIndex;
    stepEditMode = null;
    syncActiveCursor();
    notifyDocumentChange();
    recordSnapshot(
      `Replace ${handLabel(activeHand)} step ${replacedIndex + 1}`,
      before
    );
  }

  function handlePointClick(location: GridLocation): void {
    if (phase === "animating" || phase === "complete") return;
    if (stepEditMode === "replace") {
      replaceSelectedDestination(location);
      return;
    }
    if (currentPosition === null) {
      placeFirstPoint(location);
      return;
    }
    void addMotion(location);
  }

  function finishHand(): void {
    if (!canFinishHand) return;
    if (phase === "animating") {
      pendingAction = finishHand;
      return;
    }
    const before = takeSnapshot();
    phase = "complete";
    selectedStepIndex = null;
    stepEditMode = null;
    recordSnapshot("Complete sequence", before);
  }

  function undoStep(): boolean {
    if (phase === "animating") return false;
    finalizeExternalEdit();
    if (!history.canUndo) return false;
    return history.undo();
  }

  function redoStep(): boolean {
    if (phase === "animating") return false;
    finalizeExternalEdit();
    if (!history.canRedo) return false;
    return history.redo();
  }

  function clearHistory(): void {
    pendingExternalEdit = null;
    externalEditFinalizeScheduled = false;
    history.clear();
  }

  function selectStep(index: number | null): void {
    if (phase === "animating") return;
    const total = Math.max(blueSteps.length, redSteps.length);
    if (index === null || index < 0 || index >= total) {
      selectedStepIndex = null;
      stepEditMode = null;
      return;
    }
    if (selectedStepIndex === index) {
      selectedStepIndex = null;
      stepEditMode = null;
      return;
    }
    selectedStepIndex = index;
    stepEditMode = null;
  }

  function deleteStepAt(index: number): void {
    if (phase === "animating") return;
    const total = Math.max(blueSteps.length, redSteps.length);
    if (index < 0 || index >= total) return;
    const before = takeSnapshot();
    const bluePose = poseForHand(MotionColor.BLUE);
    const redPose = poseForHand(MotionColor.RED);
    if (bluePose) blueSteps = removeBuilderStep(blueSteps, index, bluePose);
    if (redPose) redSteps = removeBuilderStep(redSteps, index, redPose);
    selectedStepIndex = null;
    stepEditMode = null;
    syncActiveCursor();
    notifyDocumentChange({ type: "delete-step", index });
    recordSnapshot(`Delete step ${index + 1}`, before);
  }

  function deleteSelectedStep(): void {
    if (selectedStepIndex === null) return;
    deleteStepAt(selectedStepIndex);
  }

  function moveStep(fromIndex: number, toIndex: number): void {
    if (!canReorderSteps || phase === "animating") return;
    const total = blueSteps.length;
    if (
      fromIndex < 0 ||
      fromIndex >= total ||
      toIndex < 0 ||
      toIndex >= total ||
      fromIndex === toIndex
    ) {
      return;
    }
    const bluePose = poseForHand(MotionColor.BLUE);
    const redPose = poseForHand(MotionColor.RED);
    if (!bluePose || !redPose) return;

    const before = takeSnapshot();
    blueSteps = moveBuilderStep(blueSteps, fromIndex, toIndex, bluePose);
    redSteps = moveBuilderStep(redSteps, fromIndex, toIndex, redPose);
    selectedStepIndex = toIndex;
    stepEditMode = null;
    syncActiveCursor();
    notifyDocumentChange({ type: "move-step", fromIndex, toIndex });
    recordSnapshot(`Move step ${fromIndex + 1} to ${toIndex + 1}`, before);
  }

  function moveSelectedStep(direction: -1 | 1): void {
    if (selectedStepIndex === null) return;
    moveStep(selectedStepIndex, selectedStepIndex + direction);
  }

  function beginReplaceSelectedStep(): void {
    if (!canReplaceSelectedStep) return;
    stepEditMode = "replace";
  }

  function cancelStepEdit(): void {
    stepEditMode = null;
  }

  function applyHydration(snapshot: AssembleStateHydration): void {
    pendingAction = null;
    blueSteps = cloneSteps(snapshot.blueSteps);
    redSteps = cloneSteps(snapshot.redSteps);
    startPoses = cloneStartPoses(snapshot.startPoses);
    gridMode = snapshot.gridMode;
    showCenter =
      [...blueSteps, ...redSteps].some(
        (step) =>
          step.startPosition === GridLocation.CENTER ||
          step.endPosition === GridLocation.CENTER
      ) ||
      Object.values(startPoses).some(
        (pose) => pose?.location === GridLocation.CENTER
      );

    if (blueSteps.length > redSteps.length) activeHand = MotionColor.RED;
    else if (redSteps.length > blueSteps.length) activeHand = MotionColor.BLUE;
    else if (
      blueSteps.length === 0 &&
      startPoses[MotionColor.RED] &&
      !startPoses[MotionColor.BLUE]
    ) {
      activeHand = MotionColor.RED;
    } else activeHand = MotionColor.BLUE;

    selectedStepIndex = null;
    stepEditMode = null;
    syncActiveCursor();
  }

  function beginExternalEdit(label: string): void {
    if (pendingExternalEdit) return;
    pendingExternalEdit = { before: takeSnapshot(), label };
  }

  function matchesCurrentHydration(snapshot: AssembleStateHydration): boolean {
    return (
      gridMode === snapshot.gridMode &&
      JSON.stringify(startPoses) === JSON.stringify(snapshot.startPoses) &&
      JSON.stringify(blueSteps) === JSON.stringify(snapshot.blueSteps) &&
      JSON.stringify(redSteps) === JSON.stringify(snapshot.redSteps)
    );
  }

  function hydrateFromExternalSequence(
    snapshot: AssembleStateHydration,
    previousDocument: unknown,
    label = "Edit sequence"
  ): void {
    if (!pendingExternalEdit) {
      pendingExternalEdit = {
        before: {
          ...takeSnapshot(),
          document: cloneDocument(previousDocument),
        },
        label,
      };
    }
    if (!matchesCurrentHydration(snapshot)) {
      const previousHand = activeHand;
      const previousSelection = selectedStepIndex;
      applyHydration(snapshot);
      const previousHandHasContent =
        Boolean(startPoses[previousHand]) ||
        (previousHand === MotionColor.BLUE
          ? blueSteps.length > 0
          : redSteps.length > 0);
      if (previousHandHasContent) activeHand = previousHand;
      const total = Math.max(blueSteps.length, redSteps.length);
      selectedStepIndex =
        previousSelection !== null && previousSelection < total
          ? previousSelection
          : null;
      syncActiveCursor();
    }
    scheduleExternalEditFinalization();
  }

  function hydrateFromSequence(snapshot: AssembleStateHydration): void {
    pendingExternalEdit = null;
    externalEditFinalizeScheduled = false;
    applyHydration(snapshot);
    history.clear();
  }

  function reset(): void {
    const hasContent =
      blueSteps.length > 0 ||
      redSteps.length > 0 ||
      Object.keys(startPoses).length > 0;
    if (!hasContent) return;
    const before = takeSnapshot();
    pendingAction = null;
    phase = "idle";
    activeHand = MotionColor.BLUE;
    blueSteps = [];
    redSteps = [];
    startPoses = {};
    currentPosition = null;
    currentOrientation = Orientation.IN;
    rotationDirection = RotationDirection.CLOCKWISE;
    turnCount = 0;
    gridMode = GridMode.DIAMOND;
    showCenter = false;
    selectedStepIndex = null;
    stepEditMode = null;
    notifyDocumentChange();
    recordSnapshot("Clear sequence", before);
  }

  function setStartPoses(poses: Record<MotionColor, BuilderStartPose>): void {
    if (
      phase === "animating" ||
      phase === "complete" ||
      blueSteps.length > 0 ||
      redSteps.length > 0
    ) {
      return;
    }

    const blue = poses[MotionColor.BLUE];
    const red = poses[MotionColor.RED];
    if (
      !blue ||
      !red ||
      !isLocationValidForMode(blue.location, gridMode, showCenter) ||
      !isLocationValidForMode(red.location, gridMode, showCenter)
    ) {
      return;
    }

    const nextPoses: Record<MotionColor, BuilderStartPose> = {
      [MotionColor.BLUE]: {
        location: blue.location,
        orientation: normalizeOrientationForLocation(
          blue.orientation,
          blue.location
        ),
      },
      [MotionColor.RED]: {
        location: red.location,
        orientation: normalizeOrientationForLocation(
          red.orientation,
          red.location
        ),
      },
    };
    if (JSON.stringify(startPoses) === JSON.stringify(nextPoses)) return;

    const before = takeSnapshot();
    startPoses = nextPoses;
    activeHand = MotionColor.BLUE;
    currentPosition = nextPoses[MotionColor.BLUE].location;
    currentOrientation = nextPoses[MotionColor.BLUE].orientation;
    phase = "placing";
    selectedStepIndex = null;
    stepEditMode = null;
    showOrientationArrow = false;
    notifyDocumentChange();
    recordSnapshot("Set start position", before);
  }

  function setRotationDirection(dir: RotationDirection): void {
    rotationDirection = dir;
  }

  function setTurnCount(turns: number): void {
    turnCount = turns;
  }

  function setOrientation(orientation: Orientation): void {
    let nextOrientation = orientation;
    if (currentPosition === GridLocation.CENTER) {
      const radialToCenterAtNorth: Record<string, Orientation> = {
        [Orientation.IN]: Orientation.CENTER_S,
        [Orientation.OUT]: Orientation.CENTER_N,
        [Orientation.CLOCK]: Orientation.CENTER_E,
        [Orientation.COUNTER]: Orientation.CENTER_W,
      };
      nextOrientation =
        radialToCenterAtNorth[nextOrientation] ?? nextOrientation;
    }
    if (nextOrientation === currentOrientation) return;

    const before = takeSnapshot();
    currentOrientation = nextOrientation;
    if (phase === "placing" && currentPosition !== null) {
      startPoses = {
        ...startPoses,
        [activeHand]: {
          location: currentPosition,
          orientation: nextOrientation,
        },
      };
    }

    if (currentPosition !== null) {
      arrowOrientation = nextOrientation;
      showOrientationArrow = true;
      if (arrowTimeout) clearTimeout(arrowTimeout);
      arrowTimeout = setTimeout(() => {
        showOrientationArrow = false;
        arrowTimeout = null;
      }, 1000);
    }
    if (phase === "placing") {
      notifyDocumentChange();
      recordSnapshot(`Turn ${handLabel(activeHand)} start`, before);
    }
  }

  function setGridMode(mode: GridMode): void {
    if (mode === gridMode || !canChangeGridMode) return;
    const before = Object.keys(startPoses).length > 0 ? takeSnapshot() : null;
    const nextPoses = cloneStartPoses(startPoses);
    for (const hand of [MotionColor.BLUE, MotionColor.RED]) {
      const pose = nextPoses[hand];
      if (pose && !isLocationValidForMode(pose.location, mode, showCenter)) {
        delete nextPoses[hand];
      }
    }
    startPoses = nextPoses;
    gridMode = mode;
    syncActiveCursor();
    notifyDocumentChange();
    if (before) recordSnapshot("Change grid", before);
  }

  function setShowCenter(show: boolean): void {
    if (show === showCenter || !canChangeGridMode) return;
    const before = Object.keys(startPoses).length > 0 ? takeSnapshot() : null;
    if (!show) {
      const nextPoses = cloneStartPoses(startPoses);
      for (const hand of [MotionColor.BLUE, MotionColor.RED]) {
        if (nextPoses[hand]?.location === GridLocation.CENTER) {
          delete nextPoses[hand];
        }
      }
      startPoses = nextPoses;
    }
    showCenter = show;
    syncActiveCursor();
    notifyDocumentChange();
    if (before) {
      recordSnapshot(show ? "Show center point" : "Hide center point", before);
    }
  }

  function toggleKeyboardMode(): void {
    keyboardMode = !keyboardMode;
  }

  function switchToHand(hand: MotionColor): void {
    if (hand === activeHand || phase === "animating" || phase === "complete") {
      return;
    }
    activeHand = hand;
    stepEditMode = null;
    syncActiveCursor();
  }

  function setAnimationCallback(
    callback: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): () => void {
    onAnimationRequest = callback;
    return () => {
      if (onAnimationRequest === callback) onAnimationRequest = null;
    };
  }

  return {
    get phase() {
      return phase;
    },
    get activeHand() {
      return activeHand;
    },
    get gridMode() {
      return gridMode;
    },
    get blueSteps() {
      return blueSteps;
    },
    get redSteps() {
      return redSteps;
    },
    get startPoses() {
      return startPoses;
    },
    get currentPosition() {
      return currentPosition;
    },
    get currentOrientation() {
      return currentOrientation;
    },
    get rotationDirection() {
      return rotationDirection;
    },
    get turnCount() {
      return turnCount;
    },
    get showOrientationArrow() {
      return showOrientationArrow;
    },
    get arrowOrientation() {
      return arrowOrientation;
    },
    get activeSteps() {
      return activeSteps;
    },
    get stepCount() {
      return stepCount;
    },
    get canUndo() {
      return canUndo;
    },
    get canRedo() {
      return canRedo;
    },
    get undoLabel() {
      return history.undoLabel;
    },
    get redoLabel() {
      return history.redoLabel;
    },
    get canFinishHand() {
      return canFinishHand;
    },
    get showCenter() {
      return showCenter;
    },
    get canChangeGridMode() {
      return canChangeGridMode;
    },
    get keyboardMode() {
      return keyboardMode;
    },
    get selectedStepIndex() {
      return selectedStepIndex;
    },
    get stepEditMode() {
      return stepEditMode;
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
    handlePointClick,
    finishHand,
    undoStep,
    redoStep,
    clearHistory,
    selectStep,
    deleteStepAt,
    deleteSelectedStep,
    moveStep,
    moveSelectedStep,
    beginReplaceSelectedStep,
    cancelStepEdit,
    beginExternalEdit,
    hydrateFromExternalSequence,
    hydrateFromSequence,
    reset,
    setStartPoses,
    setRotationDirection,
    setTurnCount,
    setOrientation,
    setGridMode,
    setShowCenter,
    switchToHand,
    toggleKeyboardMode,
    setAnimationCallback,
  };
}

function isLocationValidForMode(
  location: GridLocation,
  mode: GridMode,
  centerEnabled: boolean
): boolean {
  if (location === GridLocation.CENTER) return centerEnabled;
  const cardinal: GridLocation[] = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];
  const intercardinal: GridLocation[] = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];
  switch (mode) {
    case GridMode.DIAMOND:
      return cardinal.includes(location);
    case GridMode.BOX:
      return intercardinal.includes(location);
    case GridMode.SKEWED:
      return cardinal.includes(location) || intercardinal.includes(location);
    default:
      return true;
  }
}
