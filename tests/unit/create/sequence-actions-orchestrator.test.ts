import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { UndoOperationType } from "$lib/features/create/shared/services/undo-manager";
import {
  createSequenceActionsOrchestrator,
  type SequenceActionsOrchestratorDeps,
} from "$lib/features/create/shared/services/sequence-actions-orchestrator";

const sequence = { id: "sequence-1", steps: [] } as unknown as SequenceData;
const updatedSequence = {
  id: "sequence-2",
  steps: [],
} as unknown as SequenceData;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness(
  overrides: Partial<SequenceActionsOrchestratorDeps> = {}
) {
  const events: string[] = [];
  let transformBusy = false;
  let extensionBusy = false;

  const sequenceState = {
    currentSequence: sequence as SequenceData | null,
    mirrorSequence: vi.fn(async () => {
      events.push("mirror");
    }),
    swapHands: vi.fn(async () => {
      events.push("swap");
    }),
    rewindSequence: vi.fn(async () => {
      events.push("rewind");
    }),
    flipSequence: vi.fn(async () => {
      events.push("flip");
    }),
    invertSequence: vi.fn(async () => {
      events.push("invert");
    }),
    rotateSequence: vi.fn(async () => {
      events.push("rotate");
    }),
    setCurrentSequence: vi.fn((next: SequenceData) => {
      events.push("set-sequence");
      sequenceState.currentSequence = next;
    }),
    shiftStartPosition: vi.fn(async () => {
      events.push("shift");
    }),
  };

  const deps: SequenceActionsOrchestratorDeps = {
    getSequenceState: () => sequenceState,
    getTargetHand: () => "both",
    hapticService: {
      trigger: vi.fn((kind: string) => events.push(`haptic:${kind}`)),
    } as SequenceActionsOrchestratorDeps["hapticService"],
    pushUndoSnapshot: vi.fn((type: UndoOperationType) =>
      events.push(`undo:${type}`)
    ),
    busyState: {
      beginTransform() {
        if (transformBusy) return false;
        transformBusy = true;
        return true;
      },
      finishTransform() {
        transformBusy = false;
      },
      beginExtension() {
        if (extensionBusy) return false;
        extensionBusy = true;
        return true;
      },
      finishExtension() {
        extensionBusy = false;
      },
    },
    extensionFlowCoordinator: null,
    finishShiftStart: vi.fn(() => events.push("finish-shift")),
    ...overrides,
  };

  return {
    events,
    sequenceState,
    deps,
    orchestrator: createSequenceActionsOrchestrator(deps),
  };
}

describe("sequence actions orchestrator", () => {
  it("takes the undo snapshot before a transform and blocks a duplicate invocation", async () => {
    const pending = deferred();
    const harness = createHarness();
    harness.sequenceState.mirrorSequence.mockImplementation(async () => {
      harness.events.push("mirror");
      await pending.promise;
    });

    const first = harness.orchestrator.mirror();
    const duplicate = await harness.orchestrator.mirror();

    expect(duplicate).toEqual({ status: "busy" });
    expect(harness.events).toEqual([
      "haptic:selection",
      `undo:${UndoOperationType.MIRROR_SEQUENCE}`,
      "mirror",
    ]);

    pending.resolve();
    await expect(first).resolves.toEqual({ status: "completed" });
  });

  it("sets rotation direction after the snapshot but before the transform", async () => {
    const harness = createHarness({
      setGridRotationDirection: (direction) =>
        harness.events.push(`grid:${direction}`),
    });

    await harness.orchestrator.rotateClockwise();

    expect(harness.events).toEqual([
      "haptic:selection",
      `undo:${UndoOperationType.ROTATE_SEQUENCE}`,
      "grid:1",
      "rotate",
    ]);
  });

  it("applies a pattern only after its undo snapshot", () => {
    const harness = createHarness();

    harness.orchestrator.applyPattern(
      UndoOperationType.APPLY_DURATION_PATTERN,
      updatedSequence,
      () => harness.events.push("before-apply")
    );

    expect(harness.events).toEqual([
      `undo:${UndoOperationType.APPLY_DURATION_PATTERN}`,
      "before-apply",
      "set-sequence",
      "haptic:success",
    ]);
  });

  it("serializes bridge appends and updates the sequence only on success", async () => {
    const pending = deferred();
    const harness = createHarness({
      extensionFlowCoordinator: {
        appendBridge: vi.fn(async () => {
          harness.events.push("append-bridge");
          await pending.promise;
          return {
            success: true,
            sequence: updatedSequence,
            analysis: { canExtend: true },
            message: "Bridge added",
          };
        }),
      } as unknown as SequenceActionsOrchestratorDeps["extensionFlowCoordinator"],
    });

    const first = harness.orchestrator.appendBridge("A");
    const duplicate = await harness.orchestrator.appendBridge("B");

    expect(duplicate).toEqual({ status: "busy" });
    expect(harness.events).toEqual([
      "haptic:selection",
      `undo:${UndoOperationType.ADD_BEAT}`,
      "append-bridge",
    ]);

    pending.resolve();
    const result = await first;
    expect(result.status).toBe("completed");
    expect(harness.events.slice(-2)).toEqual([
      "set-sequence",
      "haptic:success",
    ]);
  });

  it("always releases the transform guard and exits shift-start mode after failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const harness = createHarness();
    harness.sequenceState.shiftStartPosition.mockRejectedValueOnce(
      new Error("shift failed")
    );

    await expect(harness.orchestrator.shiftStart(3)).resolves.toMatchObject({
      status: "failed",
      message: "Could not shift start position",
    });
    expect(harness.events).toEqual([
      `undo:${UndoOperationType.SHIFT_START}`,
      "haptic:error",
      "finish-shift",
    ]);

    harness.sequenceState.shiftStartPosition.mockResolvedValueOnce(undefined);
    await expect(harness.orchestrator.shiftStart(2)).resolves.toMatchObject({
      status: "completed",
    });
    consoleError.mockRestore();
  });
});
