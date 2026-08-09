import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createBuilderStep,
  moveBuilderStep,
  removeBuilderStep,
  replaceBuilderStepDestination,
} from "../services/builder-path-editor";
import {
  handLabel,
  type AssembleDocumentState,
} from "./assemble-document-state.svelte";
import type { AssembleHistoryController } from "./assemble-history-controller";
import type { BuilderStep } from "./assemble-state-types";

export interface AssemblePathController {
  handlePointClick(location: GridLocation): void;
  finishHand(): void;
  selectStep(index: number | null): void;
  deleteStepAt(index: number): void;
  deleteSelectedStep(): void;
  moveStep(fromIndex: number, toIndex: number): void;
  moveSelectedStep(direction: -1 | 1): void;
  beginReplaceSelectedStep(): void;
  cancelStepEdit(): void;
  switchToHand(hand: MotionColor): void;
  setAnimationCallback(
    callback: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): () => void;
  cancelPendingAction(): void;
}

export function createAssemblePathController(
  document: AssembleDocumentState,
  history: AssembleHistoryController
): AssemblePathController {
  let onAnimationRequest:
    | ((step: BuilderStep, durationMs?: number) => Promise<void>)
    | null = null;
  let pendingAction: (() => void) | null = null;

  function placeFirstPoint(location: GridLocation): void {
    const before = history.takeSnapshot();
    const orientation =
      location === GridLocation.CENTER ? Orientation.CENTER_N : Orientation.IN;
    document.currentPosition = location;
    document.currentOrientation = orientation;
    document.startPoses = {
      ...document.startPoses,
      [document.activeHand]: { location, orientation },
    };
    document.phase = "placing";
    history.notifyDocumentChange();
    history.recordSnapshot(
      `Place ${handLabel(document.activeHand)} start`,
      before
    );
  }

  async function addMotion(endLocation: GridLocation): Promise<void> {
    if (document.currentPosition === null) return;
    const before = history.takeSnapshot();
    const hand = document.activeHand;
    const step = createBuilderStep(
      {
        location: document.currentPosition,
        orientation: document.currentOrientation,
      },
      endLocation,
      document.rotationDirection,
      document.turnCount
    );

    document.phase = "animating";
    const animationPromise = onAnimationRequest
      ? onAnimationRequest(step)
      : Promise.resolve();

    if (hand === MotionColor.BLUE) {
      document.blueSteps = [...document.blueSteps, step];
    } else {
      document.redSteps = [...document.redSteps, step];
    }

    document.currentPosition = endLocation;
    document.currentOrientation = step.endOrientation;
    document.selectedStepIndex = null;
    document.stepEditMode = null;
    history.notifyDocumentChange();

    try {
      await animationPromise;
    } finally {
      document.phase = "building";
      const handSteps =
        hand === MotionColor.BLUE ? document.blueSteps : document.redSteps;
      history.recordSnapshot(
        `Add ${handLabel(hand)} step ${handSteps.length}`,
        before
      );
    }

    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      action();
    }
  }

  function replaceSelectedDestination(location: GridLocation): void {
    if (
      !document.canReplaceSelectedStep ||
      document.selectedStepIndex === null
    ) {
      return;
    }
    const pose = document.poseForHand(document.activeHand);
    if (!pose) return;

    const before = history.takeSnapshot();
    if (document.activeHand === MotionColor.BLUE) {
      document.blueSteps = replaceBuilderStepDestination(
        document.blueSteps,
        document.selectedStepIndex,
        location,
        pose
      );
    } else {
      document.redSteps = replaceBuilderStepDestination(
        document.redSteps,
        document.selectedStepIndex,
        location,
        pose
      );
    }
    const replacedIndex = document.selectedStepIndex;
    document.stepEditMode = null;
    document.syncActiveCursor();
    history.notifyDocumentChange();
    history.recordSnapshot(
      `Replace ${handLabel(document.activeHand)} step ${replacedIndex + 1}`,
      before
    );
  }

  function handlePointClick(location: GridLocation): void {
    if (document.phase === "animating" || document.phase === "complete") {
      return;
    }
    if (document.stepEditMode === "replace") {
      replaceSelectedDestination(location);
      return;
    }
    if (document.currentPosition === null) {
      placeFirstPoint(location);
      return;
    }
    void addMotion(location);
  }

  function finishHand(): void {
    if (!document.canFinishHand) return;
    if (document.phase === "animating") {
      pendingAction = finishHand;
      return;
    }
    const before = history.takeSnapshot();
    document.phase = "complete";
    document.selectedStepIndex = null;
    document.stepEditMode = null;
    history.recordSnapshot("Complete sequence", before);
  }

  function selectStep(index: number | null): void {
    if (document.phase === "animating") return;
    const total = Math.max(document.blueSteps.length, document.redSteps.length);
    if (index === null || index < 0 || index >= total) {
      document.selectedStepIndex = null;
      document.stepEditMode = null;
      return;
    }
    if (document.selectedStepIndex === index) {
      document.selectedStepIndex = null;
      document.stepEditMode = null;
      return;
    }
    document.selectedStepIndex = index;
    document.stepEditMode = null;
  }

  function deleteStepAt(index: number): void {
    if (document.phase === "animating") return;
    const total = Math.max(document.blueSteps.length, document.redSteps.length);
    if (index < 0 || index >= total) return;
    const before = history.takeSnapshot();
    const bluePose = document.poseForHand(MotionColor.BLUE);
    const redPose = document.poseForHand(MotionColor.RED);
    if (bluePose) {
      document.blueSteps = removeBuilderStep(
        document.blueSteps,
        index,
        bluePose
      );
    }
    if (redPose) {
      document.redSteps = removeBuilderStep(document.redSteps, index, redPose);
    }
    document.selectedStepIndex = null;
    document.stepEditMode = null;
    document.syncActiveCursor();
    history.notifyDocumentChange({ type: "delete-step", index });
    history.recordSnapshot(`Delete step ${index + 1}`, before);
  }

  function deleteSelectedStep(): void {
    if (document.selectedStepIndex === null) return;
    deleteStepAt(document.selectedStepIndex);
  }

  function moveStep(fromIndex: number, toIndex: number): void {
    if (!document.canReorderSteps || document.phase === "animating") return;
    const total = document.blueSteps.length;
    if (
      fromIndex < 0 ||
      fromIndex >= total ||
      toIndex < 0 ||
      toIndex >= total ||
      fromIndex === toIndex
    ) {
      return;
    }
    const bluePose = document.poseForHand(MotionColor.BLUE);
    const redPose = document.poseForHand(MotionColor.RED);
    if (!bluePose || !redPose) return;

    const before = history.takeSnapshot();
    document.blueSteps = moveBuilderStep(
      document.blueSteps,
      fromIndex,
      toIndex,
      bluePose
    );
    document.redSteps = moveBuilderStep(
      document.redSteps,
      fromIndex,
      toIndex,
      redPose
    );
    document.selectedStepIndex = toIndex;
    document.stepEditMode = null;
    document.syncActiveCursor();
    history.notifyDocumentChange({ type: "move-step", fromIndex, toIndex });
    history.recordSnapshot(
      `Move step ${fromIndex + 1} to ${toIndex + 1}`,
      before
    );
  }

  function moveSelectedStep(direction: -1 | 1): void {
    if (document.selectedStepIndex === null) return;
    moveStep(
      document.selectedStepIndex,
      document.selectedStepIndex + direction
    );
  }

  function beginReplaceSelectedStep(): void {
    if (!document.canReplaceSelectedStep) return;
    document.stepEditMode = "replace";
  }

  function cancelStepEdit(): void {
    document.stepEditMode = null;
  }

  function switchToHand(hand: MotionColor): void {
    if (
      hand === document.activeHand ||
      document.phase === "animating" ||
      document.phase === "complete"
    ) {
      return;
    }
    document.activeHand = hand;
    document.stepEditMode = null;
    document.syncActiveCursor();
  }

  function setAnimationCallback(
    callback: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): () => void {
    onAnimationRequest = callback;
    return () => {
      if (onAnimationRequest === callback) onAnimationRequest = null;
    };
  }

  function cancelPendingAction(): void {
    pendingAction = null;
  }

  return {
    handlePointClick,
    finishHand,
    selectStep,
    deleteStepAt,
    deleteSelectedStep,
    moveStep,
    moveSelectedStep,
    beginReplaceSelectedStep,
    cancelStepEdit,
    switchToHand,
    setAnimationCallback,
    cancelPendingAction,
  };
}
