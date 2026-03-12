export type HandView = "both" | "blue" | "red";

export type EffectMode = "trails" | "fire" | "charcoal" | "led";

export interface DisassembleSlotState {
  readonly heroView: HandView;
  readonly smallLeftView: HandView;
  readonly smallRightView: HandView;
  readonly activeEffectMode: EffectMode;
  setEffectMode(mode: EffectMode): void;
}

export function createDisassembleSlotState(): DisassembleSlotState {
  let activeEffectMode = $state<EffectMode>("trails");

  function setEffectMode(mode: EffectMode) {
    activeEffectMode = mode;
  }

  return {
    get heroView() { return "both" as const; },
    get smallLeftView() { return "blue" as const; },
    get smallRightView() { return "red" as const; },
    get activeEffectMode() { return activeEffectMode; },
    setEffectMode,
  };
}
