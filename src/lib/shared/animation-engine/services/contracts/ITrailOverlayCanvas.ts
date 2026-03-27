import type { TrailPoint, TrailSettings } from "../../domain/types/TrailTypes";
import type { AdditionalLayerRenderData } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { PropState } from "$lib/features/compose/shared/domain/types/PropState";

export interface TrailOverlayRenderParams {
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  trailSettings: TrailSettings;
  deltaTime: number;
  canvasSize: number;
  hasBlue: boolean;
  hasRed: boolean;
  additionalLayers?: AdditionalLayerRenderData[];
  /** Raw prop states — overlay reads positions directly (fire-renderer pattern) */
  blueProp?: PropState | null;
  redProp?: PropState | null;
  /** Prop type names for correct trail endpoint resolution */
  bluePropType?: string | null;
  redPropType?: string | null;
}

export interface ITrailOverlayCanvas {
  initialize(container: HTMLElement, width: number, height: number): void;
  resize(width: number, height: number): void;
  renderFrame(params: TrailOverlayRenderParams): void;
  clear(): void;
  clearBuffers(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}
