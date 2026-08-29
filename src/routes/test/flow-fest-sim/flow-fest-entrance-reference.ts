import rawReference from "./flow-fest-entrance-reference.json";
import type { FlowFestReviewCamera } from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  FLOW_FEST_CAMP_ROAD_ENTRANCE,
  FLOW_FEST_LOWER_ENTRANCE_APRON,
  FLOW_FEST_LOWER_ENTRANCE_APPROACH,
  FLOW_FEST_LOWER_ENTRANCE_BASIS,
  FLOW_FEST_ENTRANCE_REGISTRATION,
  FLOW_FEST_LOWER_GATEHOUSE_SITE,
  flowFestLowerEntranceLocalToWorld,
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
      roadHalfWidthMeters: number;
      loopHalfWidthMeters: number;
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

function distanceToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }
  const progress = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) /
        lengthSquared
    )
  );
  return Math.hypot(
    point.x - (start.x + deltaX * progress),
    point.z - (start.z + deltaZ * progress)
  );
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
    !finite(candidate.siteLayout?.driveway?.roadHalfWidthMeters) ||
    !finite(candidate.siteLayout?.driveway?.loopHalfWidthMeters) ||
    candidate.siteLayout.driveway.roadHalfWidthMeters <=
      candidate.siteLayout.driveway.loopHalfWidthMeters ||
    !Array.isArray(candidate.views) ||
    candidate.views.length !== FLOW_FEST_ENTRANCE_VIEW_IDS.length
  ) {
    throw new Error("Flow Fest entrance reference manifest is malformed");
  }

  const anchorError = Math.hypot(
    candidate.siteLayout.entranceWorld.x - FLOW_FEST_CAMP_ROAD_ENTRANCE.x,
    candidate.siteLayout.entranceWorld.z - FLOW_FEST_CAMP_ROAD_ENTRANCE.z
  );
  const basisError = Math.max(
    Math.hypot(
      candidate.siteLayout.driveInwardUnit.x -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.driveInwardUnit.x,
      candidate.siteLayout.driveInwardUnit.z -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.driveInwardUnit.z
    ),
    Math.hypot(
      candidate.siteLayout.driveRightUnit.x -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.driveRightUnit.x,
      candidate.siteLayout.driveRightUnit.z -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.driveRightUnit.z
    ),
    Math.hypot(
      candidate.siteLayout.roadTangentUnit.x -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.roadTangentUnit.x,
      candidate.siteLayout.roadTangentUnit.z -
        FLOW_FEST_LOWER_ENTRANCE_BASIS.roadTangentUnit.z
    )
  );
  const manifestGatehouse = flowFestLowerEntranceLocalToWorld(
    candidate.siteLayout.gatehouse.localCenter
  );
  const gatehouseError = Math.hypot(
    manifestGatehouse.x - FLOW_FEST_LOWER_GATEHOUSE_SITE.x,
    manifestGatehouse.z - FLOW_FEST_LOWER_GATEHOUSE_SITE.z
  );
  if (
    anchorError > 0.001 ||
    basisError > 0.001 ||
    gatehouseError > 0.001 ||
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
      view.baselineDiscrepancies.length === 0 ||
      Math.hypot(
        view.camera.targetWorld[0]! - FLOW_FEST_LOWER_GATEHOUSE_SITE.x,
        view.camera.targetWorld[2]! - FLOW_FEST_LOWER_GATEHOUSE_SITE.z
      ) > 0.002
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
  return flowFestLowerEntranceLocalToWorld(point);
}

export function flowFestEntranceWorldToLocal(point: {
  x: number;
  z: number;
}): FlowFestEntranceLocalPoint {
  const { origin, driveInwardUnit, driveRightUnit } =
    FLOW_FEST_LOWER_ENTRANCE_BASIS;
  const deltaX = point.x - origin.x;
  const deltaZ = point.z - origin.z;
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

  const insideApproach = FLOW_FEST_LOWER_ENTRANCE_APPROACH.slice(1).some(
    (end, index) =>
      distanceToSegment(
        point,
        FLOW_FEST_LOWER_ENTRANCE_APPROACH[index]!,
        end
      ) <=
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveway.roadHalfWidthMeters +
        clearance
  );
  const insideApron = FLOW_FEST_LOWER_ENTRANCE_APRON.slice(1).some(
    (end, index) =>
      distanceToSegment(point, FLOW_FEST_LOWER_ENTRANCE_APRON[index]!, end) <=
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveway.loopHalfWidthMeters +
        clearance
  );

  return (
    insideApproach || insideApron || insideGatehouse || insideRoadRightSightline
  );
}
