import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import {
  allFlowFestSegments,
  type FlowFestBranchId,
  type FlowFestRuntimeContract,
  type FlowFestRuntimePoint,
  type FlowFestRuntimeSegment,
  type FlowFestRuntimeZone,
} from "../flow-fest-graybox/flow-fest-runtime-contract";

export interface FlowFestCanopyEvidence {
  offsetsCentimeters: Uint16Array;
  width: number;
  height: number;
}

export interface FlowFestCanopyPeak {
  x: number;
  z: number;
  measuredHeightMeters: number;
  neighborhoodHighReturnRatio: number;
}

const CANOPY_MINIMUM_HEIGHT_CENTIMETERS = 600;
const HIGH_RETURN_CENTIMETERS = 400;
const LOCAL_MAXIMUM_RADIUS_SAMPLES = 2;
const MINIMUM_HIGH_RETURN_RATIO = 0.45;
const MINIMUM_PEAK_SPACING_METERS = 7.5;
const ROUTE_EDGE_CLEARANCE_METERS = 3.2;
const ZONE_EDGE_CLEARANCE_METERS = 3;

/**
 * Derive stable canopy candidates from the measured surface-return raster.
 *
 * These are intentionally called candidates, not surveyed tree trunks. A local
 * maximum plus a dense high-return neighborhood removes the old artificial
 * nine-metre planting grid while keeping the result tied to the LiDAR surface.
 */
export function deriveFlowFestCanopyPeaks(
  contract: FlowFestRuntimeContract,
  terrain: ImportedTerrainDataV2,
  canopy: FlowFestCanopyEvidence
): FlowFestCanopyPeak[] {
  const candidates: FlowFestCanopyPeak[] = [];
  const routes = uniqueFlowFestSurfaceSegments(contract);
  const bounds = contract.surfaceEvidenceProxy.activeBoundsWorldMeters;

  for (let z = Math.ceil(bounds.minZ); z <= Math.floor(bounds.maxZ); z += 1) {
    for (let x = Math.ceil(bounds.minX); x <= Math.floor(bounds.maxX); x += 1) {
      if (
        pointInRegisteredZone(x, z, contract.zones) ||
        pointNearRoutes(x, z, routes, ROUTE_EDGE_CLEARANCE_METERS)
      ) {
        continue;
      }
      const sample = worldToCanopySample(terrain, canopy, x, z);
      if (!sample) continue;
      const measured = canopy.offsetsCentimeters[sample.index];
      if (
        measured == null ||
        measured === 65535 ||
        measured < CANOPY_MINIMUM_HEIGHT_CENTIMETERS
      ) {
        continue;
      }

      let valid = 0;
      let highReturns = 0;
      let superseded = false;
      for (
        let dz = -LOCAL_MAXIMUM_RADIUS_SAMPLES;
        dz <= LOCAL_MAXIMUM_RADIUS_SAMPLES;
        dz += 1
      ) {
        const row = sample.row + dz;
        if (row < 0 || row >= canopy.height) continue;
        for (
          let dx = -LOCAL_MAXIMUM_RADIUS_SAMPLES;
          dx <= LOCAL_MAXIMUM_RADIUS_SAMPLES;
          dx += 1
        ) {
          const column = sample.column + dx;
          if (column < 0 || column >= canopy.width) continue;
          const value = canopy.offsetsCentimeters[row * canopy.width + column];
          if (value == null || value === 65535) continue;
          valid += 1;
          if (value >= HIGH_RETURN_CENTIMETERS) highReturns += 1;
          if (
            value > measured ||
            (value === measured && (dz < 0 || (dz === 0 && dx < 0)))
          ) {
            superseded = true;
          }
        }
      }
      if (superseded || valid === 0) continue;
      const neighborhoodHighReturnRatio = highReturns / valid;
      if (neighborhoodHighReturnRatio < MINIMUM_HIGH_RETURN_RATIO) continue;
      candidates.push({
        x,
        z,
        measuredHeightMeters: measured / 100,
        neighborhoodHighReturnRatio,
      });
    }
  }

  candidates.sort(
    (first, second) =>
      second.measuredHeightMeters - first.measuredHeightMeters ||
      first.z - second.z ||
      first.x - second.x
  );
  const retained: FlowFestCanopyPeak[] = [];
  for (const candidate of candidates) {
    if (
      retained.some(
        (peak) =>
          Math.hypot(peak.x - candidate.x, peak.z - candidate.z) <
          MINIMUM_PEAK_SPACING_METERS
      )
    ) {
      continue;
    }
    retained.push(candidate);
  }
  return retained;
}

/** De-duplicate shared/reversed branch legs without changing any source point. */
export function uniqueFlowFestSurfaceSegments(
  contract: FlowFestRuntimeContract
): FlowFestRuntimeSegment[] {
  const unique = new Map<string, FlowFestRuntimeSegment>();
  for (const segment of allFlowFestSegments(contract)) {
    const forward = pointSignature(segment.points);
    const reverse = pointSignature([...segment.points].reverse());
    const key = `${segment.mode}:${forward < reverse ? forward : reverse}`;
    if (!unique.has(key)) unique.set(key, segment);
  }
  return [...unique.values()];
}

/** Resolve the authored, untimed vehicle stage without substituting a camera. */
export function getFlowFestVehicleStagePoint(
  contract: FlowFestRuntimeContract,
  branch: FlowFestBranchId,
  endpoint: "unload" | "settled"
): FlowFestRuntimePoint | null {
  const vehicleSegments = contract.routes.arrivalBranches[
    branch
  ].segments.filter((segment) => segment.mode === "vehicle");
  const segment =
    endpoint === "unload"
      ? vehicleSegments[0]
      : vehicleSegments[vehicleSegments.length - 1];
  return segment?.points[segment.points.length - 1] ?? null;
}

function pointSignature(points: FlowFestRuntimePoint[]): string {
  return points.map((point) => `${point.x},${point.z}`).join(";");
}

function worldToCanopySample(
  terrain: ImportedTerrainDataV2,
  canopy: FlowFestCanopyEvidence,
  x: number,
  z: number
): { row: number; column: number; index: number } | null {
  const column = Math.round(
    ((x - terrain.worldBounds.minX) /
      (terrain.worldBounds.maxX - terrain.worldBounds.minX)) *
      (canopy.width - 1)
  );
  const row = Math.round(
    ((z - terrain.worldBounds.minZ) /
      (terrain.worldBounds.maxZ - terrain.worldBounds.minZ)) *
      (canopy.height - 1)
  );
  if (column < 0 || row < 0 || column >= canopy.width || row >= canopy.height) {
    return null;
  }
  return { row, column, index: row * canopy.width + column };
}

function pointInRegisteredZone(
  x: number,
  z: number,
  zones: FlowFestRuntimeZone[]
): boolean {
  return zones.some((zone) => {
    const radiusX = zone.radiusMeters ?? zone.searchRadiusXMeters ?? 0;
    const radiusZ = zone.radiusMeters ?? zone.searchRadiusZMeters ?? 0;
    if (radiusX <= 0 || radiusZ <= 0) return false;
    const normalizedX =
      (x - zone.center.x) / (radiusX + ZONE_EDGE_CLEARANCE_METERS);
    const normalizedZ =
      (z - zone.center.z) / (radiusZ + ZONE_EDGE_CLEARANCE_METERS);
    return normalizedX * normalizedX + normalizedZ * normalizedZ <= 1;
  });
}

function pointNearRoutes(
  x: number,
  z: number,
  routes: FlowFestRuntimeSegment[],
  extraClearanceMeters: number
): boolean {
  return routes.some((route) => {
    const clearance = route.widthMeters / 2 + extraClearanceMeters;
    for (let index = 1; index < route.points.length; index += 1) {
      if (
        distanceToSegment(
          x,
          z,
          route.points[index - 1]!,
          route.points[index]!
        ) <= clearance
      ) {
        return true;
      }
    }
    return false;
  });
}

function distanceToSegment(
  x: number,
  z: number,
  start: FlowFestRuntimePoint,
  end: FlowFestRuntimePoint
): number {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) return Math.hypot(x - start.x, z - start.z);
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((x - start.x) * deltaX + (z - start.z) * deltaZ) / lengthSquared
    )
  );
  return Math.hypot(
    x - (start.x + deltaX * progress),
    z - (start.z + deltaZ * progress)
  );
}
