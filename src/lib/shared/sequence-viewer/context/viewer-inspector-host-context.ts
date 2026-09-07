import { getContext, setContext } from "svelte";
import type { ViewerInspectorHostState } from "../state/viewer-inspector-host-state.svelte";

const VIEWER_INSPECTOR_HOST = Symbol("viewer-inspector-host");

export function setViewerInspectorHostContext(
  state: ViewerInspectorHostState
): void {
  setContext(VIEWER_INSPECTOR_HOST, state);
}

export function getOptionalViewerInspectorHostContext(): ViewerInspectorHostState | null {
  return (
    getContext<ViewerInspectorHostState | undefined>(VIEWER_INSPECTOR_HOST) ??
    null
  );
}
