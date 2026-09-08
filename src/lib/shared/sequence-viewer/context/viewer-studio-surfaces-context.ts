import { getContext, setContext } from "svelte";
import type { ViewerStudioSurfaces } from "../state/viewer-studio-surfaces.svelte";

const KEY = Symbol("viewer-studio-surfaces");
export function setViewerStudioSurfaces(state: ViewerStudioSurfaces): void {
  setContext(KEY, state);
}
export function getViewerStudioSurfaces(): ViewerStudioSurfaces | undefined {
  return getContext<ViewerStudioSurfaces | undefined>(KEY);
}
