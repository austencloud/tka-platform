import type { AssembleSnapshot } from "../state/assemble-state-types";

export type AssembleHistoryDirection = "undo" | "redo";

export type AssembleHistoryConsequence =
  | "active-hand"
  | "cursor"
  | "document"
  | "edit-mode"
  | "grid"
  | "orientation"
  | "path"
  | "phase"
  | "rotation"
  | "selection"
  | "start-poses"
  | "turn-count";

export interface AssembleHistoryTransition {
  readonly direction: AssembleHistoryDirection;
  readonly label: string;
  readonly consequences: ReadonlySet<AssembleHistoryConsequence>;
  readonly affectsBuilderPath: boolean;
  readonly affectsControls: boolean;
  readonly affectsGrid: boolean;
}

export function createAssembleHistoryTransition(
  direction: AssembleHistoryDirection,
  label: string,
  from: AssembleSnapshot,
  to: AssembleSnapshot
): AssembleHistoryTransition {
  const consequences = new Set<AssembleHistoryConsequence>();

  addIfChanged(consequences, "phase", from.phase, to.phase);
  addIfChanged(consequences, "active-hand", from.activeHand, to.activeHand);
  addIfChanged(
    consequences,
    "grid",
    [from.gridMode, from.showCenter],
    [to.gridMode, to.showCenter]
  );
  addIfChanged(consequences, "start-poses", from.startPoses, to.startPoses);
  addIfChanged(
    consequences,
    "path",
    [from.leftSteps, from.rightSteps],
    [to.leftSteps, to.rightSteps]
  );
  addIfChanged(
    consequences,
    "cursor",
    from.currentPosition,
    to.currentPosition
  );
  addIfChanged(
    consequences,
    "orientation",
    from.currentOrientation,
    to.currentOrientation
  );
  addIfChanged(
    consequences,
    "rotation",
    from.rotationDirection,
    to.rotationDirection
  );
  addIfChanged(consequences, "turn-count", from.turnCount, to.turnCount);
  addIfChanged(
    consequences,
    "selection",
    from.selectedStepIndex,
    to.selectedStepIndex
  );
  addIfChanged(consequences, "edit-mode", from.stepEditMode, to.stepEditMode);
  addIfChanged(consequences, "document", from.document, to.document);

  return {
    direction,
    label,
    consequences,
    affectsBuilderPath:
      consequences.has("path") ||
      consequences.has("start-poses") ||
      consequences.has("cursor"),
    affectsControls:
      consequences.has("active-hand") ||
      consequences.has("orientation") ||
      consequences.has("rotation") ||
      consequences.has("turn-count") ||
      consequences.has("selection") ||
      consequences.has("edit-mode") ||
      consequences.has("phase"),
    affectsGrid: consequences.has("grid"),
  };
}

function addIfChanged(
  consequences: Set<AssembleHistoryConsequence>,
  consequence: AssembleHistoryConsequence,
  from: unknown,
  to: unknown
): void {
  if (from === to) return;
  if (JSON.stringify(from) === JSON.stringify(to)) return;
  consequences.add(consequence);
}
