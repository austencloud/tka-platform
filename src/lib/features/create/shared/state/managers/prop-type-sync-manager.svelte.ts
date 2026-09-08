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

  let previousLeftPropType: string | undefined = undefined;
  let previousRightPropType: string | undefined = undefined;

  const cleanup = $effect.root(() => {
    $effect(() => {
      if (!isServicesInitialized()) return;

      const StepOperator = getStepOperator();
      const createModuleState = getCreateModuleState();
      if (!StepOperator || !createModuleState) return;

      const settings = getSettings();
      const newLeftPropType = settings.leftPropType;
      const newRightPropType = settings.rightPropType;

      // Sync on initial load AND when prop type changes
      // Removed `previousPropType !== undefined` check - we need to sync on mount
      // to ensure start positions (created with default STAFF) match user settings
      if (newLeftPropType && newLeftPropType !== previousLeftPropType) {
        StepOperator.bulkUpdatePropType(
          "blue",
          newLeftPropType,
          createModuleState
        );
      }
      previousLeftPropType = newLeftPropType;

      if (newRightPropType && newRightPropType !== previousRightPropType) {
        StepOperator.bulkUpdatePropType(
          "red",
          newRightPropType,
          createModuleState
        );
      }
      previousRightPropType = newRightPropType;
    });
  });

  return cleanup;
}
