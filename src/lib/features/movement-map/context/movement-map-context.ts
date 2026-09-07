import { getContext, setContext } from "svelte";
import type { MovementMapState } from "../state/movement-map-state.svelte";

const KEY = Symbol("movement-map");

export interface MovementMapContext {
  readonly state: MovementMapState;
}

export function setMovementMapContext(context: MovementMapContext): void {
  setContext(KEY, context);
}

export function getMovementMapContext(): MovementMapContext {
  const context = getContext<MovementMapContext | undefined>(KEY);
  if (!context) {
    throw new Error(
      "Movement map context is missing. Render this inside MovementMapLab."
    );
  }
  return context;
}
