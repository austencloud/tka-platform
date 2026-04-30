/**
 * Viewer Visibility Context
 *
 * Distributes SequenceViewerVisibilityState to descendant components
 * via Svelte context. Modeled after viewer-3d-context.ts.
 */

import { getContext, setContext } from "svelte";
import type { SequenceViewerVisibilityState } from "../state/viewer-visibility-state.svelte";

const KEY = Symbol("sequence-viewer-visibility");

export function setViewerVisibilityContext(state: SequenceViewerVisibilityState): void {
  setContext(KEY, state);
}

export function getViewerVisibilityContext(): SequenceViewerVisibilityState {
  const ctx = getContext<SequenceViewerVisibilityState | undefined>(KEY);
  if (!ctx) {
    throw new Error(
      "Viewer visibility context missing - component must be rendered inside SequenceViewerOrchestrator",
    );
  }
  return ctx;
}

/**
 * Attempt to get the context, returning null when absent.
 * Use in shared components that may render outside the viewer
 * (e.g., ChoreoCard also used in browse previews).
 */
export function tryGetViewerVisibilityContext(): SequenceViewerVisibilityState | null {
  try {
    return getContext<SequenceViewerVisibilityState | undefined>(KEY) ?? null;
  } catch {
    return null;
  }
}
