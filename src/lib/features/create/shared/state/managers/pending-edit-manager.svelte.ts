/**
 * Pending Edit Manager
 *
 * Handles pending edits from Browse gallery.
 * When user clicks "Edit" on a sequence in Browse, it's stored
 * and processed when Create module mounts.
 */

import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { DeepLinkSequenceHandler } from "../../services/deep-link-sequence-handler";
import type { CreateModuleState } from "../create-module-state.svelte";
import type { ConstructTabState } from "../construct-tab-state.svelte";

export interface PendingEditConfig {
  getDeepLinker: () => DeepLinkSequenceHandler | null;
  getCreateModuleState: () => CreateModuleState | null;
  getConstructTabState: () => ConstructTabState | null;
  isServicesInitialized: () => boolean;
}

export function createPendingEditEffect(config: PendingEditConfig): () => void {
  const {
    getDeepLinker,
    getCreateModuleState,
    getConstructTabState,
    isServicesInitialized,
  } = config;

  let pendingEditProcessed = false;

  const cleanup = $effect.root(() => {
    $effect(() => {
      const currentModule = navigationState.currentModule;
      if (currentModule !== "create") return;

      const deepLinkService = getDeepLinker();
      const createModuleState = getCreateModuleState();
      const constructTabState = getConstructTabState();

      if (
        !deepLinkService ||
        !createModuleState ||
        !constructTabState ||
        !isServicesInitialized()
      ) {
        return;
      }

      if (pendingEditProcessed) return;

      const hasPending = deepLinkService.hasPendingEdit();
      if (!hasPending) return;

      pendingEditProcessed = true;

      deepLinkService.loadFromPendingEdit((sequence) => {
        const constructorSequenceState = constructTabState?.sequenceState;
        if (constructorSequenceState) {
          constructorSequenceState.setCurrentSequence(sequence);
          constructTabState?.syncPickerStateWithSequence();
        } else {
          createModuleState.sequenceState.setCurrentSequence(sequence);
        }

        if (constructTabState?.setShowStartPositionPicker) {
          constructTabState.setShowStartPositionPicker(false);
        }
      });
    });
  });

  return cleanup;
}
