/**
 * Global reference to CREATE module state
 *
 * This allows keyboard shortcuts and other global handlers to access
 * the CREATE module state without needing Svelte context.
 *
 * Set by CreateModule when it mounts, cleared when it unmounts.
 */

import type { createCreateModuleState } from "./create-module-state.svelte";
import type { createConstructTabState } from "./construct-tab-state.svelte";
import type { createPanelCoordinationState } from "./panel-coordination-state.svelte";

type CreateModuleState = ReturnType<typeof createCreateModuleState>;
type ConstructTabState = ReturnType<typeof createConstructTabState>;
type PanelCoordinationState = ReturnType<typeof createPanelCoordinationState>;

interface CreateModuleGlobalRef {
  CreateModuleState: CreateModuleState;
  constructTabState: ConstructTabState;
  panelState: PanelCoordinationState;
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
