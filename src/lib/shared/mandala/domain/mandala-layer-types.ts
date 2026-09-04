import type { TrajectoryProjectionSpec } from "./trajectory-types";

export interface MandalaLayerPath {
  id: string;
  tipId: string;
  d: string;
}

export interface MandalaLayer {
  id: string;
  streamId?: string;
  label?: string;
  color: string;
  opacity: number;
  blendMode: "normal" | "additive";
  paths: readonly MandalaLayerPath[];
}

export interface MandalaLayerSet {
  source: "legacy-pair" | "trajectory";
  projection?: TrajectoryProjectionSpec;
  layers: readonly MandalaLayer[];
}
