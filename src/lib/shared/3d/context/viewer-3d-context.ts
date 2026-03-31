/**
 * Viewer 3D Context
 *
 * Distributes viewer-3d state to descendant components via Svelte context.
 */

import { getContext, setContext } from "svelte";
import type { createViewer3DState } from "../state/viewer-3d-state.svelte";

const KEY = Symbol("viewer-3d");
type Viewer3DState = ReturnType<typeof createViewer3DState>;

export function setViewer3DContext(state: Viewer3DState) {
  setContext(KEY, state);
}

export function getViewer3DContext(): Viewer3DState {
  return getContext<Viewer3DState>(KEY);
}
