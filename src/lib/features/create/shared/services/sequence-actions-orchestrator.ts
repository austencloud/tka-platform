import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { ExtensionFlowCoordinator } from "./extension-flow-coordinator";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { UndoOperationType } from "./undo-manager";

export interface SequenceActionsOrchestratorDeps {
  hapticService: HapticFeedback | null;
  extensionFlowCoordinator: ExtensionFlowCoordinator | null;
  getActiveSequenceState: () => {
    currentSequence: SequenceData | null;
    hasSequence(): boolean;
    mirrorSequence(hand: string): Promise<void>;
    swapColors(): Promise<void>;
    rewindSequence(hand: string): Promise<void>;
    flipSequence(hand: string): Promise<void>;
    invertSequence(hand: string): Promise<void>;
    rotateSequence(dir: string, hand: string): Promise<void>;
    setCurrentSequence(seq: unknown): void;
    shiftStartPosition(step: number): Promise<void>;
  };
  pushUndoSnapshot: (type: UndoOperationType) => void;
  targetHand: () => string;
}

export interface TransformResult {
  success: boolean;
  error?: string;
}

export async function executeTransform(
  deps: SequenceActionsOrchestratorDeps,
  undoType: UndoOperationType,
  action: () => Promise<void>,
  beforeAction?: () => void,
): Promise<TransformResult> {
  const sequence = deps.getActiveSequenceState().currentSequence;
  if (!sequence) return { success: false, error: "No active sequence" };

  deps.hapticService?.trigger("selection");
  deps.pushUndoSnapshot(undoType);
  beforeAction?.();

  try {
    await action();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function createTransformHandlers(deps: SequenceActionsOrchestratorDeps) {
  const state = deps.getActiveSequenceState;

  return {
    mirror: () => executeTransform(deps, UndoOperationType.MIRROR_SEQUENCE, () =>
      state().mirrorSequence(deps.targetHand())
    ),
    swap: () => executeTransform(deps, UndoOperationType.SWAP_COLORS, () =>
      state().swapColors()
    ),
    rewind: () => executeTransform(deps, UndoOperationType.REWIND_SEQUENCE, () =>
      state().rewindSequence(deps.targetHand())
    ),
    flip: () => executeTransform(deps, UndoOperationType.FLIP_SEQUENCE, () =>
      state().flipSequence(deps.targetHand())
    ),
    invert: () => executeTransform(deps, UndoOperationType.INVERT_SEQUENCE, () =>
      state().invertSequence(deps.targetHand())
    ),
    rotateCW: (beforeAction?: () => void) => executeTransform(
      deps,
      UndoOperationType.ROTATE_SEQUENCE,
      () => state().rotateSequence("clockwise", deps.targetHand()),
      beforeAction,
    ),
    rotateCCW: (beforeAction?: () => void) => executeTransform(
      deps,
      UndoOperationType.ROTATE_SEQUENCE,
      () => state().rotateSequence("counterclockwise", deps.targetHand()),
      beforeAction,
    ),
  };
}

export interface ExtendFlowResult {
  success: boolean;
  message: string;
  analysis?: unknown;
  circularizationOptions?: unknown[];
  directUnavailableReason?: string | null;
}

export async function startExtendFlow(
  extensionFlowCoordinator: ExtensionFlowCoordinator | null,
  sequence: SequenceData | null,
): Promise<ExtendFlowResult> {
  if (!sequence || !extensionFlowCoordinator) {
    return { success: false, message: "Cannot extend - missing sequence or coordinator" };
  }

  const result = await extensionFlowCoordinator.startFlow(sequence);

  if (!result.canExtend) {
    return { success: false, message: result.errorMessage || "Cannot extend this sequence" };
  }

  return {
    success: true,
    message: "Ready to extend",
    analysis: result.analysis,
    circularizationOptions: result.circularizationOptions,
    directUnavailableReason: result.directUnavailableReason,
  };
}

export async function appendBridge(
  deps: SequenceActionsOrchestratorDeps,
  sequence: SequenceData,
  bridgeLetter: Letter,
): Promise<{ success: boolean; message: string; sequence?: unknown; analysis?: unknown }> {
  if (!deps.extensionFlowCoordinator) {
    return { success: false, message: "Extension coordinator not available" };
  }

  deps.pushUndoSnapshot(UndoOperationType.ADD_BEAT);

  const result = await deps.extensionFlowCoordinator.appendBridge(sequence, bridgeLetter);

  if (result.success && result.sequence) {
    deps.getActiveSequenceState().setCurrentSequence(result.sequence);
    deps.hapticService?.trigger("success");
    return { success: true, message: result.message, sequence: result.sequence, analysis: result.analysis };
  }

  deps.hapticService?.trigger("error");
  return { success: false, message: result.message };
}

export async function applyLoop(
  deps: SequenceActionsOrchestratorDeps,
  sequence: SequenceData,
  loopType: LOOPType,
): Promise<{ success: boolean; message: string; sequence?: unknown }> {
  if (!deps.extensionFlowCoordinator) {
    return { success: false, message: "Extension coordinator not available" };
  }

  deps.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);

  const result = await deps.extensionFlowCoordinator.applyLoop(sequence, loopType);

  if (result.success && result.sequence) {
    deps.getActiveSequenceState().setCurrentSequence(result.sequence);
    deps.hapticService?.trigger("success");
    return { success: true, message: result.message, sequence: result.sequence };
  }

  deps.hapticService?.trigger("error");
  return { success: false, message: result.message };
}

export async function executeShiftStart(
  deps: SequenceActionsOrchestratorDeps,
  stepNumber: number,
): Promise<{ success: boolean; message?: string }> {
  const sequence = deps.getActiveSequenceState().currentSequence;
  if (!sequence) return { success: false, message: "No sequence" };

  deps.pushUndoSnapshot(UndoOperationType.SHIFT_START);

  try {
    await deps.getActiveSequenceState().shiftStartPosition(stepNumber);
    deps.hapticService?.trigger("success");
    return { success: true };
  } catch (err) {
    deps.hapticService?.trigger("error");
    return { success: false, message: String(err) };
  }
}
