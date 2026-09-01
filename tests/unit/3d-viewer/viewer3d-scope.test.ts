import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";
import { __resetWebGL2CapabilityForTests } from "$lib/shared/3d/capabilities/webgl-capabilities";
import { Plane } from "@austencloud/scene-3d";
import { tick } from "svelte";

// The global test setup replaces document.createElement with a generic stub
// that returns plain objects lacking getContext. The viewer3d factory's
// WebGL2 detection calls document.createElement("canvas").getContext("webgl2"),
// so we extend the stub to return a canvas-like object for that specific tag.
// getContext returns null so the capability probe reports "not supported",
// which is fine — these scope tests never actually enter 3D mode.
beforeAll(() => {
  const originalCreateElement = document.createElement.bind(
    document
  ) as unknown as (tag: string) => unknown;
  (
    document as unknown as { createElement: (tag: string) => unknown }
  ).createElement = (tag: string) => {
    const base = originalCreateElement(tag) as Record<string, unknown>;
    if (tag === "canvas") {
      base.getContext = () => null;
    }
    return base;
  };
  // Clear the module-level cache so the first factory call re-probes against
  // the stub we just installed, not a stale result from some earlier test file.
  __resetWebGL2CapabilityForTests();
});

function stubDeps() {
  return {};
}

// createViewer3DState sets up $effect internally, which requires an effect
// root. The helper wraps the factory in $effect.root and returns a teardown.
const cleanups: Array<() => void> = [];
function makeState() {
  const { state, dispose } = createViewer3DStateForTest(stubDeps());
  cleanups.push(dispose);
  return state;
}

function makeSeeded3DState() {
  const { state, dispose } = createViewer3DStateForTest({ renderMode: "3d" });
  cleanups.push(dispose);
  return state;
}
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("viewer-3d-state: selection scope", () => {
  it("defaults selection to null (All)", () => {
    const state = makeState();
    expect(state.selectedPerformerIndex).toBeNull();
  });

  it("scopedPerformers returns all performers when selection is null", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.performerManager.addPerformer();
    expect(state.scopedPerformers().length).toBe(3);
  });

  it("scopedPerformers returns one performer when selection is a valid index", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.selectPerformerScope(1);
    expect(state.scopedPerformers().length).toBe(1);
    expect(state.scopedPerformers()[0]).toBe(
      state.performerManager.performers[1]
    );
  });

  it("scopedPerformers returns empty array when selection is out of bounds", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.selectPerformerScope(5);
    expect(state.scopedPerformers().length).toBe(0);
  });

  it("selectPerformerScope(null) toggles back to All", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.selectPerformerScope(0);
    expect(state.selectedPerformerIndex).toBe(0);
    state.selectPerformerScope(null);
    expect(state.selectedPerformerIndex).toBeNull();
  });

  it("selecting a performer keeps the current camera view", () => {
    const state = makeSeeded3DState();
    state.performerManager.initialize();
    const moveCamera = vi.fn();
    state.registerSnapTo(moveCamera);

    state.selectPerformerScope(0);

    expect(state.selectedPerformerIndex).toBe(0);
    expect(moveCamera).not.toHaveBeenCalled();
  });

  it("returning to All keeps the current camera view", () => {
    const state = makeSeeded3DState();
    state.performerManager.initialize();
    const moveCamera = vi.fn();
    state.registerSnapTo(moveCamera);

    state.selectPerformerScope(0);
    state.selectPerformerScope(null);

    expect(moveCamera).not.toHaveBeenCalled();
  });

  it("keeps the editing camera through cast and formation changes", () => {
    const state = makeSeeded3DState();
    state.performerManager.initialize();
    const moveCamera = vi.fn();
    state.registerSnapTo(moveCamera);

    state.spawnPerformerFromUI();
    state.applyFormationFromUI("stage-lr");
    state.removePerformerFromUI();

    expect(moveCamera).not.toHaveBeenCalled();
  });

  it("moves the camera only when the user explicitly frames the cast", () => {
    const state = makeSeeded3DState();
    state.performerManager.initialize();
    state.spawnPerformerFromUI();
    const moveCamera = vi.fn();
    state.registerSnapTo(moveCamera);

    state.frameAllPerformers();

    expect(moveCamera).toHaveBeenCalledTimes(1);
  });

  it("setHandPlaneScoped updates every performer when All is selected", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.performerManager.addPerformer();

    state.setHandPlaneScoped("left", Plane.FLOOR);

    expect(
      state.performerManager.performers.map(
        (performer) => performer.rawLeftPlane
      )
    ).toEqual([Plane.FLOOR, Plane.FLOOR, Plane.FLOOR]);
  });

  it("setHandPlaneScoped updates only the selected performer in single mode", () => {
    const state = makeState();
    state.performerManager.initialize();
    state.performerManager.addPerformer();
    state.performerManager.addPerformer();
    state.selectPerformerScope(1);

    state.setHandPlaneScoped("right", Plane.WHEEL);

    expect(
      state.performerManager.performers.map(
        (performer) => performer.rawRightPlane
      )
    ).toEqual([null, Plane.WHEEL, null]);
  });

  it("does not show a grid plane when a performer starts using it", async () => {
    localStorage.removeItem("tka-viewer3d-visiblePlanes");
    const state = makeState();
    state.performerManager.initialize();
    state.selectPerformerScope(0);

    state.setHandPlaneScoped("left", Plane.WHEEL);
    await tick();

    expect([...state.visiblePlanes]).toEqual([]);
  });
});
