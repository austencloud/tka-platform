import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";
import { Viewer3DUndoManager } from "@austencloud/scene-3d";
import { __resetWebGL2CapabilityForTests } from "$lib/shared/3d/capabilities/webgl-capabilities";

// The jsdom test environment doesn't implement canvas.getContext. Patch
// document.createElement so the WebGL2 capability probe sees a canvas stub
// that returns null from getContext (= "not supported"), which is fine —
// these tests never enter actual 3D rendering.
beforeAll(() => {
  const originalCreateElement = document.createElement as unknown as (tag: string) => unknown;
  (document as unknown as { createElement: (tag: string) => unknown }).createElement = (tag: string) => {
    const base = originalCreateElement(tag) as Record<string, unknown>;
    if (tag === "canvas") {
      base.getContext = () => null;
    }
    return base;
  };
  __resetWebGL2CapabilityForTests();
});

function stubDeps() {
  return {
    viewer3DUndoManager: new Viewer3DUndoManager(),
  };
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function makeState() {
  const { state, dispose } = createViewer3DStateForTest(stubDeps());
  cleanups.push(dispose);
  return state;
}

describe("viewer3d integration: spawn → formation → undo", () => {
  it("spawns 3 performers, applies tunnel-stack, then v-shape, undoes both", () => {
    const state = makeState();
    state.performerManager.initialize();

    // Spawn two more performers → total 3.
    state.spawnPerformerFromUI();
    state.spawnPerformerFromUI();
    expect(state.performerManager.performers.length).toBe(3);

    // Apply tunnel-stack, then v-shape.
    state.applyFormationFromUI("tunnel-stack");
    expect(state.activeFormation).toBe("tunnel-stack");

    state.applyFormationFromUI("v-shape");
    expect(state.activeFormation).toBe("v-shape");

    // Undo v-shape → tunnel-stack.
    state.undo();
    expect(state.activeFormation).toBe("tunnel-stack");

    // Undo tunnel-stack → manual.
    state.undo();
    expect(state.activeFormation).toBe("manual");
  });

  it("caps performers at MAX_VIEWER_PERFORMERS (8)", () => {
    const state = makeState();
    state.performerManager.initialize();
    for (let i = 0; i < 10; i++) {
      state.spawnPerformerFromUI();
    }
    expect(state.performerManager.performers.length).toBe(8);
  });

  it("silently ignores formation presets that don't match the current count", () => {
    const state = makeState();
    state.performerManager.initialize();
    // Count is 1. 'stage-lr' requires 2 performers.
    state.applyFormationFromUI("stage-lr");
    expect(state.activeFormation).toBe("manual");
  });
});
