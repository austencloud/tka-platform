/**
 * Museum Context
 *
 * Provides the game state to all descendant components via Svelte's context API.
 * Set once in MuseumModule, consumed by game board, player view, detail panel, etc.
 */

import { getContext, setContext } from "svelte";
import type { MuseumState } from "./museum-state.svelte";

export interface MuseumContext {
  state: MuseumState;
}

const CONTEXT_KEY = "museum";

export function setMuseumContext(context: MuseumContext): void {
  setContext(CONTEXT_KEY, context);
}

export function getMuseumContext(): MuseumContext {
  const context = getContext<MuseumContext>(CONTEXT_KEY);
  if (!context) {
    throw new Error(
      "MuseumContext not found. Ensure this component is a descendant of MuseumModule."
    );
  }
  return context;
}
