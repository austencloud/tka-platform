import type { TrailPoint, TrailSettings } from "../domain/types/trail-types";
import type { AdditionalLayerRenderData } from "../domain/types/animation-render-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { TipEffectMap } from "../domain/types/tip-effect-types";

export interface TrailOverlayRenderParams {
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  trailSettings: TrailSettings;
  deltaTime: number;
  canvasSize: number;
  hasBlue: boolean;
  hasRed: boolean;
  additionalLayers?: AdditionalLayerRenderData[];
  /** Raw prop states - overlay reads positions directly (fire-renderer pattern) */
  blueProp?: PropState | null;
  redProp?: PropState | null;
  /** Prop type names for correct trail endpoint resolution */
  bluePropType?: string | null;
  redPropType?: string | null;
  /** Current animation time in ms (performance.now() or virtualTime) */
  currentTime: number;
  /** Per-tip effect assignments — gates which tips capture trail points */
  tipEffectMap?: TipEffectMap;
}

export interface ITrailOverlayCanvas {
  initialize(container: HTMLElement, width: number, height: number): void;
  resize(width: number, height: number): void;
  renderFrame(params: TrailOverlayRenderParams): void;
  clear(): void;
  clearBuffers(): void;
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;
  dispose(): void;
}
