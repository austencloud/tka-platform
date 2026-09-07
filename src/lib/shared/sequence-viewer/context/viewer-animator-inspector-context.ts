import { getContext, setContext } from "svelte";
import type { ViewerAnimatorInspectorState } from "../state/viewer-animator-inspector-state.svelte";

const VIEWER_ANIMATOR_INSPECTOR = Symbol("viewer-animator-inspector");

export function setViewerAnimatorInspectorContext(
  state: ViewerAnimatorInspectorState
): void {
  setContext(VIEWER_ANIMATOR_INSPECTOR, state);
}

export function getOptionalViewerAnimatorInspectorContext(): ViewerAnimatorInspectorState | null {
  return (
    getContext<ViewerAnimatorInspectorState | undefined>(
      VIEWER_ANIMATOR_INSPECTOR
    ) ?? null
  );
}
