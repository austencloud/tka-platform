export type HandView = "both" | "blue" | "red";

export type EffectMode = "trails" | "fire" | "charcoal" | "led";

export interface DecomposeSlotState {
  readonly heroView: HandView;
  readonly smallLeftView: HandView;
  readonly smallRightView: HandView;
  readonly activeEffectMode: EffectMode;
  swapWithHero(slot: "left" | "right"): void;
  setEffectMode(mode: EffectMode): void;
}

export function createDecomposeSlotState(): DecomposeSlotState {
  let heroView = $state<HandView>("both");
  let smallLeftView = $state<HandView>("blue");
  let smallRightView = $state<HandView>("red");
  let activeEffectMode = $state<EffectMode>("trails");

  function swapWithHero(slot: "left" | "right") {
    if (slot === "left") {
      const temp = heroView;
      heroView = smallLeftView;
      smallLeftView = temp;
    } else {
      const temp = heroView;
      heroView = smallRightView;
      smallRightView = temp;
    }
  }

  function setEffectMode(mode: EffectMode) {
    activeEffectMode = mode;
  }

  return {
    get heroView() { return heroView; },
    get smallLeftView() { return smallLeftView; },
    get smallRightView() { return smallRightView; },
    get activeEffectMode() { return activeEffectMode; },
    swapWithHero,
    setEffectMode,
  };
}
