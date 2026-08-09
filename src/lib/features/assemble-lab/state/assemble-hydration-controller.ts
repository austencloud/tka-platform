import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  cloneBuilderSteps,
  cloneStartPoses,
  type AssembleDocumentState,
} from "./assemble-document-state.svelte";
import type { AssembleHistoryController } from "./assemble-history-controller";
import type { AssembleStateHydration } from "./assemble-state-types";

export interface AssembleHydrationController {
  hydrateFromExternalSequence(
    snapshot: AssembleStateHydration,
    previousDocument: unknown,
    label?: string
  ): void;
  hydrateFromSequence(snapshot: AssembleStateHydration): void;
}

export function createAssembleHydrationController(
  document: AssembleDocumentState,
  history: AssembleHistoryController,
  cancelPendingAction: () => void
): AssembleHydrationController {
  function applyHydration(snapshot: AssembleStateHydration): void {
    cancelPendingAction();
    document.blueSteps = cloneBuilderSteps(snapshot.blueSteps);
    document.redSteps = cloneBuilderSteps(snapshot.redSteps);
    document.startPoses = cloneStartPoses(snapshot.startPoses);
    document.gridMode = snapshot.gridMode;
    document.showCenter =
      [...document.blueSteps, ...document.redSteps].some(
        (step) =>
          step.startPosition === GridLocation.CENTER ||
          step.endPosition === GridLocation.CENTER
      ) ||
      Object.values(document.startPoses).some(
        (pose) => pose?.location === GridLocation.CENTER
      );

    if (document.blueSteps.length > document.redSteps.length) {
      document.activeHand = MotionColor.RED;
    } else if (document.redSteps.length > document.blueSteps.length) {
      document.activeHand = MotionColor.BLUE;
    } else if (
      document.blueSteps.length === 0 &&
      document.startPoses[MotionColor.RED] &&
      !document.startPoses[MotionColor.BLUE]
    ) {
      document.activeHand = MotionColor.RED;
    } else {
      document.activeHand = MotionColor.BLUE;
    }

    document.selectedStepIndex = null;
    document.stepEditMode = null;
    document.syncActiveCursor();
  }

  function matchesCurrentHydration(snapshot: AssembleStateHydration): boolean {
    return (
      document.gridMode === snapshot.gridMode &&
      JSON.stringify(document.startPoses) ===
        JSON.stringify(snapshot.startPoses) &&
      JSON.stringify(document.blueSteps) ===
        JSON.stringify(snapshot.blueSteps) &&
      JSON.stringify(document.redSteps) === JSON.stringify(snapshot.redSteps)
    );
  }

  function hydrateFromExternalSequence(
    snapshot: AssembleStateHydration,
    previousDocument: unknown,
    label = "Edit sequence"
  ): void {
    history.beginExternalHydration(previousDocument, label);
    if (!matchesCurrentHydration(snapshot)) {
      const previousHand = document.activeHand;
      const previousSelection = document.selectedStepIndex;
      applyHydration(snapshot);
      const previousHandHasContent =
        Boolean(document.startPoses[previousHand]) ||
        (previousHand === MotionColor.BLUE
          ? document.blueSteps.length > 0
          : document.redSteps.length > 0);
      if (previousHandHasContent) document.activeHand = previousHand;
      const total = Math.max(
        document.blueSteps.length,
        document.redSteps.length
      );
      document.selectedStepIndex =
        previousSelection !== null && previousSelection < total
          ? previousSelection
          : null;
      document.syncActiveCursor();
    }
    history.scheduleExternalEditFinalization();
  }

  function hydrateFromSequence(snapshot: AssembleStateHydration): void {
    applyHydration(snapshot);
    history.clearHistory();
  }

  return { hydrateFromExternalSequence, hydrateFromSequence };
}
