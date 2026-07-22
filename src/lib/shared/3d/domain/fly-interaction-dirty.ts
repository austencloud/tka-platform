export type FlyInteractionKind = "keyboard" | "pointer" | "mixed";

export interface FlyInteractionDirtyState {
  keyboard: boolean;
  pointer: boolean;
}

export const CLEAN_FLY_INTERACTION: FlyInteractionDirtyState = {
  keyboard: false,
  pointer: false,
};

export function markFlyInteractionDirty(
  state: FlyInteractionDirtyState,
  kind: Exclude<FlyInteractionKind, "mixed">
): FlyInteractionDirtyState {
  if (state[kind]) return state;
  return { ...state, [kind]: true };
}

export function flushFlyInteraction(
  state: FlyInteractionDirtyState
): { state: FlyInteractionDirtyState; kind: FlyInteractionKind | null } {
  const kind = state.keyboard && state.pointer
    ? "mixed"
    : state.keyboard
      ? "keyboard"
      : state.pointer
        ? "pointer"
        : null;
  return { state: { ...CLEAN_FLY_INTERACTION }, kind };
}
