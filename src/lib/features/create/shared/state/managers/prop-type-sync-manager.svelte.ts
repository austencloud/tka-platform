/**
 * Prop Type Sync Manager
 *
 * Watches for prop type changes in settings and bulk updates all motions.
 */

import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { StepOperator } from "$lib/features/create/shared/services/step-operator";
import type { CreateModuleState } from "../create-module-state.svelte";

export interface PropTypeSyncConfig {
  getStepOperator: () => StepOperator | null;
  getCreateModuleState: () => CreateModuleState | null;
  isServicesInitialized: () => boolean;
}

export function createPropTypeSyncEffect(
  config: PropTypeSyncConfig
): () => void {
  const { getStepOperator, getCreateModuleState, isServicesInitialized } =
    config;

  let previousBluePropType: string | undefined = undefined;
  let previousRedPropType: string | undefined = undefined;

  const cleanup = $effect.root(() => {
    $effect(() => {
      if (!isServicesInitialized()) return;

      const StepOperator = getStepOperator();
      const createModuleState = getCreateModuleState();
      if (!StepOperator || !createModuleState) return;

      const settings = getSettings();
      const newBluePropType = settings.bluePropType;
      const newRedPropType = settings.redPropType;

      // Sync on initial load AND when prop type changes
      // Removed `previousPropType !== undefined` check - we need to sync on mount
      // to ensure start positions (created with default STAFF) match user settings
      if (newBluePropType && newBluePropType !== previousBluePropType) {
        StepOperator.bulkUpdatePropType(
          "blue",
          newBluePropType,
          createModuleState
        );
      }
      previousBluePropType = newBluePropType;

      if (newRedPropType && newRedPropType !== previousRedPropType) {
        StepOperator.bulkUpdatePropType(
          "red",
          newRedPropType,
          createModuleState
        );
      }
      previousRedPropType = newRedPropType;
    });
  });

  return cleanup;
}
