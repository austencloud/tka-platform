export const FLOW_FEST_FIELD_POSITIONING_VERSION = 1 as const;
export const FLOW_FEST_GNSS_MAX_ACCURACY_METERS = 18;
export const FLOW_FEST_GNSS_STALE_AFTER_MILLISECONDS = 6_000;
// Phone/device clocks can drift a couple of seconds without anything being
// wrong. Beyond that tolerance a future-dated fix is a bad device timestamp,
// not a real position lock, so it must not be clamped into looking fresh.
export const FLOW_FEST_GNSS_CLOCK_SKEW_TOLERANCE_MILLISECONDS = 2_000;

export interface FlowFestFieldReference {
  projectedCrsCode: 26916;
  originEastingMeters: number;
  originNorthingMeters: number;
  boundsWorldMeters: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface FlowFestGnssFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestampMilliseconds: number;
  headingDegrees: number | null;
  speedMetersPerSecond: number | null;
}

export interface FlowFestGnssReplaySample extends Omit<
  FlowFestGnssFix,
  "timestampMilliseconds"
> {
  elapsedMilliseconds: number;
}

export type FlowFestGnssQuality =
  | "nominal"
  | "degraded-accuracy"
  | "degraded-stale"
  | "outside-site";

export interface FlowFestGnssEvaluation {
  quality: FlowFestGnssQuality;
  accepted: boolean;
  ageMilliseconds: number;
  world: { x: number; z: number };
  reason: string;
}

export interface FlowFestGnssRoundTripAudit {
  samples: number;
  maximumErrorMeters: number;
  rmsErrorMeters: number;
}

const SEMI_MAJOR_AXIS_METERS = 6_378_137;
const INVERSE_FLATTENING = 298.257222101;
const SCALE_FACTOR = 0.9996;
const CENTRAL_MERIDIAN_RADIANS = (-87 * Math.PI) / 180;
const FALSE_EASTING_METERS = 500_000;

export function flowFestWgs84ToWorld(
  reference: FlowFestFieldReference,
  point: { latitude: number; longitude: number }
): { x: number; z: number } {
  assertReference(reference);
  assertCoordinates(point);
  const projected = geographicToUtm16(point.latitude, point.longitude);
  return {
    x: projected.easting - reference.originEastingMeters,
    z: reference.originNorthingMeters - projected.northing,
  };
}

export function flowFestWorldToWgs84(
  reference: FlowFestFieldReference,
  point: { x: number; z: number }
): { latitude: number; longitude: number } {
  assertReference(reference);
  if (![point.x, point.z].every(Number.isFinite)) {
    throw new Error("Flow Fest world position must be finite");
  }
  return utm16ToGeographic(
    reference.originEastingMeters + point.x,
    reference.originNorthingMeters - point.z
  );
}

export function evaluateFlowFestGnssFix(
  reference: FlowFestFieldReference,
  fix: FlowFestGnssFix,
  nowMilliseconds: number
): FlowFestGnssEvaluation {
  validateFix(fix);
  const world = flowFestWgs84ToWorld(reference, fix);
  const rawAgeMilliseconds = nowMilliseconds - fix.timestampMilliseconds;
  if (rawAgeMilliseconds < -FLOW_FEST_GNSS_CLOCK_SKEW_TOLERANCE_MILLISECONDS) {
    return {
      quality: "degraded-stale",
      accepted: false,
      ageMilliseconds: 0,
      world,
      reason:
        "The position fix has a future timestamp beyond the allowed clock skew",
    };
  }
  const ageMilliseconds = Math.max(0, rawAgeMilliseconds);
  if (ageMilliseconds > FLOW_FEST_GNSS_STALE_AFTER_MILLISECONDS) {
    return {
      quality: "degraded-stale",
      accepted: false,
      ageMilliseconds,
      world,
      reason: "Waiting for a current position fix",
    };
  }
  if (fix.accuracyMeters > FLOW_FEST_GNSS_MAX_ACCURACY_METERS) {
    return {
      quality: "degraded-accuracy",
      accepted: false,
      ageMilliseconds,
      world,
      reason: `Accuracy is ${Math.round(fix.accuracyMeters)} m; ${FLOW_FEST_GNSS_MAX_ACCURACY_METERS} m or better is required`,
    };
  }
  if (!insideFieldBounds(reference, world, fix.accuracyMeters)) {
    return {
      quality: "outside-site",
      accepted: false,
      ageMilliseconds,
      world,
      reason: "The position fix is outside the measured site",
    };
  }
  return {
    quality: "nominal",
    accepted: true,
    ageMilliseconds,
    world,
    reason: `Field position locked within ${fix.accuracyMeters.toFixed(1)} m`,
  };
}

export function createFlowFestGnssReplayTrack(
  reference: FlowFestFieldReference,
  points: Array<{ x: number; z: number }>,
  options: { intervalMilliseconds?: number; accuracyMeters?: number } = {}
): FlowFestGnssReplaySample[] {
  if (points.length < 2) {
    throw new Error("Flow Fest GNSS replay needs at least two world points");
  }
  const intervalMilliseconds = options.intervalMilliseconds ?? 450;
  const accuracyMeters = options.accuracyMeters ?? 4.5;
  if (intervalMilliseconds <= 0 || accuracyMeters <= 0) {
    throw new Error(
      "Flow Fest GNSS replay timing and accuracy must be positive"
    );
  }
  const dedupedPoints = dedupeWorldPoints(points);
  if (dedupedPoints.length < 2) {
    throw new Error(
      "Flow Fest GNSS replay needs at least two distinct world points"
    );
  }
  return dedupedPoints.map((point, index) => ({
    ...flowFestWorldToWgs84(reference, point),
    accuracyMeters,
    elapsedMilliseconds: index * intervalMilliseconds,
    headingDegrees: null,
    speedMetersPerSecond: null,
  }));
}

export function auditFlowFestGnssRoundTrip(
  reference: FlowFestFieldReference,
  points: Array<{ x: number; z: number }>
): FlowFestGnssRoundTripAudit {
  if (points.length === 0) {
    throw new Error("Flow Fest GNSS audit needs at least one point");
  }
  let maximumErrorMeters = 0;
  let squaredErrorSum = 0;
  for (const point of points) {
    const roundTrip = flowFestWgs84ToWorld(
      reference,
      flowFestWorldToWgs84(reference, point)
    );
    const error = Math.hypot(roundTrip.x - point.x, roundTrip.z - point.z);
    maximumErrorMeters = Math.max(maximumErrorMeters, error);
    squaredErrorSum += error * error;
  }
  return {
    samples: points.length,
    maximumErrorMeters,
    rmsErrorMeters: Math.sqrt(squaredErrorSum / points.length),
  };
}

function geographicToUtm16(
  latitudeDegrees: number,
  longitudeDegrees: number
): { easting: number; northing: number } {
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const longitude = (longitudeDegrees * Math.PI) / 180;
  const flattening = 1 / INVERSE_FLATTENING;
  const eccentricitySquared = flattening * (2 - flattening);
  const secondEccentricitySquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const tangentLatitude = Math.tan(latitude);
  const radiusOfCurvature =
    SEMI_MAJOR_AXIS_METERS /
    Math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
  const tangentSquared = tangentLatitude * tangentLatitude;
  const etaSquared = secondEccentricitySquared * cosLatitude * cosLatitude;
  const longitudeArc = cosLatitude * (longitude - CENTRAL_MERIDIAN_RADIANS);
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;
  const meridionalArc =
    SEMI_MAJOR_AXIS_METERS *
    ((1 -
      eccentricitySquared / 4 -
      (3 * eccentricityFourth) / 64 -
      (5 * eccentricitySixth) / 256) *
      latitude -
      ((3 * eccentricitySquared) / 8 +
        (3 * eccentricityFourth) / 32 +
        (45 * eccentricitySixth) / 1024) *
        Math.sin(2 * latitude) +
      ((15 * eccentricityFourth) / 256 + (45 * eccentricitySixth) / 1024) *
        Math.sin(4 * latitude) -
      ((35 * eccentricitySixth) / 3072) * Math.sin(6 * latitude));
  const easting =
    FALSE_EASTING_METERS +
    SCALE_FACTOR *
      radiusOfCurvature *
      (longitudeArc +
        ((1 - tangentSquared + etaSquared) * longitudeArc ** 3) / 6 +
        ((5 -
          18 * tangentSquared +
          tangentSquared ** 2 +
          72 * etaSquared -
          58 * secondEccentricitySquared) *
          longitudeArc ** 5) /
          120);
  const northing =
    SCALE_FACTOR *
    (meridionalArc +
      radiusOfCurvature *
        tangentLatitude *
        (longitudeArc ** 2 / 2 +
          ((5 - tangentSquared + 9 * etaSquared + 4 * etaSquared ** 2) *
            longitudeArc ** 4) /
            24 +
          ((61 -
            58 * tangentSquared +
            tangentSquared ** 2 +
            600 * etaSquared -
            330 * secondEccentricitySquared) *
            longitudeArc ** 6) /
            720));
  return { easting, northing };
}

function utm16ToGeographic(
  easting: number,
  northing: number
): { latitude: number; longitude: number } {
  const flattening = 1 / INVERSE_FLATTENING;
  const eccentricitySquared = flattening * (2 - flattening);
  const secondEccentricitySquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;
  const meridionalArc = northing / SCALE_FACTOR;
  const footprintMu =
    meridionalArc /
    (SEMI_MAJOR_AXIS_METERS *
      (1 -
        eccentricitySquared / 4 -
        (3 * eccentricityFourth) / 64 -
        (5 * eccentricitySixth) / 256));
  const firstEccentricity =
    (1 - Math.sqrt(1 - eccentricitySquared)) /
    (1 + Math.sqrt(1 - eccentricitySquared));
  const footprintLatitude =
    footprintMu +
    ((3 * firstEccentricity) / 2) * Math.sin(2 * footprintMu) -
    ((27 * firstEccentricity ** 3) / 32) * Math.sin(2 * footprintMu) +
    ((21 * firstEccentricity ** 2) / 16) * Math.sin(4 * footprintMu) -
    ((55 * firstEccentricity ** 4) / 32) * Math.sin(4 * footprintMu) +
    ((151 * firstEccentricity ** 3) / 96) * Math.sin(6 * footprintMu) +
    ((1097 * firstEccentricity ** 4) / 512) * Math.sin(8 * footprintMu);
  const sinFootprint = Math.sin(footprintLatitude);
  const cosFootprint = Math.cos(footprintLatitude);
  const tanFootprint = Math.tan(footprintLatitude);
  const normalRadius =
    SEMI_MAJOR_AXIS_METERS /
    Math.sqrt(1 - eccentricitySquared * sinFootprint * sinFootprint);
  const meridionalRadius =
    (SEMI_MAJOR_AXIS_METERS * (1 - eccentricitySquared)) /
    (1 - eccentricitySquared * sinFootprint * sinFootprint) ** 1.5;
  const tangentSquared = tanFootprint * tanFootprint;
  const etaSquared = secondEccentricitySquared * cosFootprint * cosFootprint;
  const normalizedEasting =
    (easting - FALSE_EASTING_METERS) / (normalRadius * SCALE_FACTOR);
  const latitude =
    footprintLatitude -
    ((normalRadius * tanFootprint) / meridionalRadius) *
      (normalizedEasting ** 2 / 2 -
        ((5 +
          3 * tangentSquared +
          10 * etaSquared -
          4 * etaSquared ** 2 -
          9 * secondEccentricitySquared) *
          normalizedEasting ** 4) /
          24 +
        ((61 +
          90 * tangentSquared +
          298 * etaSquared +
          45 * tangentSquared ** 2 -
          252 * secondEccentricitySquared -
          3 * etaSquared ** 2) *
          normalizedEasting ** 6) /
          720);
  const longitude =
    CENTRAL_MERIDIAN_RADIANS +
    (normalizedEasting -
      ((1 + 2 * tangentSquared + etaSquared) * normalizedEasting ** 3) / 6 +
      ((5 -
        2 * etaSquared +
        28 * tangentSquared -
        3 * etaSquared ** 2 +
        8 * secondEccentricitySquared +
        24 * tangentSquared ** 2) *
        normalizedEasting ** 5) /
        120) /
      cosFootprint;
  return {
    latitude: (latitude * 180) / Math.PI,
    longitude: (longitude * 180) / Math.PI,
  };
}

function dedupeWorldPoints(
  points: Array<{ x: number; z: number }>
): Array<{ x: number; z: number }> {
  const result: Array<{ x: number; z: number }> = [];
  for (const point of points) {
    if (![point.x, point.z].every(Number.isFinite)) {
      throw new Error("Flow Fest GNSS replay contains a non-finite point");
    }
    const previous = result.at(-1);
    if (
      !previous ||
      Math.hypot(point.x - previous.x, point.z - previous.z) > 0.01
    ) {
      result.push({ ...point });
    }
  }
  return result;
}

function insideFieldBounds(
  reference: FlowFestFieldReference,
  world: { x: number; z: number },
  accuracyMeters: number
): boolean {
  const bounds = reference.boundsWorldMeters;
  return (
    world.x >= bounds.minX - accuracyMeters &&
    world.x <= bounds.maxX + accuracyMeters &&
    world.z >= bounds.minZ - accuracyMeters &&
    world.z <= bounds.maxZ + accuracyMeters
  );
}

function assertReference(reference: FlowFestFieldReference): void {
  if (
    reference.projectedCrsCode !== 26916 ||
    ![
      reference.originEastingMeters,
      reference.originNorthingMeters,
      reference.boundsWorldMeters.minX,
      reference.boundsWorldMeters.maxX,
      reference.boundsWorldMeters.minZ,
      reference.boundsWorldMeters.maxZ,
    ].every(Number.isFinite)
  ) {
    throw new Error(
      "Flow Fest field reference must be the checked EPSG:26916 frame"
    );
  }
}

function assertCoordinates(point: {
  latitude: number;
  longitude: number;
}): void {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new Error("Flow Fest field coordinates must be valid WGS84 values");
  }
}

function validateFix(fix: FlowFestGnssFix): void {
  assertCoordinates(fix);
  if (
    !Number.isFinite(fix.accuracyMeters) ||
    fix.accuracyMeters <= 0 ||
    !Number.isFinite(fix.timestampMilliseconds)
  ) {
    throw new Error("Flow Fest GNSS fix has invalid accuracy or time");
  }
}
