import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { Viewer3DUndoManager } from "@austencloud/scene-3d";

export type ViewerState = ReturnType<typeof createViewer3DState>;

/**
 * Create a viewer3d state inside a fresh effect root and return both the
 * state and a teardown function. Tests use this instead of calling the
 * factory directly because the factory registers $effect internally — that
 * requires a component or an effect root to exist at call time.
 *
 * If a test doesn't pass its own `viewer3DUndoManager`, a real one is
 * instantiated — it's pure TypeScript with no side effects, so it's fine
 * to use in unit tests.
 */
export function createViewer3DStateForTest(deps: {
  viewer3DUndoManager?: Viewer3DUndoManager;
}): { state: ViewerState; dispose: () => void } {
  let state!: ViewerState;
  const stop = $effect.root(() => {
    state = createViewer3DState({
      viewer3DUndoManager: deps.viewer3DUndoManager ?? new Viewer3DUndoManager(),
    });
  });
  return { state, dispose: stop };
}
