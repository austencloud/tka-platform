import { getContext, setContext } from "svelte";
import type { ScanActivityState } from "../state/scan-activity-state.svelte";

const SCAN_ACTIVITY_CONTEXT_KEY = Symbol("scan-activity-context");

export interface ScanActivityContext {
  state: ScanActivityState;
}

export function setScanActivityContext(context: ScanActivityContext): void {
  setContext(SCAN_ACTIVITY_CONTEXT_KEY, context);
}

export function getScanActivityContext(): ScanActivityContext {
  return getContext<ScanActivityContext>(SCAN_ACTIVITY_CONTEXT_KEY);
}
