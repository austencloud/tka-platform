/**
 * Autosave Manager
 *
 * Marks autosave as dirty when sequence changes.
 */

import type { Autosaver } from "../../services/Autosaver";
import type { CreateModuleState } from "../create-module-state.svelte";

export interface AutosaveConfig {
  getCreateModuleState: () => CreateModuleState | null;
  getAutosaver: () => Autosaver | null;
}

export function createAutosaveEffect(config: AutosaveConfig): () => void {
  const { getCreateModuleState, getAutosaver } = config;

  const cleanup = $effect.root(() => {
    $effect(() => {
      const createModuleState = getCreateModuleState();
      const Autosaver = getAutosaver();

      if (createModuleState?.sequenceState.currentSequence && Autosaver) {
        Autosaver.markDirty();
      }
    });
  });

  return cleanup;
}
