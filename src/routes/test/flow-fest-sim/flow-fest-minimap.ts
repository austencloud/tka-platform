import type {
  FlowFestBranchId,
  FlowFestRuntimeContract,
  FlowFestRuntimePoint,
} from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  createFlowFestCampPlan,
  type FlowFestCampPlanEvidence,
  type FlowFestCampPlanLandmarkKind,
  type FlowFestCampPlanRegionKind,
} from "./flow-fest-camp-plan";

export interface FlowFestMapPoint {
  x: number;
  y: number;
}

export interface FlowFestMapViewport {
  width: number;
  height: number;
  padding: number;
}

export interface FlowFestMapLandmark {
  id: string;
  label: string;
  kind: FlowFestCampPlanLandmarkKind;
  evidence: FlowFestCampPlanEvidence;
  point: FlowFestMapPoint;
}

export interface FlowFestMapRegion {
  id: string;
  label: string;
  kind: FlowFestCampPlanRegionKind;
  evidence: FlowFestCampPlanEvidence;
  shape: "ellipse" | "polygon";
  point?: FlowFestMapPoint;
  radiusX?: number;
  radiusY?: number;
  polygon?: string;
}

export interface FlowFestMapZone {
  id: string;
  label: string;
  evidence: FlowFestCampPlanEvidence;
  selected: boolean;
  point: FlowFestMapPoint;
  radiusX: number;
  radiusY: number;
}

export interface FlowFestMinimapModel {
  bounds: FlowFestRuntimeContract["surfaceEvidenceProxy"]["activeBoundsWorldMeters"];
  publicRoadPolylines: string[];
  internalDrivePolylines: string[];
  connectorPolylines: string[];
  zones: FlowFestMapZone[];
  regions: FlowFestMapRegion[];
  landmarks: FlowFestMapLandmark[];
  publicRoadLabelPoint: FlowFestMapPoint;
  scaleBarPixels: number;
}

export const FLOW_FEST_MAP_VIEWPORT: Readonly<FlowFestMapViewport> = {
  width: 640,
  height: 340,
  padding: 22,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function projectFlowFestWorldPoint(
  point: Pick<FlowFestRuntimePoint, "x" | "z">,
  bounds: FlowFestRuntimeContract["surfaceEvidenceProxy"]["activeBoundsWorldMeters"],
  viewport: FlowFestMapViewport = FLOW_FEST_MAP_VIEWPORT
): FlowFestMapPoint {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxZ - bounds.minZ;
  const drawableWidth = viewport.width - viewport.padding * 2;
  const drawableHeight = viewport.height - viewport.padding * 2;

  if (
    worldWidth <= 0 ||
    worldHeight <= 0 ||
    drawableWidth <= 0 ||
    drawableHeight <= 0
  ) {
    throw new Error("Flow Fest minimap bounds must have positive area");
  }

  const normalizedX = clamp((point.x - bounds.minX) / worldWidth, 0, 1);
  const normalizedZ = clamp((point.z - bounds.minZ) / worldHeight, 0, 1);

  return {
    x: viewport.padding + normalizedX * drawableWidth,
    y: viewport.padding + normalizedZ * drawableHeight,
  };
}

export function projectFlowFestPolyline(
  points: Array<Pick<FlowFestRuntimePoint, "x" | "z">>,
  bounds: FlowFestRuntimeContract["surfaceEvidenceProxy"]["activeBoundsWorldMeters"],
  viewport: FlowFestMapViewport = FLOW_FEST_MAP_VIEWPORT
): string {
  return points
    .map((point) => {
      const projected = projectFlowFestWorldPoint(point, bounds, viewport);
      return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join(" ");
}

export function flowFestMapHeadingDegrees(yawRadians: number): number {
  const degrees = 180 - (yawRadians * 180) / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

export function createFlowFestMinimapModel(
  contract: FlowFestRuntimeContract,
  branch: FlowFestBranchId,
  viewport: FlowFestMapViewport = FLOW_FEST_MAP_VIEWPORT
): FlowFestMinimapModel {
  const plan = createFlowFestCampPlan(contract, branch);
  const bounds = plan.bounds;
  const projectPolyline = (
    points: Array<Pick<FlowFestRuntimePoint, "x" | "z">>
  ) => projectFlowFestPolyline(points, bounds, viewport);
  const xPixelsPerMeter =
    (viewport.width - viewport.padding * 2) / (bounds.maxX - bounds.minX);
  const yPixelsPerMeter =
    (viewport.height - viewport.padding * 2) / (bounds.maxZ - bounds.minZ);

  return {
    bounds,
    publicRoadPolylines: plan.publicRoads.map((line) =>
      projectPolyline(line.points)
    ),
    internalDrivePolylines: plan.internalDrives.map((line) =>
      projectPolyline(line.points)
    ),
    connectorPolylines: plan.footConnectors.map((line) =>
      projectPolyline(line.points)
    ),
    zones: plan.zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      evidence: zone.evidence,
      selected: zone.id === plan.selectedCampZoneId,
      point: projectFlowFestWorldPoint(zone.center, bounds, viewport),
      radiusX: Math.max(4, zone.radiusXMeters * xPixelsPerMeter),
      radiusY: Math.max(4, zone.radiusZMeters * yPixelsPerMeter),
    })),
    regions: plan.regions.map((region) => ({
      id: region.id,
      label: region.label,
      kind: region.kind,
      evidence: region.evidence,
      shape: region.shape,
      point: region.center
        ? projectFlowFestWorldPoint(region.center, bounds, viewport)
        : undefined,
      radiusX:
        region.radiusXMeters == null
          ? undefined
          : Math.max(4, region.radiusXMeters * xPixelsPerMeter),
      radiusY:
        region.radiusZMeters == null
          ? undefined
          : Math.max(4, region.radiusZMeters * yPixelsPerMeter),
      polygon: region.points
        ? projectFlowFestPolyline(region.points, bounds, viewport)
        : undefined,
    })),
    landmarks: plan.landmarks.map((landmark) => ({
      id: landmark.id,
      label: landmark.mapLabel,
      kind: landmark.kind,
      evidence: landmark.evidence,
      point: projectFlowFestWorldPoint(landmark.position, bounds, viewport),
    })),
    publicRoadLabelPoint: projectFlowFestWorldPoint(
      { x: 75, z: 8 },
      bounds,
      viewport
    ),
    scaleBarPixels: 100 * xPixelsPerMeter,
  };
}
