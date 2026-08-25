import type { ImportedTerrainDataV2 } from "./real-terrain-zone";

export interface GeospatialTerrainManifestV2 {
  schemaVersion: 2;
  pipelineVersion: number;
  siteId: string;
  displayName: string;
  sourceLock: {
    path: string;
    sha256: string;
  };
  worldFrame: {
    units: "meter";
    metersPerUnit: 1;
    handedness: "right";
    axes: { x: "east"; y: "up"; z: "south" };
    projectedCrs: {
      authority: "EPSG";
      code: number;
      name: string;
      wkt: string;
    };
    requestedAnchorWgs84: { latitude: number; longitude: number };
    resolvedOriginWgs84: { latitude: number; longitude: number };
    originProjectedMeters: { easting: number; northing: number };
    vertical: {
      datum: string;
      originElevationMeters: number;
      scale: 1;
    };
  };
  terrain: {
    height: {
      path: string;
      productType: "DTM";
      encoding: "float32-le";
      layout: "row-major";
      rowOrder: "north-to-south";
      columnOrder: "west-to-east";
      width: number;
      height: number;
      sampleSpacingMeters: number;
      nativeGroundSampleDistanceMeters: number;
      resamplingKernel: "bilinear";
      minimumElevationMeters: number;
      maximumElevationMeters: number;
      reliefMeters: number;
      noDataSamples: 0;
      byteLength: number;
      sha256: string;
    };
    sampleBoundsWorldMeters: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    coverageBoundaryWorldMeters: Array<{ x: number; z: number }>;
  };
  surfaceEvidence: {
    path: string;
    encoding: "uint16-le-centimeters-above-dtm";
    noDataValue: 65535;
    width: number;
    height: number;
    byteLength: number;
    sha256: string;
    coverageRatio: number;
    maximumOffsetMeters: number;
    sampleSpacingMeters: number;
    sampleBoundsWorldMeters: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
  };
  orthophoto: {
    path: string;
    format: "webp";
    width: number;
    height: number;
    rowOrder: "north-to-south";
    columnOrder: "west-to-east";
    sourceYear: number;
    sourceAcquisitionDateUnixMilliseconds: number;
    sourceResolutionMeters: number;
    runtimePixelSizeMeters: number;
    projectedCrs: { authority: "EPSG"; code: number };
    sampleBoundsWorldMeters: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    byteLength: number;
    sha256: string;
  };
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type TerrainFetch = (path: string) => Promise<FetchResponse>;

export interface GeospatialEvidenceLayers {
  surfaceOffsetsCentimeters: Uint16Array;
  orthophotoBytes: ArrayBuffer;
}

/**
 * Load one checked geospatial package. A missing or altered height field is a
 * visible loading error; falling back to procedural terrain would let players
 * author landmarks against the wrong Earth without realizing it.
 */
export async function loadGeospatialTerrain(
  manifestPath: string,
  request: TerrainFetch = fetch
): Promise<ImportedTerrainDataV2> {
  const manifestResponse = await request(manifestPath);
  if (!manifestResponse.ok) {
    throw new Error(
      `Flow Fest terrain manifest failed to load (${manifestResponse.status})`
    );
  }
  const manifest = parseGeospatialTerrainManifest(
    await manifestResponse.json()
  );
  const heightResponse = await request(manifest.terrain.height.path);
  if (!heightResponse.ok) {
    throw new Error(
      `Flow Fest height field failed to load (${heightResponse.status})`
    );
  }
  const bytes = await heightResponse.arrayBuffer();
  const expectedBytes = manifest.terrain.height.byteLength;
  if (bytes.byteLength !== expectedBytes) {
    throw new Error(
      `Flow Fest height field has ${bytes.byteLength} bytes; expected ${expectedBytes}`
    );
  }
  const digest = await sha256Hex(bytes);
  if (digest !== manifest.terrain.height.sha256) {
    throw new Error(
      `Flow Fest height field checksum mismatch: expected ${manifest.terrain.height.sha256}, got ${digest}`
    );
  }

  const values = readFloat32LittleEndian(bytes);
  validateHeightValues(values, manifest);
  const bounds = manifest.terrain.sampleBoundsWorldMeters;

  return {
    version: 2,
    name: manifest.displayName,
    sourceManifestPath: manifestPath,
    worldBounds: { ...bounds },
    heightmap: {
      width: manifest.terrain.height.width,
      height: manifest.terrain.height.height,
      minElevation: manifest.terrain.height.minimumElevationMeters,
      maxElevation: manifest.terrain.height.maximumElevationMeters,
      verticalOriginMeters: manifest.worldFrame.vertical.originElevationMeters,
      verticalScale: 1,
      heights: values,
    },
    boundary: manifest.terrain.coverageBoundaryWorldMeters.map((point) => ({
      worldX: point.x,
      worldZ: point.z,
    })),
    geoReference: {
      projectedCrs: {
        authority: "EPSG",
        code: manifest.worldFrame.projectedCrs.code,
        name: manifest.worldFrame.projectedCrs.name,
      },
      requestedAnchorWgs84: { ...manifest.worldFrame.requestedAnchorWgs84 },
      resolvedOriginWgs84: { ...manifest.worldFrame.resolvedOriginWgs84 },
      originProjectedMeters: { ...manifest.worldFrame.originProjectedMeters },
      axes: { ...manifest.worldFrame.axes },
      verticalDatum: manifest.worldFrame.vertical.datum,
    },
  };
}

/**
 * Load the optional reconstruction/reference layers only for tools that need
 * them. Ordinary terrain play does not pay their transfer cost.
 */
export async function loadGeospatialEvidenceLayers(
  manifest: GeospatialTerrainManifestV2,
  request: TerrainFetch = fetch
): Promise<GeospatialEvidenceLayers> {
  const surfaceBytes = await loadCheckedAsset(
    manifest.surfaceEvidence.path,
    manifest.surfaceEvidence.byteLength,
    manifest.surfaceEvidence.sha256,
    "surface evidence",
    request
  );
  const orthophotoBytes = await loadCheckedAsset(
    manifest.orthophoto.path,
    manifest.orthophoto.byteLength,
    manifest.orthophoto.sha256,
    "orthophoto",
    request
  );
  const surfaceOffsetsCentimeters = new Uint16Array(
    surfaceBytes.byteLength / Uint16Array.BYTES_PER_ELEMENT
  );
  const view = new DataView(surfaceBytes);
  for (let index = 0; index < surfaceOffsetsCentimeters.length; index += 1) {
    surfaceOffsetsCentimeters[index] = view.getUint16(
      index * Uint16Array.BYTES_PER_ELEMENT,
      true
    );
  }
  return { surfaceOffsetsCentimeters, orthophotoBytes };
}

async function loadCheckedAsset(
  path: string,
  expectedBytes: number,
  expectedSha256: string,
  label: string,
  request: TerrainFetch
): Promise<ArrayBuffer> {
  const response = await request(path);
  if (!response.ok) {
    throw new Error(`Flow Fest ${label} failed to load (${response.status})`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== expectedBytes) {
    throw new Error(
      `Flow Fest ${label} has ${bytes.byteLength} bytes; expected ${expectedBytes}`
    );
  }
  const digest = await sha256Hex(bytes);
  if (digest !== expectedSha256) {
    throw new Error(
      `Flow Fest ${label} checksum mismatch: expected ${expectedSha256}, got ${digest}`
    );
  }
  return bytes;
}

export function parseGeospatialTerrainManifest(
  value: unknown
): GeospatialTerrainManifestV2 {
  const manifest = expectRecord(value, "manifest");
  expectEqual(manifest.schemaVersion, 2, "manifest.schemaVersion");
  expectPositiveInteger(manifest.pipelineVersion, "manifest.pipelineVersion");
  expectNonEmptyString(manifest.siteId, "manifest.siteId");
  expectNonEmptyString(manifest.displayName, "manifest.displayName");

  const sourceLock = expectRecord(manifest.sourceLock, "manifest.sourceLock");
  expectNonEmptyString(sourceLock.path, "manifest.sourceLock.path");
  expectSha256(sourceLock.sha256, "manifest.sourceLock.sha256");

  const worldFrame = expectRecord(manifest.worldFrame, "manifest.worldFrame");
  expectEqual(worldFrame.units, "meter", "manifest.worldFrame.units");
  expectEqual(worldFrame.metersPerUnit, 1, "manifest.worldFrame.metersPerUnit");
  expectEqual(worldFrame.handedness, "right", "manifest.worldFrame.handedness");
  const axes = expectRecord(worldFrame.axes, "manifest.worldFrame.axes");
  expectEqual(axes.x, "east", "manifest.worldFrame.axes.x");
  expectEqual(axes.y, "up", "manifest.worldFrame.axes.y");
  expectEqual(axes.z, "south", "manifest.worldFrame.axes.z");

  const projectedCrs = expectRecord(
    worldFrame.projectedCrs,
    "manifest.worldFrame.projectedCrs"
  );
  expectEqual(
    projectedCrs.authority,
    "EPSG",
    "manifest.worldFrame.projectedCrs.authority"
  );
  expectPositiveInteger(
    projectedCrs.code,
    "manifest.worldFrame.projectedCrs.code"
  );
  expectNonEmptyString(
    projectedCrs.name,
    "manifest.worldFrame.projectedCrs.name"
  );
  expectNonEmptyString(
    projectedCrs.wkt,
    "manifest.worldFrame.projectedCrs.wkt"
  );
  validateCoordinates(
    worldFrame.requestedAnchorWgs84,
    "manifest.worldFrame.requestedAnchorWgs84"
  );
  validateCoordinates(
    worldFrame.resolvedOriginWgs84,
    "manifest.worldFrame.resolvedOriginWgs84"
  );
  validateProjectedOrigin(
    worldFrame.originProjectedMeters,
    "manifest.worldFrame.originProjectedMeters"
  );
  const vertical = expectRecord(
    worldFrame.vertical,
    "manifest.worldFrame.vertical"
  );
  expectNonEmptyString(vertical.datum, "manifest.worldFrame.vertical.datum");
  expectFiniteNumber(
    vertical.originElevationMeters,
    "manifest.worldFrame.vertical.originElevationMeters"
  );
  expectEqual(vertical.scale, 1, "manifest.worldFrame.vertical.scale");

  const terrain = expectRecord(manifest.terrain, "manifest.terrain");
  const height = expectRecord(terrain.height, "manifest.terrain.height");
  const heightPath = expectNonEmptyString(
    height.path,
    "manifest.terrain.height.path"
  );
  validateStaticDataPath(heightPath, "manifest.terrain.height.path");
  expectEqual(
    height.encoding,
    "float32-le",
    "manifest.terrain.height.encoding"
  );
  expectEqual(height.productType, "DTM", "manifest.terrain.height.productType");
  expectEqual(height.layout, "row-major", "manifest.terrain.height.layout");
  expectEqual(
    height.rowOrder,
    "north-to-south",
    "manifest.terrain.height.rowOrder"
  );
  expectEqual(
    height.columnOrder,
    "west-to-east",
    "manifest.terrain.height.columnOrder"
  );
  const width = expectPositiveInteger(
    height.width,
    "manifest.terrain.height.width"
  );
  const heightCount = expectPositiveInteger(
    height.height,
    "manifest.terrain.height.height"
  );
  const spacing = expectPositiveNumber(
    height.sampleSpacingMeters,
    "manifest.terrain.height.sampleSpacingMeters"
  );
  const nativeGroundSampleDistance = expectPositiveNumber(
    height.nativeGroundSampleDistanceMeters,
    "manifest.terrain.height.nativeGroundSampleDistanceMeters"
  );
  if (spacing < nativeGroundSampleDistance) {
    throw new Error(
      "manifest terrain grid overstates its native ground resolution"
    );
  }
  expectEqual(
    height.resamplingKernel,
    "bilinear",
    "manifest.terrain.height.resamplingKernel"
  );
  const minimum = expectFiniteNumber(
    height.minimumElevationMeters,
    "manifest.terrain.height.minimumElevationMeters"
  );
  const maximum = expectFiniteNumber(
    height.maximumElevationMeters,
    "manifest.terrain.height.maximumElevationMeters"
  );
  if (maximum <= minimum) {
    throw new Error("manifest terrain maximum must exceed minimum");
  }
  const relief = expectPositiveNumber(
    height.reliefMeters,
    "manifest.terrain.height.reliefMeters"
  );
  if (Math.abs(relief - (maximum - minimum)) > 1e-5) {
    throw new Error("manifest terrain relief disagrees with min/max");
  }
  expectEqual(height.noDataSamples, 0, "manifest.terrain.height.noDataSamples");
  const byteLength = expectPositiveInteger(
    height.byteLength,
    "manifest.terrain.height.byteLength"
  );
  if (byteLength !== width * heightCount * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error(
      "manifest terrain byte length disagrees with grid dimensions"
    );
  }
  expectSha256(height.sha256, "manifest.terrain.height.sha256");

  const bounds = validateBounds(
    terrain.sampleBoundsWorldMeters,
    "manifest.terrain.sampleBoundsWorldMeters"
  );
  const expectedWidth = (width - 1) * spacing;
  const expectedDepth = (heightCount - 1) * spacing;
  if (
    Math.abs(bounds.maxX - bounds.minX - expectedWidth) > 1e-6 ||
    Math.abs(bounds.maxZ - bounds.minZ - expectedDepth) > 1e-6
  ) {
    throw new Error(
      "manifest terrain bounds disagree with sample spacing and dimensions"
    );
  }
  if (
    Math.max(
      Math.abs(bounds.minX),
      Math.abs(bounds.maxX),
      Math.abs(bounds.minZ),
      Math.abs(bounds.maxZ)
    ) > 8_000
  ) {
    throw new Error(
      "manifest terrain exceeds the local float32 safety envelope"
    );
  }
  validateBoundary(terrain.coverageBoundaryWorldMeters, bounds);

  const surface = expectRecord(
    manifest.surfaceEvidence,
    "manifest.surfaceEvidence"
  );
  validateStaticDataPath(
    expectNonEmptyString(surface.path, "manifest.surfaceEvidence.path"),
    "manifest.surfaceEvidence.path"
  );
  expectEqual(
    surface.encoding,
    "uint16-le-centimeters-above-dtm",
    "manifest.surfaceEvidence.encoding"
  );
  expectEqual(
    surface.noDataValue,
    65535,
    "manifest.surfaceEvidence.noDataValue"
  );
  expectEqual(surface.width, width, "manifest.surfaceEvidence.width");
  expectEqual(surface.height, heightCount, "manifest.surfaceEvidence.height");
  expectEqual(
    surface.byteLength,
    width * heightCount * Uint16Array.BYTES_PER_ELEMENT,
    "manifest.surfaceEvidence.byteLength"
  );
  expectSha256(surface.sha256, "manifest.surfaceEvidence.sha256");
  const coverageRatio = expectFiniteNumber(
    surface.coverageRatio,
    "manifest.surfaceEvidence.coverageRatio"
  );
  if (coverageRatio < 0 || coverageRatio > 1) {
    throw new Error("manifest.surfaceEvidence.coverageRatio must be 0-1");
  }
  expectNonNegativeNumber(
    surface.maximumOffsetMeters,
    "manifest.surfaceEvidence.maximumOffsetMeters"
  );
  expectEqual(
    surface.sampleSpacingMeters,
    spacing,
    "manifest.surfaceEvidence.sampleSpacingMeters"
  );
  const surfaceBounds = validateBounds(
    surface.sampleBoundsWorldMeters,
    "manifest.surfaceEvidence.sampleBoundsWorldMeters"
  );
  expectSameBounds(surfaceBounds, bounds, "surface evidence");

  const orthophoto = expectRecord(manifest.orthophoto, "manifest.orthophoto");
  validateStaticDataPath(
    expectNonEmptyString(orthophoto.path, "manifest.orthophoto.path"),
    "manifest.orthophoto.path"
  );
  expectEqual(orthophoto.format, "webp", "manifest.orthophoto.format");
  const orthoWidth = expectPositiveInteger(
    orthophoto.width,
    "manifest.orthophoto.width"
  );
  const orthoHeight = expectPositiveInteger(
    orthophoto.height,
    "manifest.orthophoto.height"
  );
  expectEqual(
    orthophoto.rowOrder,
    "north-to-south",
    "manifest.orthophoto.rowOrder"
  );
  expectEqual(
    orthophoto.columnOrder,
    "west-to-east",
    "manifest.orthophoto.columnOrder"
  );
  expectPositiveInteger(
    orthophoto.sourceYear,
    "manifest.orthophoto.sourceYear"
  );
  expectFiniteNumber(
    orthophoto.sourceAcquisitionDateUnixMilliseconds,
    "manifest.orthophoto.sourceAcquisitionDateUnixMilliseconds"
  );
  expectPositiveNumber(
    orthophoto.sourceResolutionMeters,
    "manifest.orthophoto.sourceResolutionMeters"
  );
  const runtimePixelSize = expectPositiveNumber(
    orthophoto.runtimePixelSizeMeters,
    "manifest.orthophoto.runtimePixelSizeMeters"
  );
  const orthoCrs = expectRecord(
    orthophoto.projectedCrs,
    "manifest.orthophoto.projectedCrs"
  );
  expectEqual(
    orthoCrs.authority,
    "EPSG",
    "manifest.orthophoto.projectedCrs.authority"
  );
  expectEqual(
    orthoCrs.code,
    projectedCrs.code,
    "manifest.orthophoto.projectedCrs.code"
  );
  const orthoBounds = validateBounds(
    orthophoto.sampleBoundsWorldMeters,
    "manifest.orthophoto.sampleBoundsWorldMeters"
  );
  expectSameBounds(orthoBounds, bounds, "orthophoto");
  if (
    Math.abs(runtimePixelSize * orthoWidth - (bounds.maxX - bounds.minX)) >
      1e-6 ||
    Math.abs(runtimePixelSize * orthoHeight - (bounds.maxZ - bounds.minZ)) >
      1e-6
  ) {
    throw new Error(
      "manifest orthophoto dimensions disagree with terrain bounds"
    );
  }
  expectPositiveInteger(
    orthophoto.byteLength,
    "manifest.orthophoto.byteLength"
  );
  expectSha256(orthophoto.sha256, "manifest.orthophoto.sha256");

  return value as GeospatialTerrainManifestV2;
}

export function projectedMetersToWorld(
  manifest: GeospatialTerrainManifestV2,
  projected: { easting: number; northing: number; elevationMeters: number }
): { x: number; y: number; z: number } {
  const origin = manifest.worldFrame.originProjectedMeters;
  return {
    x: projected.easting - origin.easting,
    y:
      projected.elevationMeters -
      manifest.worldFrame.vertical.originElevationMeters,
    z: origin.northing - projected.northing,
  };
}

export function worldToProjectedMeters(
  manifest: GeospatialTerrainManifestV2,
  world: { x: number; y: number; z: number }
): { easting: number; northing: number; elevationMeters: number } {
  const origin = manifest.worldFrame.originProjectedMeters;
  return {
    easting: origin.easting + world.x,
    northing: origin.northing - world.z,
    elevationMeters:
      manifest.worldFrame.vertical.originElevationMeters + world.y,
  };
}

function readFloat32LittleEndian(bytes: ArrayBuffer): Float32Array {
  const count = bytes.byteLength / Float32Array.BYTES_PER_ELEMENT;
  const values = new Float32Array(count);
  const view = new DataView(bytes);
  for (let index = 0; index < count; index += 1) {
    values[index] = view.getFloat32(
      index * Float32Array.BYTES_PER_ELEMENT,
      true
    );
  }
  return values;
}

function validateHeightValues(
  values: Float32Array,
  manifest: GeospatialTerrainManifestV2
): void {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error(
        "Flow Fest height field contains a missing or non-finite sample"
      );
    }
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const expected = manifest.terrain.height;
  if (
    Math.abs(minimum - expected.minimumElevationMeters) > 1e-5 ||
    Math.abs(maximum - expected.maximumElevationMeters) > 1e-5
  ) {
    throw new Error(
      "Flow Fest height field statistics disagree with its manifest"
    );
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "This runtime cannot verify the Flow Fest terrain checksum"
    );
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectEqual<T>(
  value: unknown,
  expected: T,
  path: string
): asserts value is T {
  if (value !== expected) {
    throw new Error(`${path} must equal ${String(expected)}`);
  }
}

function expectNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function expectFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function expectPositiveNumber(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (number <= 0) throw new Error(`${path} must be positive`);
  return number;
}

function expectNonNegativeNumber(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (number < 0) throw new Error(`${path} must be non-negative`);
  return number;
}

function expectPositiveInteger(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${path} must be a positive integer`);
  }
  return number;
}

function expectSha256(value: unknown, path: string): string {
  const digest = expectNonEmptyString(value, path);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${path} must be a lowercase SHA-256 digest`);
  }
  return digest;
}

function validateCoordinates(value: unknown, path: string): void {
  const coordinates = expectRecord(value, path);
  const latitude = expectFiniteNumber(coordinates.latitude, `${path}.latitude`);
  const longitude = expectFiniteNumber(
    coordinates.longitude,
    `${path}.longitude`
  );
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`${path} is outside WGS84 latitude/longitude limits`);
  }
}

function validateProjectedOrigin(value: unknown, path: string): void {
  const origin = expectRecord(value, path);
  expectFiniteNumber(origin.easting, `${path}.easting`);
  expectFiniteNumber(origin.northing, `${path}.northing`);
}

function validateStaticDataPath(value: string, path: string): void {
  if (!value.startsWith("/data/") || value.includes("..")) {
    throw new Error(`${path} must be a checked static data path`);
  }
}

function validateBounds(
  value: unknown,
  path: string
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const bounds = expectRecord(value, path);
  const result = {
    minX: expectFiniteNumber(bounds.minX, `${path}.minX`),
    maxX: expectFiniteNumber(bounds.maxX, `${path}.maxX`),
    minZ: expectFiniteNumber(bounds.minZ, `${path}.minZ`),
    maxZ: expectFiniteNumber(bounds.maxZ, `${path}.maxZ`),
  };
  if (result.maxX <= result.minX || result.maxZ <= result.minZ) {
    throw new Error(`${path} must have positive width and depth`);
  }
  return result;
}

function expectSameBounds(
  actual: { minX: number; maxX: number; minZ: number; maxZ: number },
  expected: { minX: number; maxX: number; minZ: number; maxZ: number },
  label: string
): void {
  if (
    actual.minX !== expected.minX ||
    actual.maxX !== expected.maxX ||
    actual.minZ !== expected.minZ ||
    actual.maxZ !== expected.maxZ
  ) {
    throw new Error(`manifest ${label} bounds disagree with terrain bounds`);
  }
}

function validateBoundary(
  value: unknown,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): void {
  if (!Array.isArray(value) || value.length < 3) {
    throw new Error(
      "manifest terrain coverage needs at least three boundary points"
    );
  }
  for (const [index, pointValue] of value.entries()) {
    const point = expectRecord(
      pointValue,
      `manifest.terrain.coverageBoundaryWorldMeters[${index}]`
    );
    const x = expectFiniteNumber(point.x, `coverage boundary ${index}.x`);
    const z = expectFiniteNumber(point.z, `coverage boundary ${index}.z`);
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ
    ) {
      throw new Error(
        `coverage boundary point ${index} is outside terrain bounds`
      );
    }
  }
}
