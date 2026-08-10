/**
 * Global reference to CREATE module state
 *
 * This allows keyboard shortcuts and other global handlers to access
 * the CREATE module state without needing Svelte context.
 *
 * Set by CreateModule when it mounts, cleared when it unmounts.
 */

import type { CreateModuleState, ConstructTabState } from "$lib/shared/create/state/create-module-state-types";
import type { createPanelCoordinationState } from "$lib/shared/create/state/panel-coordination-state.svelte";

type PanelCoordinationState = ReturnType<typeof createPanelCoordinationState>;

interface CreateModuleGlobalRef {
  CreateModuleState: CreateModuleState;
  constructTabState: ConstructTabState;
  panelState: PanelCoordinationState;
  /**
   * Module-owned clear-sequence flow: confirmation dialog (unless opted out),
   * undo snapshot, back to the start-position picker. Deleting the start
   * position routes here — never through a partial setStartPosition(null).
   */
  requestClearSequence?: () => void;
}

let createModuleRef: CreateModuleGlobalRef | null = null;

export function setCreateModuleStateRef(ref: CreateModuleGlobalRef | null) {
  createModuleRef = ref;
}

export function getCreateModuleStateRef(): CreateModuleState | null {
  return createModuleRef!.CreateModuleState ?? null;
}

export function getCreateModuleRef(): CreateModuleGlobalRef | null {
  return createModuleRef;
}
