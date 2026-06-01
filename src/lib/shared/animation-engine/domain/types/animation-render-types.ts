import type { TrailPoint, TrailSettings } from "./trail-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { QualityHints } from "./quality-types";

export interface AdditionalLayerRenderData {
  blueProp: PropState | null;
  redProp: PropState | null;
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  hasBlue: boolean;
  hasRed: boolean;
  blueColor: string;
  redColor: string;
}

export interface AnimationVisibilitySettings {
  gridVisible: boolean;
  propsVisible: boolean;
  trailsVisible: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

export interface RenderSceneParams {
  blueProp: PropState | null;
  redProp: PropState | null;
  gridVisible: boolean;
  gridMode: string | null;
  letter: string | null;
  turnsTuple: string | null;
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  additionalLayers?: AdditionalLayerRenderData[];
  trailSettings: TrailSettings;
  currentTime: number;
  visibility: AnimationVisibilitySettings;
  bluePropFlipped?: boolean;
  redPropFlipped?: boolean;
  bluePropType?: string;
  redPropType?: string;
  qualityHints?: QualityHints;
  skipTrailRendering?: boolean;
  /** Virtual time for this frame (ms). Set only on the video-export path
   *  (animation-engine renderFrame); undefined for live RAF rendering.
   *  Used as an export-only discriminator for one-time export diagnostics. */
  virtualTime?: number;
}
