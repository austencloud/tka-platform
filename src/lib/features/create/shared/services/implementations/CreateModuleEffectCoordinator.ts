/**
 * CreateModuleEffectCoordinator.ts
 *
 * Service implementation for coordinating all reactive effects in CreateModule.
 * Centralizes effect setup to reduce complexity in the component.
 *
 * Domain: Create module - Effect Orchestration
 */

import type { CreateModuleEffectConfig } from "../contracts/types";
import {
  createAutoEditPanelEffect,
  createAutoStepEditorEffect,
} from "../../state/managers/AutoEditPanelManager.svelte";
import { createCurrentWordDisplayEffect } from "../../state/managers/CurrentWordDisplayManager.svelte";
import { createLayoutEffects } from "../../state/managers/LayoutManager.svelte";
import { createNavigationSyncEffects } from "../../state/managers/NavigationSyncManager.svelte";
import { createPWAEngagementEffect } from "../../state/managers/PWAEngagementManager.svelte";
import { createGlobalStateSyncEffects } from "../../state/managers/GlobalStateSyncManager.svelte";
import { createCreationFlowEffects } from "../../state/managers/CreationFlowManager.svelte";
import { createPendingEditEffect } from "../../state/managers/PendingEditManager.svelte";
import { createPropTypeSyncEffect } from "../../state/managers/PropTypeSyncManager.svelte";
import { createAutosaveEffect } from "../../state/managers/AutosaveManager.svelte";

export class CreateModuleEffectCoordinator {
  setupEffects(config: CreateModuleEffectConfig): () => void {
    const {
      getCreateModuleState,
      getConstructTabState,
      panelState,
      navigationState,
      layoutService,
      NavigationSyncer,
      getDeepLinker,
      getStepOperator,
      getAutosaver,
      isServicesInitialized,
      onLayoutChange,
      getShouldUseSideBySideLayout,
      setAnimatingStepNumber,
      onCurrentWordChange,
      onLetterSourcesChange,
      onTabAccessibilityChange,
    } = config;

    const cleanups: (() => void)[] = [];

    // Global state sync (panel state, layout, animation beat)
    cleanups.push(
      createGlobalStateSyncEffects({
        panelState,
        getShouldUseSideBySideLayout,
        setAnimatingStepNumber,
      })
    );

    // Creation flow (tab accessibility)
    cleanups.push(
      createCreationFlowEffects({
        getCreateModuleState,
        onTabAccessibilityChange,
      })
    );

    // Pending edit processing (from Browse gallery)
    cleanups.push(
      createPendingEditEffect({
        getDeepLinker,
        getCreateModuleState,
        getConstructTabState,
        isServicesInitialized,
      })
    );

    // Prop type sync (bulk update when settings change)
    cleanups.push(
      createPropTypeSyncEffect({
        getStepOperator,
        getCreateModuleState,
        isServicesInitialized,
      })
    );

    // Autosave dirty marking
    cleanups.push(
      createAutosaveEffect({
        getCreateModuleState,
        getAutosaver,
      })
    );

    // Navigation sync effects
    const createModuleState = getCreateModuleState();
    if (createModuleState) {
      cleanups.push(
        createNavigationSyncEffects({
          CreateModuleState: createModuleState,
          navigationState,
          NavigationSyncer,
        })
      );
    }

    // Layout effects
    cleanups.push(
      createLayoutEffects({
        layoutService,
        onLayoutChange,
      })
    );

    // Auto edit panel effects (multi-select)
    if (createModuleState) {
      cleanups.push(
        createAutoEditPanelEffect({
          CreateModuleState: createModuleState,
          panelState,
        })
      );

      // Auto Beat Editor panel effects
      cleanups.push(
        createAutoStepEditorEffect({
          CreateModuleState: createModuleState,
          panelState,
        })
      );

      // PWA engagement tracking
      cleanups.push(
        createPWAEngagementEffect({ CreateModuleState: createModuleState })
      );
    }

    // Current word display effects (and letter sources for spell tab)
    const constructTabState = getConstructTabState();
    if (onCurrentWordChange && createModuleState && constructTabState) {
      cleanups.push(
        createCurrentWordDisplayEffect({
          CreateModuleState: createModuleState,
          constructTabState,
          onCurrentWordChange,
          onLetterSourcesChange,
        })
      );
    }

    // NOTE: Panel height tracking moved to CreateModule.svelte $effect
    // because DOM element bindings happen AFTER onMount completes

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const createModuleEffectCoordinator = new CreateModuleEffectCoordinator();
