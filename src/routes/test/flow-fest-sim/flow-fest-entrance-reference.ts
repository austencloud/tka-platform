import rawReference from "./flow-fest-entrance-reference.json";
import type { FlowFestReviewCamera } from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  FLOW_FEST_CAMP_ROAD_ENTRANCE,
  FLOW_FEST_ENTRANCE_REGISTRATION,
} from "./flow-fest-camp-plan";

export const FLOW_FEST_ENTRANCE_VIEW_IDS = [
  "entrance-front",
  "entrance-road-right",
  "entrance-road-left",
  "entrance-gatehouse-close",
] as const;

export type FlowFestEntranceViewId =
  (typeof FLOW_FEST_ENTRANCE_VIEW_IDS)[number];

export interface FlowFestEntranceLocalPoint {
  right: number;
  depth: number;
}

export interface FlowFestEntranceReferenceView {
  id: FlowFestEntranceViewId;
  label: string;
  camera: FlowFestReviewCamera;
  sourceView: {
    panoramaId: string;
    headingDegrees: number;
    pitchDegrees: number;
    fovDegrees: number;
    method: string;
  };
  expectedScreenRegions: string[];
  baselineDiscrepancies: string[];
}

export interface FlowFestEntranceReferenceManifest {
  schemaVersion: 2;
  sceneId: "flow-fest-sim-earth";
  referenceId: string;
  coordinateAuthority: {
    worldFrame: string;
    roadFeatureObjectId: number;
    entranceLandmarkId: "camp-road-entrance";
    placementRule: string;
  };
  sourceReference: {
    provider: "Google Street View";
    address: string;
    imageryDate: string;
    panoramaId: string;
    panoramaLatitude: number;
    panoramaLongitude: number;
    verifiedOn: string;
    referenceUrl: string;
    storagePolicy: string;
  };
  registration: {
    projectedCrs: string;
    panoramaProjected: { easting: number; northing: number };
    panoramaWorld: { x: number; z: number };
    roadSnapWorld: { x: number; z: number };
    roadSnapOffsetMeters: number;
    roadTangentHeadingDegrees: number;
    naipRasterObjectId: number;
    naipRuntimePixel: { column: number; row: number };
    evidenceRule: string;
  };
  captureProfile: {
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    defaultHorizontalFovDegrees: number;
    simulationRoute: string;
  };
  siteLayout: {
    entranceWorld: { x: number; z: number };
    driveInwardUnit: { x: number; z: number };
    driveRightUnit: { x: number; z: number };
    roadTangentUnit: { x: number; z: number };
    driveway: {
      localPolygon: FlowFestEntranceLocalPoint[];
      surface: string;
    };
    gatehouse: {
      localCenter: FlowFestEntranceLocalPoint;
      widthMeters: number;
      depthMeters: number;
      wallHeightMeters: number;
      ridgeHeightMeters: number;
      sourceConfidence: string;
    };
    fence: {
      inwardOffsetMeters: number;
      driveGapHalfWidthMeters: number;
      leftRunMeters: number;
      rightRunMeters: number;
      postSpacingMeters: number;
      rails: 3;
      sourceConfidence: string;
    };
    gateSign: {
      localCenter: FlowFestEntranceLocalPoint;
      label: string;
    };
    utility: {
      primaryRoadOffsetMeters: number;
      inwardOffsetMeters: number;
      poleHeightMeters: number;
      spanOffsetsMeters: number[];
    };
  };
  views: FlowFestEntranceReferenceView[];
}

export interface FlowFestEntranceReferenceRequest {
  enabled: boolean;
  requestedId: string | null;
  view: FlowFestEntranceReferenceView | null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseFlowFestEntranceReferenceManifest(
  value: unknown
): FlowFestEntranceReferenceManifest {
  const candidate = value as FlowFestEntranceReferenceManifest;
  if (
    candidate?.schemaVersion !== 2 ||
    candidate.sceneId !== "flow-fest-sim-earth" ||
    candidate.coordinateAuthority?.entranceLandmarkId !==
      "camp-road-entrance" ||
    candidate.coordinateAuthority?.roadFeatureObjectId !== 3019609 ||
    !finite(candidate.siteLayout?.entranceWorld?.x) ||
    !finite(candidate.siteLayout?.entranceWorld?.z) ||
    !finite(candidate.registration?.roadSnapOffsetMeters) ||
    candidate.registration.roadSnapOffsetMeters > 1 ||
    candidate.registration?.naipRasterObjectId !== 146870 ||
    !Array.isArray(candidate.views) ||
    candidate.views.length !== FLOW_FEST_ENTRANCE_VIEW_IDS.length
  ) {
    throw new Error("Flow Fest entrance reference manifest is malformed");
  }

  const anchorError = Math.hypot(
    candidate.siteLayout.entranceWorld.x - FLOW_FEST_CAMP_ROAD_ENTRANCE.x,
    candidate.siteLayout.entranceWorld.z - FLOW_FEST_CAMP_ROAD_ENTRANCE.z
  );
  if (
    anchorError > 0.001 ||
    candidate.sourceReference.panoramaId !==
      FLOW_FEST_ENTRANCE_REGISTRATION.panoramaId
  ) {
    throw new Error(
      "Flow Fest entrance reference drifted from its registration"
    );
  }

  for (const id of FLOW_FEST_ENTRANCE_VIEW_IDS) {
    const view = candidate.views.find((entry) => entry.id === id);
    if (
      !view ||
      view.camera.id !== id ||
      view.camera.positionWorld.length !== 3 ||
      view.camera.targetWorld.length !== 3 ||
      !view.camera.positionWorld.every(finite) ||
      !view.camera.targetWorld.every(finite) ||
      !finite(view.camera.horizontalFovDegrees) ||
      view.sourceView.panoramaId !== candidate.sourceReference.panoramaId ||
      view.expectedScreenRegions.length === 0 ||
      view.baselineDiscrepancies.length === 0
    ) {
      throw new Error(`Flow Fest entrance reference view is malformed: ${id}`);
    }
  }

  return candidate;
}

export const FLOW_FEST_ENTRANCE_REFERENCE =
  parseFlowFestEntranceReferenceManifest(rawReference);

export const FLOW_FEST_ENTRANCE_REVIEW_CAMERAS =
  FLOW_FEST_ENTRANCE_REFERENCE.views.map((view) => view.camera);

export function parseFlowFestEntranceReferenceRequest(
  query: URLSearchParams
): FlowFestEntranceReferenceRequest {
  const requestedId = query.get("reference");
  const enabled = requestedId?.startsWith("entrance-") ?? false;
  const view = enabled
    ? (FLOW_FEST_ENTRANCE_REFERENCE.views.find(
        (candidate) => candidate.id === requestedId
      ) ?? null)
    : null;
  return { enabled, requestedId, view };
}

export function flowFestEntranceLocalToWorld(
  point: FlowFestEntranceLocalPoint
): { x: number; z: number } {
  const { entranceWorld, driveInwardUnit, driveRightUnit } =
    FLOW_FEST_ENTRANCE_REFERENCE.siteLayout;
  return {
    x:
      entranceWorld.x +
      driveRightUnit.x * point.right +
      driveInwardUnit.x * point.depth,
    z:
      entranceWorld.z +
      driveRightUnit.z * point.right +
      driveInwardUnit.z * point.depth,
  };
}

export function flowFestEntranceWorldToLocal(point: {
  x: number;
  z: number;
}): FlowFestEntranceLocalPoint {
  const { entranceWorld, driveInwardUnit, driveRightUnit } =
    FLOW_FEST_ENTRANCE_REFERENCE.siteLayout;
  const deltaX = point.x - entranceWorld.x;
  const deltaZ = point.z - entranceWorld.z;
  return {
    right: deltaX * driveRightUnit.x + deltaZ * driveRightUnit.z,
    depth: deltaX * driveInwardUnit.x + deltaZ * driveInwardUnit.z,
  };
}

export function pointInsideFlowFestEntranceFixtureClearance(
  point: { x: number; z: number },
  crownRadiusMeters = 0
): boolean {
  const local = flowFestEntranceWorldToLocal(point);
  const clearance = Math.min(Math.max(crownRadiusMeters, 0), 5.2);
  const drivewayHalfWidth =
    local.depth <= 13.5
      ? 7.5 - ((local.depth - 1.5) / 12) * 1.5
      : 6 - ((local.depth - 13.5) / 17.5) * 1.4;
  const insideDriveway =
    local.depth >= 1.5 - clearance &&
    local.depth <= 31 + clearance &&
    Math.abs(local.right) <= drivewayHalfWidth + clearance;

  const gatehouse = FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.gatehouse;
  const insideGatehouse =
    Math.abs(local.right - gatehouse.localCenter.right) <=
      gatehouse.widthMeters / 2 + clearance + 1.2 &&
    Math.abs(local.depth - gatehouse.localCenter.depth) <=
      gatehouse.depthMeters / 2 + clearance + 1.2;

  const insideRoadRightSightline =
    local.depth >= -3 - clearance &&
    local.depth <= 14 + clearance &&
    local.right >= 7 - clearance &&
    local.right <= 20 + clearance;

  return insideDriveway || insideGatehouse || insideRoadRightSightline;
}
