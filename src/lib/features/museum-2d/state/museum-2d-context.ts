/**
 * Museum 2D Context
 *
 * Provides the game state to all descendant components via Svelte's context API.
 * Set once in Museum2DModule, consumed by game board, player view, detail panel, etc.
 */

import { getContext, setContext } from "svelte";
import type { Museum2DState } from "./museum-2d-state.svelte";

export interface Museum2DContext {
  state: Museum2DState;
}

const CONTEXT_KEY = "museum2d";

export function setMuseum2DContext(context: Museum2DContext): void {
  setContext(CONTEXT_KEY, context);
}

export function getMuseum2DContext(): Museum2DContext {
  const context = getContext<Museum2DContext>(CONTEXT_KEY);
  if (!context) {
    throw new Error(
      "Museum2DContext not found. Ensure this component is a descendant of Museum2DModule."
    );
  }
  return context;
}
