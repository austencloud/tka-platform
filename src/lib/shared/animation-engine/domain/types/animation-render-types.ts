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
  /** Per-performer prop type (Performer Set); drives the hand-never-rotates rule
   *  for this copy. Absent → the global prop type. */
  bluePropType?: string;
  redPropType?: string;
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
  /** Performer spotlight: selected performer (0 = base, k = copy arm k) or null.
   *  When set, non-selected copies' props dim. Default null. */
  tunnelSelectedLayer?: number | null;
}
