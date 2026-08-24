import { afterEach, describe, expect, it } from "vitest";
import { Viewer3DUndoManager } from "@austencloud/scene-3d";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function makeState() {
  const viewer3DUndoManager = new Viewer3DUndoManager();
  const { state, dispose } = createViewer3DStateForTest({
    viewer3DUndoManager,
  });
  cleanups.push(dispose);
  state.performerManager.initialize();
  return state;
}

describe("viewer3d performer count", () => {
  it("converges in both directions with one undo entry per change", () => {
    const state = makeState();
    const initialHistorySize = state.sceneUndo.historySize;

    state.setPerformerCountFromUI(8);
    expect(state.performerManager.performers).toHaveLength(8);
    expect(state.sceneUndo.historySize).toBe(initialHistorySize + 1);

    state.setPerformerCountFromUI(1);
    expect(state.performerManager.performers).toHaveLength(1);
    expect(state.sceneUndo.historySize).toBe(initialHistorySize + 2);
  });

  it("clamps targets above the performer manager cap", () => {
    const state = makeState();
    const initialHistorySize = state.sceneUndo.historySize;

    state.setPerformerCountFromUI(100);

    expect(state.performerManager.performers).toHaveLength(
      state.performerManager.maxPerformers
    );
    expect(state.sceneUndo.historySize).toBe(initialHistorySize + 1);
  });
});
