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
});

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

const ORIENTATION_BOUNDS = Object.freeze({
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
export const FLOW_FEST_ENTRANCE_APRON_JOIN = Object.freeze({
  x: 302.97424138428926,
  z: -116.09513339360245,
});
export const FLOW_FEST_LOWER_CHECK_IN = Object.freeze({
  x: 298.791509455475,
  z: -115.384673252792,
});

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
  const lowerAccess = requiredSegment(contract, "lower-tent-unload");
  return [
    {
      id: "camp-road-entrance-to-check-in",
      label: "Camp entrance to check-in",
      evidence: "imagery-interpreted",
      kind: "internal-drive",
      widthMeters: 3.6,
      points: [
        FLOW_FEST_CAMP_ROAD_ENTRANCE,
        FLOW_FEST_ENTRANCE_APRON_JOIN,
        FLOW_FEST_LOWER_CHECK_IN,
      ],
      sourceNote:
        "West-side junction registered from exact August 2024 Street View panorama metadata to ODOT road feature 3019609, then corroborated by the identifiable junction in the 2023 public-domain NAIP orthophoto. The check-in gameplay marker is placed on the driveway center beside the observed gatehouse and remains Austen-correctable.",
    },
    {
      id: "check-in-to-lower-level",
      label: "Lower-level access",
      evidence: "imagery-interpreted",
      kind: "internal-drive",
      widthMeters: 3.6,
      points: lowerAccess.points,
      sourceNote:
        "Registered from the public-domain orthophoto; surface width and gate hardware remain field-unverified.",
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
      position: FLOW_FEST_CAMP_ROAD_ENTRANCE,
      approachRadiusMeters: 18,
      sourceNote:
        "West-side private-drive junction registered from exact August 2024 Street View camera metadata to ODOT road feature 3019609 with a 0.63 m centerline residual, and corroborated by the junction visible in registered 2023 NAIP.",
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
        "Austen established check-in at the lower-level gate. The marker is constrained to the registered west-side driveway beside the Street View-observed gatehouse; its exact operational stopping point remains Austen-correctable.",
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
  return {
    bounds: { ...ORIENTATION_BOUNDS },
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
        label: "Middle Earth to lower level",
        evidence: "austen-traced",
        kind: "foot-connector",
        widthMeters: 1.8,
        points: contract.connectorTraces.middleEarthToLowerClearing.vertices,
        sourceNote:
          "Austen's orthophoto trace, preserved as a route centerline rather than a surveyed trail edge.",
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
