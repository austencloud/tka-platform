import type {
  FlowFestBranchId,
  FlowFestRuntimeContract,
  FlowFestRuntimePoint,
  FlowFestRuntimeSegment,
  FlowFestRuntimeZone,
} from "../flow-fest-graybox/flow-fest-runtime-contract";

export type FlowFestCampPlanEvidence =
  | "official-road-inventory"
  | "public-orthophoto"
  | "imagery-interpreted"
  | "austen-observed-topology"
  | "austen-traced"
  | "festival-placement";

export type FlowFestCampPlanLandmarkKind =
  | "entrance"
  | "check-in"
  | "parking-gate"
  | "parking"
  | "clearing"
  | "buildings"
  | "crop-field"
  | "camp";

export type FlowFestCampPlanRegionKind =
  | "clearing"
  | "parking-field"
  | "crop-field"
  | "woodland";

export interface FlowFestCampPlanLine {
  id: string;
  label: string;
  evidence: FlowFestCampPlanEvidence;
  kind: "public-road" | "internal-drive" | "foot-connector";
  widthMeters: number;
  points: Array<Pick<FlowFestRuntimePoint, "x" | "z">>;
  sourceNote: string;
}

export interface FlowFestCampPlanZone {
  id: string;
  label: string;
  evidence: FlowFestCampPlanEvidence;
  center: Pick<FlowFestRuntimePoint, "x" | "z">;
  radiusXMeters: number;
  radiusZMeters: number;
}

export interface FlowFestCampPlanLandmark {
  id: string;
  label: string;
  mapLabel: string;
  evidence: FlowFestCampPlanEvidence;
  kind: FlowFestCampPlanLandmarkKind;
  position: Pick<FlowFestRuntimePoint, "x" | "z">;
  approachRadiusMeters: number;
  sourceNote: string;
}

export interface FlowFestCampPlanRegion {
  id: string;
  label: string;
  evidence: FlowFestCampPlanEvidence;
  kind: FlowFestCampPlanRegionKind;
  shape: "ellipse" | "polygon";
  center?: Pick<FlowFestRuntimePoint, "x" | "z">;
  radiusXMeters?: number;
  radiusZMeters?: number;
  points?: Array<Pick<FlowFestRuntimePoint, "x" | "z">>;
  sourceNote: string;
}

export interface FlowFestCampPlanLocation {
  id: string;
  label: string;
  eyebrow: string;
  evidence: FlowFestCampPlanEvidence;
  kind: "landmark" | "public-road" | "internal-drive" | "region" | "site";
  distanceMeters: number;
}

export interface FlowFestCampPlan {
  bounds: FlowFestRuntimeContract["surfaceEvidenceProxy"]["activeBoundsWorldMeters"];
  publicRoads: FlowFestCampPlanLine[];
  internalDrives: FlowFestCampPlanLine[];
  footConnectors: FlowFestCampPlanLine[];
  zones: FlowFestCampPlanZone[];
  regions: FlowFestCampPlanRegion[];
  landmarks: FlowFestCampPlanLandmark[];
  selectedCampZoneId: string;
}

export function allFlowFestCampPlanLines(
  plan: FlowFestCampPlan
): FlowFestCampPlanLine[] {
  return [...plan.publicRoads, ...plan.internalDrives, ...plan.footConnectors];
}

export function flowFestCampPlanLineToRuntimeSegment(
  line: FlowFestCampPlanLine
): FlowFestRuntimeSegment {
  return {
    id: line.id,
    mode: line.kind === "foot-connector" ? "person" : "vehicle",
    widthMeters: line.widthMeters,
    lengthMeters: line.points.reduce((length, point, index) => {
      const previous = line.points[index - 1];
      return previous
        ? length + Math.hypot(point.x - previous.x, point.z - previous.z)
        : length;
    }, 0),
    sourceClasses: [line.evidence],
    pathClass: line.kind,
    points: line.points.map((point) => ({
      x: point.x,
      z: point.z,
      sourceTerrainY: 0,
      reviewTerrainY: 0,
    })),
  };
}

export const FLOW_FEST_GROUND_COORDINATE_FRAME = Object.freeze({
  width: 2048,
  height: 2048,
  pixelSizeMeters: 0.5,
  worldMinX: -512,
  worldMinZ: -512,
  sourcePath: "static/data/flow-fest-sim/ortho.webp",
  sourceSha256:
    "abbf63d78d4d4cc29f3df591e2c19687cba8ce63811748008a8bc6235e18fd2f",
});

export const FLOW_FEST_PUBLIC_ROAD_SOURCE = Object.freeze({
  agency: "Ohio Department of Transportation",
  dataset: "TIMS Road Inventory",
  featureObjectId: 3019609,
  networkLinearFeatureId: "CPRECR00024**C",
  label: "Camden College Corner Rd",
  projectedCrs: "EPSG:26916",
  retrievedAt: "2026-08-27",
  serviceUrl:
    "https://tims.dot.state.oh.us/ags/rest/services/Roadway_Information/Road_Inventory/FeatureServer/0",
  note: "Clipped from the official centerline into the terrain's registered metre frame. The campground's internal drives remain orthophoto interpretations.",
});

export const FLOW_FEST_ORTHOPHOTO_SOURCE = Object.freeze({
  agency: "USDA-FSA-APFO",
  product: "National Agriculture Imagery Program",
  rasterName: "m_3908426_ne_17_030_20230522",
  acquisitionDate: "2023-05-22",
  projectedCrs: "EPSG:26916",
  groundSampleDistanceMeters: 0.3,
  serviceUrl:
    "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer",
  rights: "USGS and USDA NAIP; public domain",
  runtimeRaster: FLOW_FEST_GROUND_COORDINATE_FRAME,
});

/**
 * The lower campground road is one continuous loop in the registered NAIP
 * image. These centerline samples follow the visible pale vehicle track; they
 * are an imagery interpretation, not a survey of either road edge.
 */
export const FLOW_FEST_LOWER_CAMPGROUND_LOOP_NAIP_PIXELS = Object.freeze([
  { x: 1647, y: 820 },
  { x: 1655, y: 790 },
  { x: 1664, y: 750 },
  { x: 1665, y: 730 },
  { x: 1655, y: 710 },
  { x: 1640, y: 695 },
  { x: 1618, y: 680 },
  { x: 1585, y: 670 },
  { x: 1550, y: 662 },
  { x: 1535, y: 665 },
  { x: 1515, y: 695 },
  { x: 1505, y: 730 },
  { x: 1493, y: 770 },
  { x: 1485, y: 805 },
  { x: 1490, y: 835 },
  { x: 1525, y: 845 },
  { x: 1570, y: 854 },
  { x: 1607, y: 860 },
  { x: 1625, y: 855 },
  { x: 1638, y: 842 },
  { x: 1647, y: 820 },
]);

export const FLOW_FEST_LOWER_CAMPGROUND_LOOP = Object.freeze(
  FLOW_FEST_LOWER_CAMPGROUND_LOOP_NAIP_PIXELS.map(flowFestNaipPixelToWorld)
);

/**
 * Austen's lower-level occupancy correction is topological rather than a
 * claim about any one festival weekend's exact pitch locations. The loop is
 * the circulation boundary: car camping occupies its middle, a smaller tent
 * population sits inside the road edge, and the main tent population lives
 * across the road beside the tree line.
 */
export const FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY = Object.freeze({
  evidence: "austen-observed-topology" as const,
  circulationRoadId: "lower-campground-loop",
  centerVehicleCount: 32,
  centerTentCount: 4,
  innerRoadsideTentCount: 8,
  outerTreeLineTentCount: 14,
  sourceNote:
    "Austen's 2026-08-28 correction: the loop is the lower-level vehicle road; cars concentrate in its open middle, only a few tents mix with cars, more tents sit near the inside edge, and the main tent population occupies the tree-line side outside the road.",
});

export function flowFestNaipPixelToWorld(point: {
  x: number;
  y: number;
}): Pick<FlowFestRuntimePoint, "x" | "z"> {
  return {
    x: Number(
      (
        FLOW_FEST_GROUND_COORDINATE_FRAME.worldMinX +
        point.x * FLOW_FEST_GROUND_COORDINATE_FRAME.pixelSizeMeters
      ).toFixed(1)
    ),
    z: Number(
      (
        FLOW_FEST_GROUND_COORDINATE_FRAME.worldMinZ +
        point.y * FLOW_FEST_GROUND_COORDINATE_FRAME.pixelSizeMeters
      ).toFixed(1)
    ),
  };
}

/**
 * The official ODOT centerline clipped to the registered terrain frame.
 *
 * ODOT supplied NAD83 / UTM 16N coordinates. The terrain manifest owns the
 * conversion: worldX = easting - 690142 and worldZ = 4384552 - northing.
 */
export const FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD = Object.freeze([
  { x: -170, z: 21 },
  { x: -17.3, z: 13.5 },
  { x: 122.4, z: 5.3 },
  { x: 161.2, z: 2.6 },
  { x: 213.2, z: -2.1 },
  { x: 239.2, z: -6 },
  { x: 256.3, z: -11.2 },
  { x: 270.8, z: -18.3 },
  { x: 280.2, z: -24.4 },
  { x: 288, z: -31 },
  { x: 294.9, z: -37.9 },
  { x: 303.5, z: -49.7 },
  { x: 310, z: -61.9 },
  { x: 321.8, z: -86.2 },
  { x: 329.9, z: -101.2 },
  { x: 340, z: -117.3 },
  { x: 354.3, z: -136.7 },
  { x: 370, z: -157.5 },
] satisfies Array<Pick<FlowFestRuntimePoint, "x" | "z">>);

export const FLOW_FEST_CAMP_PLAN_BOUNDS = Object.freeze({
  minX: -170,
  maxX: 380,
  minZ: -180,
  maxZ: 150,
});

/**
 * The entrance anchor is the August 2024 Street View panorama projected into
 * the terrain frame, then snapped 0.63 m to ODOT road feature 3019609. The
 * west-side drive bearing is registered against the same panorama and the
 * identifiable junction in the 2023 NAIP raster.
 */
export const FLOW_FEST_CAMP_ROAD_ENTRANCE = Object.freeze({
  x: 328.2557337440163,
  z: -98.15506248891917,
});
export const FLOW_FEST_LOWER_ENTRANCE_BASIS = Object.freeze({
  origin: FLOW_FEST_CAMP_ROAD_ENTRANCE,
  driveInwardUnit: Object.freeze({
    x: -0.8155320116040978,
    z: -0.5787119646672026,
  }),
  driveRightUnit: Object.freeze({
    x: 0.5787119646672026,
    z: -0.8155320116040978,
  }),
  roadTangentUnit: Object.freeze({
    x: 0.4751489147348839,
    z: -0.8799053976571926,
  }),
});

export function flowFestLowerEntranceLocalToWorld(point: {
  right: number;
  depth: number;
}): Pick<FlowFestRuntimePoint, "x" | "z"> {
  const basis = FLOW_FEST_LOWER_ENTRANCE_BASIS;
  return {
    x:
      basis.origin.x +
      basis.driveRightUnit.x * point.right +
      basis.driveInwardUnit.x * point.depth,
    z:
      basis.origin.z +
      basis.driveRightUnit.z * point.right +
      basis.driveInwardUnit.z * point.depth,
  };
}

export const FLOW_FEST_LOWER_LOOP_ROAD_CROSSING =
  FLOW_FEST_LOWER_CAMPGROUND_LOOP[0]!;
const LOWER_LOOP_PREVIOUS_ENTRANCE_POINT =
  FLOW_FEST_LOWER_CAMPGROUND_LOOP[FLOW_FEST_LOWER_CAMPGROUND_LOOP.length - 2]!;
const LOWER_LOOP_NEXT_ENTRANCE_POINT = FLOW_FEST_LOWER_CAMPGROUND_LOOP[1]!;
const LOWER_LOOP_ENTRANCE_TANGENT_LENGTH = Math.hypot(
  LOWER_LOOP_NEXT_ENTRANCE_POINT.x - LOWER_LOOP_PREVIOUS_ENTRANCE_POINT.x,
  LOWER_LOOP_NEXT_ENTRANCE_POINT.z - LOWER_LOOP_PREVIOUS_ENTRANCE_POINT.z
);
export const FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT = Object.freeze({
  x:
    (LOWER_LOOP_NEXT_ENTRANCE_POINT.x - LOWER_LOOP_PREVIOUS_ENTRANCE_POINT.x) /
    LOWER_LOOP_ENTRANCE_TANGENT_LENGTH,
  z:
    (LOWER_LOOP_NEXT_ENTRANCE_POINT.z - LOWER_LOOP_PREVIOUS_ENTRANCE_POINT.z) /
    LOWER_LOOP_ENTRANCE_TANGENT_LENGTH,
});
const LOWER_LOOP_CENTROID = FLOW_FEST_LOWER_CAMPGROUND_LOOP.slice(0, -1).reduce(
  (sum, point) => ({
    x: sum.x + point.x / (FLOW_FEST_LOWER_CAMPGROUND_LOOP.length - 1),
    z: sum.z + point.z / (FLOW_FEST_LOWER_CAMPGROUND_LOOP.length - 1),
  }),
  { x: 0, z: 0 }
);
const LOWER_LOOP_LEFT_NORMAL = {
  x: -FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.z,
  z: FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.x,
};
const LEFT_NORMAL_POINTS_INSIDE =
  LOWER_LOOP_LEFT_NORMAL.x *
    (LOWER_LOOP_CENTROID.x - FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.x) +
    LOWER_LOOP_LEFT_NORMAL.z *
      (LOWER_LOOP_CENTROID.z - FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.z) >
  0;
export const FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR = Object.freeze({
  x: LEFT_NORMAL_POINTS_INSIDE
    ? LOWER_LOOP_LEFT_NORMAL.x
    : -LOWER_LOOP_LEFT_NORMAL.x,
  z: LEFT_NORMAL_POINTS_INSIDE
    ? LOWER_LOOP_LEFT_NORMAL.z
    : -LOWER_LOOP_LEFT_NORMAL.z,
});
export const FLOW_FEST_LOWER_GATEHOUSE_SITE = Object.freeze({
  x:
    FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.x +
    FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR.x * 14,
  z:
    FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.z +
    FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR.z * 14,
});
export const FLOW_FEST_LOWER_CHECK_IN = Object.freeze({
  x:
    FLOW_FEST_LOWER_GATEHOUSE_SITE.x +
    FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.x * 8.5,
  z:
    FLOW_FEST_LOWER_GATEHOUSE_SITE.z +
    FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.z * 8.5,
});
export const FLOW_FEST_LOWER_ENTRANCE_APPROACH_ID =
  "camp-road-entrance-to-check-in";
export const FLOW_FEST_LOWER_ENTRANCE_APRON_ID = "lower-entrance-apron";
export const FLOW_FEST_LOWER_ENTRANCE_APPROACH = Object.freeze([
  FLOW_FEST_CAMP_ROAD_ENTRANCE,
  FLOW_FEST_LOWER_LOOP_ROAD_CROSSING,
]);
export const FLOW_FEST_LOWER_ENTRANCE_APRON = Object.freeze([
  FLOW_FEST_LOWER_LOOP_ROAD_CROSSING,
  FLOW_FEST_LOWER_CHECK_IN,
]);

export const FLOW_FEST_ENTRANCE_REGISTRATION = Object.freeze({
  panoramaId: "1Zay8yG4Mf31AxM3p0N25w",
  panoramaLatitude: 39.5904289,
  panoramaLongitude: -84.7819155,
  panoramaHeadingDegrees: 305.36,
  panoramaWorld: Object.freeze({
    x: 328.8110914272,
    z: -97.85516934,
  }),
  roadSnapWorld: FLOW_FEST_CAMP_ROAD_ENTRANCE,
  roadSnapOffsetMeters: 0.6311561273090756,
  naipPixel: Object.freeze({ column: 1681.622, row: 828.29 }),
  naipRasterObjectId: 146870,
  projectedCrs: "EPSG:26916",
});
const WEST_PARKING_GATE = Object.freeze({ x: 22, z: 11.2 });

const CAMP_ZONE_BY_BRANCH: Record<FlowFestBranchId, string> = {
  "lower-tent": "lower-tent-zone",
  "upper-tent": "upper-tent-zone",
  "car-camp": "car-camp-zone",
};

function requiredZone(
  contract: FlowFestRuntimeContract,
  id: string
): FlowFestRuntimeZone {
  const zone = contract.zones.find((candidate) => candidate.id === id);
  if (!zone) throw new Error(`Flow Fest camp plan zone is missing: ${id}`);
  return zone;
}

function requiredSegment(
  contract: FlowFestRuntimeContract,
  id: string
): FlowFestRuntimeSegment {
  for (const branch of Object.values(contract.routes.arrivalBranches)) {
    const segment = branch.segments.find((candidate) => candidate.id === id);
    if (segment) return segment;
  }
  throw new Error(`Flow Fest camp plan segment is missing: ${id}`);
}

function toZone(zone: FlowFestRuntimeZone): FlowFestCampPlanZone {
  return {
    id: zone.id,
    label: zone.label,
    evidence:
      zone.class === "interpreted"
        ? "imagery-interpreted"
        : "festival-placement",
    center: zone.center,
    radiusXMeters: zone.radiusMeters ?? zone.searchRadiusXMeters ?? 8,
    radiusZMeters: zone.radiusMeters ?? zone.searchRadiusZMeters ?? 8,
  };
}

function buildInternalDrives(
  contract: FlowFestRuntimeContract
): FlowFestCampPlanLine[] {
  requiredSegment(contract, "lower-tent-unload");
  return [
    {
      id: FLOW_FEST_LOWER_ENTRANCE_APPROACH_ID,
      label: "Camp entrance to lower loop",
      evidence: "imagery-interpreted",
      kind: "internal-drive",
      widthMeters: 3.6,
      points: [...FLOW_FEST_LOWER_ENTRANCE_APPROACH],
      sourceNote:
        "The public-road turn is registered from exact August 2024 Street View panorama metadata to ODOT road feature 3019609. The interpreted private drive terminates at one junction on the visible lower-loop road in the 2023 public-domain NAIP orthophoto; it does not continue across or double back through the loop interior.",
    },
    {
      id: "lower-campground-loop",
      label: "Lower campground loop",
      evidence: "public-orthophoto",
      kind: "internal-drive",
      widthMeters: 3.8,
      points: [...FLOW_FEST_LOWER_CAMPGROUND_LOOP],
      sourceNote:
        "Centerline sampled from the continuous pale vehicle loop visible in the registered 2023 public-domain NAIP orthophoto. The exact road edges and surface condition remain field-unverified.",
    },
    {
      id: "west-road-to-upper-clearing",
      label: "West camp entrance",
      evidence: "imagery-interpreted",
      kind: "internal-drive",
      widthMeters: 3.6,
      points: [WEST_PARKING_GATE, { x: -20, z: -45 }, { x: -62, z: -74 }],
      sourceNote:
        "Generalized from the 2023 public-domain orthophoto. The road junction is plan-level interpretation, not a surveyed driveway edge.",
    },
    {
      id: "upper-clearing-to-west-parking",
      label: "West parking access",
      evidence: "imagery-interpreted",
      kind: "internal-drive",
      widthMeters: 3.6,
      points: [
        { x: -62, z: -74 },
        { x: -90, z: -50 },
        { x: -110, z: -30 },
      ],
      sourceNote:
        "Generalized from the registered arrival route and public-domain orthophoto; parking circulation remains provisional.",
    },
  ];
}

function clipConnectorAtLoopBoundary(
  points: ReadonlyArray<Pick<FlowFestRuntimePoint, "x" | "z">>,
  loop: ReadonlyArray<Pick<FlowFestRuntimePoint, "x" | "z">>
): Array<Pick<FlowFestRuntimePoint, "x" | "z">> {
  if (points.length < 2 || loop.length < 3) return [...points];

  const clipped = [points[0]!];
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1]!;
    const end = points[pointIndex]!;
    const intersections = loop.slice(1).flatMap((edgeEnd, edgeIndex) => {
      const intersection = segmentIntersection(
        start,
        end,
        loop[edgeIndex]!,
        edgeEnd
      );
      return intersection ? [intersection] : [];
    });

    const firstIntersection = intersections.sort(
      (first, second) => first.progress - second.progress
    )[0];
    if (firstIntersection) {
      clipped.push({ x: firstIntersection.x, z: firstIntersection.z });
      return clipped;
    }
    clipped.push(end);
  }

  return clipped;
}

function segmentIntersection(
  lineStart: Pick<FlowFestRuntimePoint, "x" | "z">,
  lineEnd: Pick<FlowFestRuntimePoint, "x" | "z">,
  edgeStart: Pick<FlowFestRuntimePoint, "x" | "z">,
  edgeEnd: Pick<FlowFestRuntimePoint, "x" | "z">
): { x: number; z: number; progress: number } | null {
  const lineX = lineEnd.x - lineStart.x;
  const lineZ = lineEnd.z - lineStart.z;
  const edgeX = edgeEnd.x - edgeStart.x;
  const edgeZ = edgeEnd.z - edgeStart.z;
  const denominator = lineX * edgeZ - lineZ * edgeX;
  if (Math.abs(denominator) < Number.EPSILON) return null;

  const offsetX = edgeStart.x - lineStart.x;
  const offsetZ = edgeStart.z - lineStart.z;
  const progress = (offsetX * edgeZ - offsetZ * edgeX) / denominator;
  const edgeProgress = (offsetX * lineZ - offsetZ * lineX) / denominator;
  if (progress < 0 || progress > 1 || edgeProgress < 0 || edgeProgress > 1) {
    return null;
  }

  return {
    x: lineStart.x + lineX * progress,
    z: lineStart.z + lineZ * progress,
    progress,
  };
}

function buildRegions(): FlowFestCampPlanRegion[] {
  return [
    {
      id: "north-connector-woodland",
      label: "Woodland between upper and middle levels",
      evidence: "public-orthophoto",
      kind: "woodland",
      shape: "ellipse",
      center: { x: 25, z: -98 },
      radiusXMeters: 88,
      radiusZMeters: 34,
      sourceNote:
        "Broad canopy belt generalized from 2023 NAIP and corroborated by the measured LiDAR surface raster; it does not identify individual trees.",
    },
    {
      id: "east-connector-woodland",
      label: "Woodland between middle and lower levels",
      evidence: "public-orthophoto",
      kind: "woodland",
      shape: "ellipse",
      center: { x: 196, z: -111 },
      radiusXMeters: 86,
      radiusZMeters: 31,
      sourceNote:
        "Broad canopy belt generalized from 2023 NAIP and corroborated by the measured LiDAR surface raster; it does not identify individual trees.",
    },
    {
      id: "upper-clearing-region",
      label: "Upper clearing",
      evidence: "public-orthophoto",
      kind: "clearing",
      shape: "ellipse",
      center: { x: -62, z: -74 },
      radiusXMeters: 55,
      radiusZMeters: 37,
      sourceNote:
        "Broad open-ground envelope generalized from 2023 NAIP; campsite boundaries remain provisional.",
    },
    {
      id: "middle-earth-region",
      label: "Middle Earth",
      evidence: "austen-observed-topology",
      kind: "clearing",
      shape: "ellipse",
      center: { x: 100, z: -115 },
      radiusXMeters: 47,
      radiusZMeters: 31,
      sourceNote:
        "Activity-tier identity comes from Austen; the broad clearing envelope is generalized from 2023 NAIP.",
    },
    {
      id: "lower-level-region",
      label: "Lower level",
      evidence: "austen-observed-topology",
      kind: "clearing",
      shape: "ellipse",
      center: { x: 286, z: -130 },
      radiusXMeters: 54,
      radiusZMeters: 37,
      sourceNote:
        "Lower-level identity comes from Austen; the broad clearing envelope is generalized from 2023 NAIP.",
    },
    {
      id: "west-parking-field-region",
      label: "West parking field",
      evidence: "festival-placement",
      kind: "parking-field",
      shape: "ellipse",
      center: { x: -110, z: -30 },
      radiusXMeters: 34,
      radiusZMeters: 25,
      sourceNote:
        "Austen established the parking role; the exact festival parking envelope remains provisional.",
    },
    {
      id: "south-crop-field-region",
      label: "South cornfield landmark",
      evidence: "austen-observed-topology",
      kind: "crop-field",
      shape: "polygon",
      points: [
        { x: -170, z: 29 },
        { x: -17, z: 22 },
        { x: 122, z: 14 },
        { x: 190, z: 8 },
        { x: 225, z: 32 },
        { x: 210, z: 150 },
        { x: -170, z: 150 },
      ],
      sourceNote:
        "Austen supplied the cornfield identity. Its generalized 2023 field boundary comes from public-domain NAIP and does not assert a current crop or parcel line.",
    },
  ];
}

function buildLandmarks(
  contract: FlowFestRuntimeContract,
  selectedCampZoneId: string
): FlowFestCampPlanLandmark[] {
  const parking = requiredZone(contract, "west-upper-parking-zone");
  const lower = requiredZone(contract, "lower-tent-zone");
  const middle = requiredZone(contract, "middle-earth-zone");
  const selectedCamp = requiredZone(contract, selectedCampZoneId);
  return [
    {
      id: "camp-road-entrance",
      label: "Camp road entrance",
      mapLabel: "Entrance",
      evidence: "imagery-interpreted",
      kind: "entrance",
      position: FLOW_FEST_LOWER_GATEHOUSE_SITE,
      approachRadiusMeters: 18,
      sourceNote:
        "The modest Street View-observed gatehouse is placed provisionally on the loop-interior side, derived from the entrance segment's inward normal with full footprint clearance behind the road. Its approach remains tied to the ODOT-snapped public-road turn and the interpreted private drive visible in registered 2023 NAIP.",
    },
    {
      id: "lower-check-in-gate",
      label: "Lower check-in gate",
      mapLabel: "Check-in",
      evidence: "festival-placement",
      kind: "check-in",
      position: FLOW_FEST_LOWER_CHECK_IN,
      approachRadiusMeters: 14,
      sourceNote:
        "Austen established check-in at the lower-level gate. The marker sits beside the gatehouse on the interior apron, clear of both the building footprint and the lower-loop vehicle road; its exact operational stopping point remains Austen-correctable.",
    },
    {
      id: "west-parking-gate",
      label: "West parking turn",
      mapLabel: "Parking gate",
      evidence: "imagery-interpreted",
      kind: "parking-gate",
      position: WEST_PARKING_GATE,
      approachRadiusMeters: 16,
      sourceNote:
        "Public-road turn toward the upper clearing generalized from 2023 NAIP; gate hardware is not asserted.",
    },
    {
      id: "west-upper-parking",
      label: "West upper parking",
      mapLabel: "Parking",
      evidence: "festival-placement",
      kind: "parking",
      position: parking.center,
      approachRadiusMeters: 24,
      sourceNote:
        "Austen established the parking field's role. Exact vehicle rows and event boundary remain provisional.",
    },
    {
      id: "lower-level",
      label: "Lower level",
      mapLabel: "Lower level",
      evidence: "austen-observed-topology",
      kind: "clearing",
      position: lower.center,
      approachRadiusMeters: 42,
      sourceNote:
        "Tier identity comes from Austen; the clearing center is registered against 2023 NAIP and measured terrain.",
    },
    {
      id: "middle-earth",
      label: "Middle Earth",
      mapLabel: "Middle Earth",
      evidence: "austen-observed-topology",
      kind: "clearing",
      position: middle.center,
      approachRadiusMeters: 35,
      sourceNote:
        "Activity-tier identity comes from Austen; the clearing center is registered against 2023 NAIP and measured terrain.",
    },
    {
      id: "camp-buildings",
      label: "Camp buildings",
      mapLabel: "Buildings",
      evidence: "public-orthophoto",
      kind: "buildings",
      position: { x: 38, z: -28 },
      approachRadiusMeters: 26,
      sourceNote:
        "Orthophoto-visible building cluster. Individual functions, ownership, and exact footprints are not asserted.",
    },
    {
      id: "south-cornfield",
      label: "South cornfield",
      mapLabel: "Cornfield",
      evidence: "austen-observed-topology",
      kind: "crop-field",
      position: { x: 70, z: 88 },
      approachRadiusMeters: 75,
      sourceNote:
        "Austen supplied the cornfield identity. The plan only asserts a broad agricultural field visible in 2023 NAIP.",
    },
    {
      id: "selected-camp",
      label: `Your camp · ${(selectedCamp.label ?? "Selected camp").replace(/ example|: open middle/gi, "")}`,
      mapLabel: "Your camp",
      evidence: "festival-placement",
      kind: "camp",
      position: selectedCamp.center,
      approachRadiusMeters:
        selectedCamp.radiusMeters ?? selectedCamp.searchRadiusXMeters ?? 18,
      sourceNote:
        "Gameplay home marker selected from the active camping branch; it is not a surveyed campsite number.",
    },
  ];
}

export function createFlowFestCampPlan(
  contract: FlowFestRuntimeContract,
  branch: FlowFestBranchId
): FlowFestCampPlan {
  const selectedCampZoneId = CAMP_ZONE_BY_BRANCH[branch];
  const middleToLowerLoop = clipConnectorAtLoopBoundary(
    contract.connectorTraces.middleEarthToLowerClearing.vertices,
    FLOW_FEST_LOWER_CAMPGROUND_LOOP
  );
  return {
    bounds: { ...FLOW_FEST_CAMP_PLAN_BOUNDS },
    publicRoads: [
      {
        id: "odot-camden-college-corner-road",
        label: FLOW_FEST_PUBLIC_ROAD_SOURCE.label,
        evidence: "official-road-inventory",
        kind: "public-road",
        widthMeters: 6.8,
        points: [...FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD],
        sourceNote: FLOW_FEST_PUBLIC_ROAD_SOURCE.note,
      },
    ],
    internalDrives: buildInternalDrives(contract),
    footConnectors: [
      {
        id: "upper-to-middle",
        label: "Upper to Middle Earth",
        evidence: "austen-traced",
        kind: "foot-connector",
        widthMeters: 1.8,
        points: contract.connectorTraces.upperClearingToMiddleEarth.vertices,
        sourceNote:
          "Austen's orthophoto trace, preserved as a route centerline rather than a surveyed trail edge.",
      },
      {
        id: "middle-to-lower",
        label: "Middle Earth to lower loop",
        evidence: "austen-traced",
        kind: "foot-connector",
        widthMeters: 1.8,
        points: middleToLowerLoop,
        sourceNote:
          "Austen's orthophoto trace through the woodland, clipped where it meets the lower campground loop so it does not imply a path through the car-camping field.",
      },
    ],
    zones: contract.zones.map(toZone),
    regions: buildRegions(),
    landmarks: buildLandmarks(contract, selectedCampZoneId),
    selectedCampZoneId,
  };
}

export function identifyFlowFestPlanLocation(
  plan: FlowFestCampPlan,
  position: { x: number; z: number }
): FlowFestCampPlanLocation {
  const landmark = plan.landmarks
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(
        position.x - candidate.position.x,
        position.z - candidate.position.z
      ),
    }))
    .filter(({ candidate, distance }) =>
      candidate.kind === "crop-field"
        ? false
        : distance <= candidate.approachRadiusMeters
    )
    .sort(
      (first, second) =>
        first.distance - second.distance ||
        landmarkPriority(second.candidate.kind) -
          landmarkPriority(first.candidate.kind)
    )[0];
  if (landmark) {
    return {
      id: landmark.candidate.id,
      label: landmark.candidate.label,
      eyebrow: landmarkEyebrow(landmark.candidate.kind),
      evidence: landmark.candidate.evidence,
      kind: "landmark",
      distanceMeters: landmark.distance,
    };
  }

  const publicRoad = nearestLine(plan.publicRoads, position);
  if (
    publicRoad &&
    publicRoad.distance <= publicRoad.line.widthMeters / 2 + 6
  ) {
    return {
      id: publicRoad.line.id,
      label: publicRoad.line.label,
      eyebrow: "Public road",
      evidence: publicRoad.line.evidence,
      kind: "public-road",
      distanceMeters: publicRoad.distance,
    };
  }

  const internalDrive = nearestLine(plan.internalDrives, position);
  if (
    internalDrive &&
    internalDrive.distance <= internalDrive.line.widthMeters / 2 + 5
  ) {
    return {
      id: internalDrive.line.id,
      label: internalDrive.line.label,
      eyebrow: "Camp access",
      evidence: internalDrive.line.evidence,
      kind: "internal-drive",
      distanceMeters: internalDrive.distance,
    };
  }

  const region = plan.regions.find((candidate) =>
    pointInsideRegion(candidate, position)
  );
  if (region) {
    return {
      id: region.id,
      label: region.label,
      eyebrow: regionEyebrow(region.kind),
      evidence: region.evidence,
      kind: "region",
      distanceMeters: distanceToRegionCenter(region, position),
    };
  }

  return {
    id: "campground-transit",
    label: "Between camp landmarks",
    eyebrow: "Campground",
    evidence: "public-orthophoto",
    kind: "site",
    distanceMeters: 0,
  };
}

function landmarkEyebrow(kind: FlowFestCampPlanLandmarkKind): string {
  if (kind === "entrance" || kind === "parking-gate") return "Entrance";
  if (kind === "check-in") return "Check-in";
  if (kind === "parking") return "Parking";
  if (kind === "clearing") return "Level";
  if (kind === "buildings") return "Landmark";
  if (kind === "camp") return "Home camp";
  return "Landmark";
}

function landmarkPriority(kind: FlowFestCampPlanLandmarkKind): number {
  if (kind === "camp") return 5;
  if (kind === "check-in" || kind === "entrance" || kind === "parking-gate") {
    return 4;
  }
  if (kind === "parking") return 3;
  if (kind === "buildings") return 2;
  return 1;
}

function regionEyebrow(kind: FlowFestCampPlanRegionKind): string {
  if (kind === "crop-field") return "South boundary";
  if (kind === "woodland") return "Woodland";
  if (kind === "parking-field") return "Parking";
  return "Camp level";
}

function nearestLine(
  lines: FlowFestCampPlanLine[],
  point: { x: number; z: number }
): { line: FlowFestCampPlanLine; distance: number } | null {
  let nearest: { line: FlowFestCampPlanLine; distance: number } | null = null;
  for (const line of lines) {
    for (let index = 1; index < line.points.length; index += 1) {
      const distance = distanceToSegment(
        point,
        line.points[index - 1]!,
        line.points[index]!
      );
      if (!nearest || distance < nearest.distance) nearest = { line, distance };
    }
  }
  return nearest;
}

function distanceToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
    )
  );
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function pointInsideRegion(
  region: FlowFestCampPlanRegion,
  point: { x: number; z: number }
): boolean {
  if (region.shape === "ellipse") {
    if (!region.center || !region.radiusXMeters || !region.radiusZMeters)
      return false;
    const x = (point.x - region.center.x) / region.radiusXMeters;
    const z = (point.z - region.center.z) / region.radiusZMeters;
    return x * x + z * z <= 1;
  }
  const polygon = region.points ?? [];
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    const intersects =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToRegionCenter(
  region: FlowFestCampPlanRegion,
  point: { x: number; z: number }
): number {
  if (region.center) {
    return Math.hypot(region.center.x - point.x, region.center.z - point.z);
  }
  const polygon = region.points ?? [];
  const sum = polygon.reduce(
    (total, candidate) => ({
      x: total.x + candidate.x,
      z: total.z + candidate.z,
    }),
    { x: 0, z: 0 }
  );
  const divisor = Math.max(1, polygon.length);
  return Math.hypot(sum.x / divisor - point.x, sum.z / divisor - point.z);
}
