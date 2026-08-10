import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { TargetHand } from "../state/panel-coordination-state.svelte";
import type { ExtensionFlowCoordinator } from "./extension-flow-coordinator";
import {
  analyzeSelection,
  getResultMessage,
  type FirstBeatAnalysisResult,
  type FirstBeatResult,
} from "./first-step-analyzer";
import type {
  BridgeAppendResult,
  ExtensionApplyResult,
  ExtensionFlowStart,
} from "./sequence-extender";
import { UndoOperationType } from "./undo-manager";

export interface SequenceActionsSequenceState {
  currentSequence: SequenceData | null;
  mirrorSequence(targetHand: TargetHand): Promise<void>;
  swapColors(): Promise<void>;
  rewindSequence(targetHand: TargetHand): Promise<void>;
  flipSequence(targetHand: TargetHand): Promise<void>;
  invertSequence(targetHand: TargetHand): Promise<void>;
  rotateSequence(
    direction: "clockwise" | "counterclockwise",
    targetHand: TargetHand
  ): Promise<void>;
  setCurrentSequence(sequence: SequenceData): void;
  shiftStartPosition(stepNumber: number): Promise<void>;
}

export interface SequenceActionsBusyState {
  beginTransform(): boolean;
  finishTransform(): void;
  beginExtension(): boolean;
  finishExtension(): void;
}

export interface SequenceActionsOrchestratorDeps {
  getSequenceState: () => SequenceActionsSequenceState;
  getTargetHand: () => TargetHand;
  hapticService: HapticFeedback | null;
  pushUndoSnapshot: (type: UndoOperationType) => void;
  busyState: SequenceActionsBusyState;
  extensionFlowCoordinator: ExtensionFlowCoordinator | null;
  setGridRotationDirection?: (direction: 1 | -1) => void;
  finishShiftStart: () => void;
  copySequenceJson?: (sequence: SequenceData) => Promise<boolean>;
}

export type SequenceActionResult<T = never> =
  | ({ status: "completed" } & ([T] extends [never] ? object : { value: T }))
  | { status: "busy" }
  | { status: "unavailable"; message: string }
  | { status: "failed"; message: string };

function completed(): SequenceActionResult {
  return { status: "completed" };
}

function completedWith<T>(value: T): SequenceActionResult<T> {
  return { status: "completed", value } as SequenceActionResult<T>;
}

export function createSequenceActionsOrchestrator(
  deps: SequenceActionsOrchestratorDeps
) {
  async function executeTransform(
    undoType: UndoOperationType,
    action: (state: SequenceActionsSequenceState) => Promise<void>,
    beforeAction?: () => void
  ): Promise<SequenceActionResult> {
    const state = deps.getSequenceState();
    if (!state.currentSequence) {
      return { status: "unavailable", message: "No active sequence" };
    }
    if (!deps.busyState.beginTransform()) return { status: "busy" };

    deps.hapticService?.trigger("selection");
    try {
      deps.pushUndoSnapshot(undoType);
      beforeAction?.();
      await action(state);
      return completed();
    } finally {
      deps.busyState.finishTransform();
    }
  }

  function applyPattern(
    undoType:
      | UndoOperationType.APPLY_TURN_PATTERN
      | UndoOperationType.APPLY_ROTATION_PATTERN
      | UndoOperationType.APPLY_DURATION_PATTERN,
    nextSequence: SequenceData,
    beforeApply?: () => void
  ): void {
    deps.pushUndoSnapshot(undoType);
    beforeApply?.();
    deps.getSequenceState().setCurrentSequence(nextSequence);
    deps.hapticService?.trigger("success");
  }

  async function startExtension(): Promise<
    SequenceActionResult<ExtensionFlowStart>
  > {
    const sequence = deps.getSequenceState().currentSequence;
    const coordinator = deps.extensionFlowCoordinator;
    if (!sequence || !coordinator) {
      return {
        status: "unavailable",
        message: "Cannot extend without an active sequence",
      };
    }
    if (!deps.busyState.beginExtension()) return { status: "busy" };

    deps.hapticService?.trigger("selection");
    try {
      const result = await coordinator.startFlow(sequence);
      if (!result.canExtend) {
        return {
          status: "failed",
          message: result.errorMessage || "Cannot extend this sequence",
        };
      }
      return completedWith(result);
    } finally {
      deps.busyState.finishExtension();
    }
  }

  async function appendBridge(
    bridgeLetter: Letter
  ): Promise<SequenceActionResult<BridgeAppendResult>> {
    const sequence = deps.getSequenceState().currentSequence;
    const coordinator = deps.extensionFlowCoordinator;
    if (!sequence || !coordinator) {
      return {
        status: "unavailable",
        message: "Cannot add a bridge without an active sequence",
      };
    }
    if (!deps.busyState.beginExtension()) return { status: "busy" };

    deps.hapticService?.trigger("selection");
    try {
      deps.pushUndoSnapshot(UndoOperationType.ADD_BEAT);
      const result = await coordinator.appendBridge(sequence, bridgeLetter);
      if (result.success && result.sequence) {
        deps.getSequenceState().setCurrentSequence(result.sequence);
        deps.hapticService?.trigger("success");
        return completedWith(result);
      }

      deps.hapticService?.trigger("error");
      return { status: "failed", message: result.message };
    } finally {
      deps.busyState.finishExtension();
    }
  }

  async function applyLoop(
    loopType: LOOPType
  ): Promise<SequenceActionResult<ExtensionApplyResult>> {
    const sequence = deps.getSequenceState().currentSequence;
    const coordinator = deps.extensionFlowCoordinator;
    if (!sequence || !coordinator) {
      return {
        status: "unavailable",
        message: "Cannot extend without an active sequence",
      };
    }
    if (!deps.busyState.beginExtension()) return { status: "busy" };

    deps.hapticService?.trigger("selection");
    try {
      deps.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);
      const result = await coordinator.applyLoop(sequence, loopType);
      if (result.success && result.sequence) {
        deps.getSequenceState().setCurrentSequence(result.sequence);
        deps.hapticService?.trigger("success");
        return completedWith(result);
      }

      deps.hapticService?.trigger("error");
      return { status: "failed", message: result.message };
    } finally {
      deps.busyState.finishExtension();
    }
  }

  function applyOrientationRepeat(): SequenceActionResult<ExtensionApplyResult> {
    const sequence = deps.getSequenceState().currentSequence;
    const coordinator = deps.extensionFlowCoordinator;
    if (!sequence || !coordinator) {
      return {
        status: "unavailable",
        message: "Cannot extend without an active sequence",
      };
    }
    if (!deps.busyState.beginExtension()) return { status: "busy" };

    deps.hapticService?.trigger("selection");
    try {
      deps.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);
      const result = coordinator.applyOrientationRepeat(sequence);
      if (result.success && result.sequence) {
        deps.getSequenceState().setCurrentSequence(result.sequence);
        deps.hapticService?.trigger("success");
        return completedWith(result);
      }

      deps.hapticService?.trigger("error");
      return { status: "failed", message: result.message };
    } finally {
      deps.busyState.finishExtension();
    }
  }

  function analyzeShiftStart(
    stepNumber: number
  ): FirstBeatAnalysisResult | null {
    const sequence = deps.getSequenceState().currentSequence;
    return sequence ? analyzeSelection(sequence, stepNumber) : null;
  }

  async function shiftStart(
    stepNumber: number
  ): Promise<SequenceActionResult<FirstBeatResult>> {
    const state = deps.getSequenceState();
    const sequence = state.currentSequence;
    if (!sequence) {
      return { status: "unavailable", message: "No active sequence" };
    }
    if (!deps.busyState.beginTransform()) return { status: "busy" };

    try {
      deps.pushUndoSnapshot(UndoOperationType.SHIFT_START);
      await state.shiftStartPosition(stepNumber);
      const result = getResultMessage(sequence, stepNumber);
      deps.hapticService?.trigger("success");
      return completedWith(result);
    } catch (error) {
      console.error("[ShiftStart] Failed:", error);
      deps.hapticService?.trigger("error");
      return { status: "failed", message: "Could not shift start position" };
    } finally {
      deps.busyState.finishTransform();
      deps.finishShiftStart();
    }
  }

  async function copySequenceJson(): Promise<SequenceActionResult> {
    const sequence = deps.getSequenceState().currentSequence;
    if (!sequence || !deps.copySequenceJson) {
      return { status: "unavailable", message: "No active sequence" };
    }

    deps.hapticService?.trigger("selection");
    const success = await deps.copySequenceJson(sequence);
    return success
      ? completed()
      : { status: "failed", message: "Failed to copy to clipboard" };
  }

  return {
    mirror: () =>
      executeTransform(UndoOperationType.MIRROR_SEQUENCE, (state) =>
        state.mirrorSequence(deps.getTargetHand())
      ),
    swap: () =>
      executeTransform(UndoOperationType.SWAP_COLORS, (state) =>
        state.swapColors()
      ),
    rewind: () =>
      executeTransform(UndoOperationType.REWIND_SEQUENCE, (state) =>
        state.rewindSequence(deps.getTargetHand())
      ),
    flip: () =>
      executeTransform(UndoOperationType.FLIP_SEQUENCE, (state) =>
        state.flipSequence(deps.getTargetHand())
      ),
    invert: () =>
      executeTransform(UndoOperationType.INVERT_SEQUENCE, (state) =>
        state.invertSequence(deps.getTargetHand())
      ),
    rotateClockwise: () =>
      executeTransform(
        UndoOperationType.ROTATE_SEQUENCE,
        (state) => state.rotateSequence("clockwise", deps.getTargetHand()),
        () => deps.setGridRotationDirection?.(1)
      ),
    rotateCounterclockwise: () =>
      executeTransform(
        UndoOperationType.ROTATE_SEQUENCE,
        (state) =>
          state.rotateSequence("counterclockwise", deps.getTargetHand()),
        () => deps.setGridRotationDirection?.(-1)
      ),
    applyPattern,
    startExtension,
    appendBridge,
    applyLoop,
    applyOrientationRepeat,
    analyzeShiftStart,
    shiftStart,
    copySequenceJson,
  };
}

export type SequenceActionsOrchestrator = ReturnType<
  typeof createSequenceActionsOrchestrator
>;
