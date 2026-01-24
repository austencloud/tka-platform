/**
 * LOOP Labeler Composition Root
 *
 * This is the ONLY file that should instantiate LOOP Labeler singletons.
 * It wires together the state, services, and controller.
 *
 * WHY THIS FILE EXISTS:
 * - loop-labeler-state.svelte.ts defines the state CLASS
 * - LOOPLabelerController.ts defines the controller CLASS
 * - If either file instantiated the other, we'd have a circular dependency
 * - This composition file imports both and creates the instances
 *
 * IMPORT FROM HERE for runtime singletons:
 *   import { loopLabelerState, loopLabelerController } from "./loop-labeler-composition";
 *
 * IMPORT FROM THE CLASS FILES for types:
 *   import type { LOOPLabelerState } from "./loop-labeler-state.svelte";
 *   import type { LabelingMode } from "../domain/types/labeler-types";
 */

import { LOOPLabelerState } from "./loop-labeler-state.svelte";
import { LOOPLabelerServiceLocator } from "./LOOPLabelerServiceLocator";
import { LOOPLabelerController } from "./LOOPLabelerController";

// ============================================================
// SINGLETON INSTANCES
// ============================================================

export const loopLabelerState = new LOOPLabelerState();
export const loopLabelerServices = new LOOPLabelerServiceLocator();
export const loopLabelerController = new LOOPLabelerController(
  loopLabelerState,
  loopLabelerServices
);

// ============================================================
// HMR SUPPORT
// ============================================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    import.meta.hot!.data.LOOPLabelerState = loopLabelerState.getHMRData();
  });
}
