export type HandView = "both" | "blue" | "red";

export type EffectMode = "trails" | "fire" | "charcoal" | "led";

/**
 * Three tiers of sequence visualization, each stripping away a layer:
 * - sequence: full pictograph with both performers and props
 * - soloProps: isolated blue/red props in separate canvases
 * - handPaths: props replaced by hand SVGs, rotation stripped so you see
 *   only the grid path each hand travels
 */
export type ViewTier = "sequence" | "soloProps" | "handPaths";

const TIER_ORDER: readonly ViewTier[] = ["sequence", "soloProps", "handPaths"];

export interface DisassembleSlotState {
  readonly heroView: HandView;
  readonly smallLeftView: HandView;
  readonly smallRightView: HandView;
  readonly activeEffectMode: EffectMode;
  readonly viewTier: ViewTier;
  setEffectMode(mode: EffectMode): void;
  setViewTier(tier: ViewTier): void;
  drillDown(): void;
  drillUp(): void;
}

export function createDisassembleSlotState(): DisassembleSlotState {
  let activeEffectMode = $state<EffectMode>("trails");
  let viewTier = $state<ViewTier>("sequence");

  function setEffectMode(mode: EffectMode) {
    activeEffectMode = mode;
  }

  function setViewTier(tier: ViewTier) {
    viewTier = tier;
  }

  function drillDown() {
    const idx = TIER_ORDER.indexOf(viewTier);
    const next = TIER_ORDER[idx + 1];
    if (next) viewTier = next;
  }

  function drillUp() {
    const idx = TIER_ORDER.indexOf(viewTier);
    const prev = TIER_ORDER[idx - 1];
    if (prev) viewTier = prev;
  }

  return {
    get heroView() { return "both" as const; },
    get smallLeftView() { return "blue" as const; },
    get smallRightView() { return "red" as const; },
    get activeEffectMode() { return activeEffectMode; },
    get viewTier() { return viewTier; },
    setEffectMode,
    setViewTier,
    drillDown,
    drillUp,
  };
}
