import { getContext, setContext } from "svelte";
import type { ViewerTunnelStageState } from "../state/viewer-tunnel-stage-state.svelte";

const VIEWER_TUNNEL_STAGE = Symbol("viewer-tunnel-stage");

export function setViewerTunnelStageContext(
  state: ViewerTunnelStageState
): void {
  setContext(VIEWER_TUNNEL_STAGE, state);
}

export function getViewerTunnelStageContext(): ViewerTunnelStageState {
  const state = getContext<ViewerTunnelStageState | undefined>(
    VIEWER_TUNNEL_STAGE
  );
  if (!state) {
    throw new Error("Viewer tunnel stage context is unavailable.");
  }
  return state;
}

export function getOptionalViewerTunnelStageContext(): ViewerTunnelStageState | null {
  return (
    getContext<ViewerTunnelStageState | undefined>(VIEWER_TUNNEL_STAGE) ?? null
  );
}
