import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";
import type { IPropStateInterpolator } from "$lib/shared/3d/services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "$lib/shared/3d/services/contracts/ISequenceConverter";
import { __resetWebGL2CapabilityForTests } from "$lib/shared/3d/capabilities/webgl-capabilities";

// The global test setup replaces document.createElement with a generic stub
// that returns plain objects lacking getContext. The viewer3d factory's
// WebGL2 detection calls document.createElement("canvas").getContext("webgl2"),
// so we extend the stub to return a canvas-like object for that specific tag.
// getContext returns null so the capability probe reports "not supported",
// which is fine — these scope tests never actually enter 3D mode.
beforeAll(() => {
  const originalCreateElement = document.createElement as unknown as (tag: string) => unknown;
  (document as unknown as { createElement: (tag: string) => unknown }).createElement = (tag: string) => {
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

function stubDeps(): {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
} {
  return {
    propInterpolator: {
      interpolate: vi.fn(),
    } as unknown as IPropStateInterpolator,
    sequenceConverter: {
      convertSequence: vi.fn().mockReturnValue([]),
    } as unknown as ISequenceConverter,
  };
}

// createViewer3DState sets up $effect internally, which requires an effect
// root. The helper wraps the factory in $effect.root and returns a teardown.
const cleanups: Array<() => void> = [];
function makeState() {
  const { state, dispose } = createViewer3DStateForTest(stubDeps());
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
    expect(state.scopedPerformers()[0]).toBe(state.performerManager.performers[1]);
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
});
