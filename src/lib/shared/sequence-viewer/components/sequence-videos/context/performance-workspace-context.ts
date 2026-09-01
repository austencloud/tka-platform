import { getContext, setContext } from "svelte";
import type { PerformanceWorkspaceState } from "../state/performance-workspace-state.svelte";

const PERFORMANCE_WORKSPACE = Symbol("performance-workspace");

export function setPerformanceWorkspaceContext(
  state: PerformanceWorkspaceState
): void {
  setContext(PERFORMANCE_WORKSPACE, state);
}

export function getPerformanceWorkspaceContext(): PerformanceWorkspaceState {
  const state = getContext<PerformanceWorkspaceState | undefined>(
    PERFORMANCE_WORKSPACE
  );
  if (!state) {
    throw new Error("Performance workspace context is unavailable");
  }
  return state;
}
