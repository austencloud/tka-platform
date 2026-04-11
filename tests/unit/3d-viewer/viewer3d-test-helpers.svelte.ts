import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import type { IPropStateInterpolator } from "$lib/shared/3d/services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "$lib/shared/3d/services/contracts/ISequenceConverter";

export type ViewerState = ReturnType<typeof createViewer3DState>;

/**
 * Create a viewer3d state inside a fresh effect root and return both the
 * state and a teardown function. Tests use this instead of calling the
 * factory directly because the factory registers $effect internally — that
 * requires a component or an effect root to exist at call time.
 */
export function createViewer3DStateForTest(deps: {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}): { state: ViewerState; dispose: () => void } {
  let state!: ViewerState;
  const stop = $effect.root(() => {
    state = createViewer3DState(deps);
  });
  return { state, dispose: stop };
}
