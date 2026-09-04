import {
  BLUE_STROKE,
  PURPLE_STROKE,
  RED_STROKE,
} from "../domain/mandala-constants";
import type {
  MandalaLayer,
  MandalaLayerPath,
  MandalaLayerSet,
} from "../domain/mandala-layer-types";
import type { MandalaPaths } from "../domain/mandala-types";
import type { ProjectedTrajectorySet } from "../domain/trajectory-types";

function coordinate(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(
      "Mandala trajectories cannot contain non-finite coordinates"
    );
  }
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function projectedPath(
  layer: ProjectedTrajectorySet["layers"][number]
): MandalaLayerPath[] {
  if (layer.points.length === 0) return [];
  const d = layer.points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${coordinate(point.x)} ${coordinate(point.y)}`;
    })
    .join(" ");
  return [{ id: layer.id, tipId: layer.tipId, d }];
}

export function projectedTrajectoriesToMandalaLayers(
  trajectories: ProjectedTrajectorySet
): MandalaLayerSet {
  return {
    source: "trajectory",
    projection: trajectories.projection,
    layers: trajectories.layers.map((layer) => ({
      id: layer.id,
      streamId: layer.streamId,
      color: layer.color,
      opacity: 1,
      blendMode: "normal",
      paths: projectedPath(layer),
    })),
  };
}

export interface LegacyMandalaLayerOptions {
  leftColor?: string;
  rightColor?: string;
  overlapColor?: string;
  includeOverlap?: boolean;
}

function legacyLayer(
  id: string,
  label: string,
  color: string,
  paths: MandalaPaths["left"]
): MandalaLayer {
  return {
    id,
    label,
    color,
    opacity: 1,
    blendMode: "normal",
    paths: paths.map((path, index) => ({
      id: `${id}:${index}`,
      tipId: String(path.tipIndex),
      d: path.d,
    })),
  };
}

export function legacyMandalaPathsToLayers(
  paths: MandalaPaths,
  options: LegacyMandalaLayerOptions = {}
): MandalaLayerSet {
  const layers = [
    legacyLayer(
      "legacy:left",
      "Left",
      options.leftColor ?? BLUE_STROKE,
      paths.left
    ),
    legacyLayer(
      "legacy:right",
      "Right",
      options.rightColor ?? RED_STROKE,
      paths.right
    ),
  ];
  if ((options.includeOverlap ?? true) && paths.purple.length > 0) {
    layers.push(
      legacyLayer(
        "legacy:overlap",
        "Overlap",
        options.overlapColor ?? PURPLE_STROKE,
        paths.purple
      )
    );
  }
  return { source: "legacy-pair", layers };
}
