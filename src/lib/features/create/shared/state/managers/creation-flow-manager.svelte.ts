/**
 * Creation Flow Manager
 *
 * Manages tab accessibility notifications for the Create module.
 */

import type { CreateModuleState } from "../create-module-state.svelte";

export interface CreationFlowConfig {
  getCreateModuleState: () => CreateModuleState | null;
  onTabAccessibilityChange?: (canAccess: boolean) => void;
}

export function createCreationFlowEffects(
  config: CreationFlowConfig
): () => void {
  const { getCreateModuleState, onTabAccessibilityChange } = config;

  const cleanup = $effect.root(() => {
    // Notify parent of tab accessibility changes
    $effect(() => {
      const state = getCreateModuleState();
      if (!state || !onTabAccessibilityChange) return;

      onTabAccessibilityChange(state.canAccessEditTab);
    });
  });

  return cleanup;
}
