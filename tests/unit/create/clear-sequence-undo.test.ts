import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceState } from "$lib/features/create/shared/state/sequence-state-orchestrator.svelte";

const mocks = vi.hoisted(() => ({
  setSuppressNextAnimation: vi.fn(),
  clearPropPositionCache: vi.fn(),
  clearArrowPositionCache: vi.fn(),
  setTransforming: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock(
  "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte",
  () => ({
    setSuppressNextAnimation: mocks.setSuppressNextAnimation,
  })
);
vi.mock("$lib/shared/pictograph/prop/prop-position-cache", () => ({
  clearPropPositionCache: mocks.clearPropPositionCache,
}));
vi.mock("$lib/shared/pictograph/arrow/rendering/arrow-position-cache", () => ({
  clearArrowPositionCache: mocks.clearArrowPositionCache,
}));
vi.mock(
  "$lib/shared/animation-engine/state/animation-visibility-state.svelte",
  () => ({
    getAnimationVisibilityManager: () => ({
      setTransforming: mocks.setTransforming,
    }),
  })
);
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: {
    info: mocks.toastInfo,
  },
}));

import {
  UndoManager,
  UndoOperationType,
} from "$lib/features/create/shared/services/undo-manager";
import { createUndoController } from "$lib/features/create/shared/state/create-module/undo-controller.svelte";

function sequenceFixture(): SequenceData {
  return {
    id: "sequence-before-clear",
    name: "Sequence before clear",
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
      },
      {
        id: "step-2",
        stepNumber: 2,
      },
    ],
  } as SequenceData;
}

function sequenceStateHarness(initialSequence: SequenceData) {
  let currentSequence: SequenceData | null = initialSequence;
  let selectedStepNumber: number | null = 2;

  const state = {
    get currentSequence() {
      return currentSequence;
    },
    get selectedStepNumber() {
      return selectedStepNumber;
    },
    setCurrentSequence(sequence: SequenceData | null) {
      currentSequence = sequence;
    },
    selectStep(stepNumber: number) {
      selectedStepNumber = stepNumber;
    },
    clearSelection() {
      selectedStepNumber = null;
    },
    clearSequenceCompletely: vi.fn(),
  } as unknown as SequenceState;

  return {
    state,
    clear() {
      currentSequence = null;
      selectedStepNumber = null;
    },
  };
}

describe("cleared sequence undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback): number => {
        callback(0);
        return 1;
      }
    );
  });

  it("restores the complete pre-clear sequence and picker state in one undo", async () => {
    const originalSequence = sequenceFixture();
    const harness = sequenceStateHarness(originalSequence);
    const undoManager = new UndoManager();
    const syncPickerState = vi.fn();
    const controller = createUndoController({
      UndoManager: undoManager,
      sequenceState: harness.state,
      getActiveSection: () => "construct",
      setActiveSectionInternal: vi.fn(),
    });
    controller.setSyncPickerStateCallback(syncPickerState);

    controller.pushUndoSnapshot(UndoOperationType.CLEAR_SEQUENCE, {
      description: "Clear sequence",
    });
    await Promise.resolve();
    harness.clear();

    expect(controller.nextUndoEntry?.type).toBe(
      UndoOperationType.CLEAR_SEQUENCE
    );
    expect(controller.undo()).toBe(true);
    expect(harness.state.currentSequence).toEqual(originalSequence);
    expect(harness.state.currentSequence).not.toBe(originalSequence);
    expect(harness.state.currentSequence?.steps).not.toBe(
      originalSequence.steps
    );
    expect(harness.state.selectedStepNumber).toBe(2);
    expect(syncPickerState).toHaveBeenCalledOnce();
  });

  it("finds the next undo for Construct even when another tab changed later", () => {
    const undoManager = new UndoManager();
    const sequence = sequenceFixture();

    undoManager.pushUndo(
      UndoOperationType.CLEAR_SEQUENCE,
      {
        sequence,
        selectedStepNumber: 2,
        activeSection: "construct",
        timestamp: 1,
      },
      { description: "Clear sequence" }
    );
    undoManager.pushUndo(
      UndoOperationType.GENERATE_SEQUENCE,
      {
        sequence,
        selectedStepNumber: null,
        activeSection: "generate",
        timestamp: 2,
      },
      { description: "Generate sequence" }
    );

    expect(undoManager.getLastUndoEntry("construct")?.type).toBe(
      UndoOperationType.CLEAR_SEQUENCE
    );
    expect(undoManager.getLastUndoEntry("generate")?.type).toBe(
      UndoOperationType.GENERATE_SEQUENCE
    );
  });
});
