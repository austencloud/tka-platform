/**
 * Consolidated effect coordination for CreateModule
 * All reactive effects in one manageable place
 */

import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { LayoutConfiguration } from "../orchestration/types";
import type {
  ICreateModuleState,
  IConstructTabState,
} from "../types/create-module-types";
import type { IResponsiveLayoutManager } from "../services/contracts/IResponsiveLayoutManager";
import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";

export interface EffectConfig {
  CreateModuleState: ICreateModuleState | null;
  constructTabState?: IConstructTabState | null;
  layoutService: IResponsiveLayoutManager | null;
  onTabAccessibilityChange?: (canAccess: boolean) => void;
}

export function createCreateModuleEffects(config: EffectConfig) {
  const { CreateModuleState, layoutService, onTabAccessibilityChange } = config;

  let layoutConfig = $state<LayoutConfiguration | null>(null);

  // Effect 1: Tab accessibility notification
  $effect(() => {
    if (!CreateModuleState) return;

    const canAccess = !!CreateModuleState.canAccessEditTab;
    if (onTabAccessibilityChange) {
      onTabAccessibilityChange(canAccess);
    }
  });

  // Effect 2: Navigation → CreateModule sync
  $effect(() => {
    if (!CreateModuleState) return;

    const currentMode = navigationState.currentSection;
    const CreateModuleCurrentMode = CreateModuleState.activeSection;

    if (
      currentMode !== CreateModuleCurrentMode &&
      CreateModuleState.isPersistenceInitialized &&
      !CreateModuleState.isNavigatingBack
    ) {
      // Note: No need to guard navigation anymore - only construct and generate exist
      // and both are always accessible. Animate and share are separate panels now.

      CreateModuleState.setActiveToolPanel(currentMode as BuildModeId);
    }
  });

  // Effect 3: CreateModule → Navigation sync
  // IMPORTANT: Must wait for persistence to initialize to avoid overriding
  // the URL-based navigation (e.g., /create/spell) with the default "construct"
  $effect(() => {
    if (!CreateModuleState) return;
    if (!CreateModuleState.isPersistenceInitialized) return;

    const CreateModuleCurrentMode = CreateModuleState.activeSection;
    const navCurrentMode = navigationState.currentSection;

    if (CreateModuleCurrentMode && CreateModuleCurrentMode !== navCurrentMode) {
      navigationState.setCurrentSection(CreateModuleCurrentMode);
    }
  });

  // Effect 4: Layout tracking
  $effect(() => {
    if (!layoutService) return;

    layoutConfig = layoutService.calculateLayout();

    const unsubscribe = layoutService.onLayoutChange(
      (config: LayoutConfiguration) => {
        layoutConfig = config;
      }
    );

    return unsubscribe;
  });

  return {
    get layoutConfig() {
      return layoutConfig;
    },
  };
}
