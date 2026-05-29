import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { AnimationEngineProps } from "$lib/shared/animation-engine/services/implementations/AnimationEngine.svelte";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";

export interface ExportFrameContext {
  virtualTime: number;
  isSeamlesslyLoopable: boolean;
  backgroundAlpha: number;
  showNonRadialPoints: boolean;
  /**
   * Live trail settings. Load-bearing: PlaybackSync only initializes the trail
   * capturer + syncs trail params when externalTrailSettings is defined. Omitting
   * it leaves the offscreen engine with no trail capturer → trails never draw and
   * props blank along the path. The engine self-applies the unilateral constraint.
   */
  trailSettings: TrailSettings;
}

/**
 * Map live panel state + the frame context into the render-relevant props the
 * offscreen engine needs. letter/stepData are intentionally omitted: in export
 * the glyph/word/step overlays are composited by ExportFrameCompositor, not by
 * the engine canvas. The engine renders props + effects (fire/trails/grid) only.
 */
export function assembleExportEngineProps(
  panelState: AnimationPanelState,
  frame: ExportFrameContext,
): AnimationEngineProps {
  const sequenceData = panelState.sequenceData;
  const gridMode = sequenceData?.gridMode ?? GridMode.DIAMOND;
  return {
    blueProp: panelState.bluePropState,
    redProp: panelState.redPropState,
    gridVisible: true,
    gridMode,
    backgroundAlpha: frame.backgroundAlpha,
    sequenceData,
    currentStep: panelState.currentStep,
    isPlaying: true,
    isSeamlesslyLoopable: frame.isSeamlesslyLoopable,
    virtualTime: frame.virtualTime,
    showNonRadialPoints: frame.showNonRadialPoints,
    externalTrailSettings: frame.trailSettings,
  };
}
