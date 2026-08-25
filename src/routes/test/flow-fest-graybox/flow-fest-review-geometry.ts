import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import {
  allFlowFestSegments,
  type FlowFestBranchId,
  type FlowFestRuntimeContract,
  type FlowFestRuntimePoint,
  type FlowFestRuntimeSegment,
} from "./flow-fest-runtime-contract";
import { sampleFlowFestTerrainWorldY } from "./flow-fest-terrain-host";

export interface FlowFestBarrierGeometry {
  mesh: Mesh;
  vertices: Float32Array;
  indices: Uint32Array;
  proxyCount: number;
  verticesPerProxy: number;
}

const BRANCH_COLOR: Record<FlowFestBranchId, string> = {
  "lower-tent": "#ffb45b",
  "upper-tent": "#b69cff",
  "car-camp": "#69df9d",
};

/**
 * Build the legibility layer from the canonical Gate 2 contract. Nothing in
 * this group collides; it explains the routes and evidence classes without
 * becoming a second description of the ground.
 */
export function buildFlowFestReviewOverlay(
  contract: FlowFestRuntimeContract,
  terrain: ImportedTerrainDataV2,
  selectedBranch: FlowFestBranchId
): Group {
  const root = new Group();
  root.name = "FFS_ReviewOverlay";

  for (const branchId of Object.keys(
    contract.routes.arrivalBranches
  ) as FlowFestBranchId[]) {
    const branch = contract.routes.arrivalBranches[branchId];
    const segments = [
      ...branch.segments,
      contract.routes.nightReturnBranches[branchId],
    ];
    for (const segment of segments) {
      const geometry = buildRibbonGeometry(terrain, segment);
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color: BRANCH_COLOR[branchId],
          transparent: true,
          opacity: branchId === selectedBranch ? 0.92 : 0.28,
          depthWrite: false,
          side: DoubleSide,
        })
      );
      mesh.name = `FFS_Route_${branchId}_${segment.id}`;
      mesh.renderOrder = branchId === selectedBranch ? 4 : 2;
      root.add(mesh);
    }
  }

  for (const zone of contract.zones) {
    const radiusX = zone.radiusMeters ?? zone.searchRadiusXMeters ?? 8;
    const radiusZ = zone.radiusMeters ?? zone.searchRadiusZMeters ?? radiusX;
    const points: FlowFestRuntimePoint[] = [];
    for (let index = 0; index <= 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      const x = zone.center.x + Math.cos(angle) * radiusX;
      const z = zone.center.z + Math.sin(angle) * radiusZ;
      points.push({
        x,
        z,
        sourceTerrainY: sampleFlowFestTerrainWorldY(terrain, x, z),
        reviewTerrainY: 0,
      });
    }
    const ring = new Mesh(
      buildRibbonGeometry(terrain, {
        id: zone.id,
        mode: "person",
        widthMeters: 0.55,
        lengthMeters: 0,
        sourceClasses: [zone.class],
        pathClass: zone.shape,
        points,
      }),
      new MeshBasicMaterial({
        color: zone.id === "middle-earth-zone" ? "#62d8de" : "#fff4c7",
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
        side: DoubleSide,
      })
    );
    ring.name = `FFS_Zone_${zone.id}`;
    ring.renderOrder = 5;
    root.add(ring);
  }

  for (const anchor of contract.anchors) {
    const geometry = new ConeGeometry(0.85, 2.8, 8);
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color:
          anchor.id === "car-camp"
            ? BRANCH_COLOR["car-camp"]
            : anchor.id === "upper-tent"
              ? BRANCH_COLOR["upper-tent"]
              : BRANCH_COLOR["lower-tent"],
        roughness: 0.78,
      })
    );
    mesh.name = `FFS_Anchor_${anchor.id}`;
    mesh.position.set(
      anchor.positionWorld[0],
      sampleFlowFestTerrainWorldY(
        terrain,
        anchor.positionWorld[0],
        anchor.positionWorld[2]
      ) + 1.55,
      anchor.positionWorld[2]
    );
    root.add(mesh);
  }

  return root;
}

/**
 * Build visible gameplay topology from measured above-ground returns.
 *
 * The output deliberately does not call these boxes trees or buildings. The
 * source proves that something rises above the DTM, and Austen's traces prove
 * where the two corridors pass through that surface mass. We carve every
 * approved person route, merge the remaining proxies into one visible mesh,
 * and hand these exact arrays to Rapier as one trimesh.
 */
export function buildFlowFestLidarBarrierGeometry(
  contract: FlowFestRuntimeContract,
  terrain: ImportedTerrainDataV2,
  surfaceOffsetsCentimeters: Uint16Array
): FlowFestBarrierGeometry {
  const width = terrain.heightmap.width;
  const height = terrain.heightmap.height;
  if (surfaceOffsetsCentimeters.length !== width * height) {
    throw new Error("Flow Fest lidar surface dimensions do not match the DTM");
  }
  const proxy = contract.surfaceEvidenceProxy;
  const stride = proxy.strideSamples;
  const footprint = Math.max(4, stride * 0.82);
  const routes = allFlowFestSegments(contract).filter(
    (segment) => segment.mode === "person"
  );
  const positions: number[] = [];
  const indices: number[] = [];
  let proxyCount = 0;

  for (let row = 0; row < height; row += stride) {
    const z = terrain.worldBounds.minZ + row;
    if (
      z < proxy.activeBoundsWorldMeters.minZ ||
      z > proxy.activeBoundsWorldMeters.maxZ
    ) {
      continue;
    }
    for (let column = 0; column < width; column += stride) {
      const x = terrain.worldBounds.minX + column;
      if (
        x < proxy.activeBoundsWorldMeters.minX ||
        x > proxy.activeBoundsWorldMeters.maxX
      ) {
        continue;
      }
      const encoded = surfaceOffsetsCentimeters[row * width + column];
      if (encoded == null || encoded === 65535) continue;
      const measuredHeight = encoded / 100;
      if (measuredHeight < proxy.thresholdMetersAboveDtm) continue;
      if (routeCarvesProxy(x, z, footprint, routes)) continue;

      const groundY = sampleFlowFestTerrainWorldY(terrain, x, z);
      const proxyHeight = Math.min(18, Math.max(4, measuredHeight));
      appendCanopyMass(
        positions,
        indices,
        x,
        groundY,
        z,
        footprint,
        proxyHeight
      );
      proxyCount += 1;
    }
  }

  const vertices = new Float32Array(positions);
  const triangleIndices = new Uint32Array(indices);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setIndex(new BufferAttribute(triangleIndices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: "#36533c",
      roughness: 1,
      transparent: true,
      opacity: 0.78,
      side: DoubleSide,
    })
  );
  mesh.name = "FFS_Barrier_LidarProxy_Merged";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return {
    mesh,
    vertices,
    indices: triangleIndices,
    proxyCount,
    verticesPerProxy: 26,
  };
}

function buildRibbonGeometry(
  terrain: ImportedTerrainDataV2,
  segment: FlowFestRuntimeSegment
): BufferGeometry {
  const samples: Array<{ x: number; z: number }> = [];
  const first = segment.points[0];
  if (first) samples.push({ x: first.x, z: first.z });
  for (
    let pointIndex = 1;
    pointIndex < segment.points.length;
    pointIndex += 1
  ) {
    const start = segment.points[pointIndex - 1]!;
    const end = segment.points[pointIndex]!;
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    const steps = Math.max(1, Math.ceil(distance / 2));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      samples.push({
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
      });
    }
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const halfWidth = segment.widthMeters / 2;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index]!;
    const previous = samples[Math.max(0, index - 1)]!;
    const next = samples[Math.min(samples.length - 1, index + 1)]!;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const distance = Math.hypot(dx, dz);
    const normalX = distance > 0 ? -dz / distance : 0;
    const normalZ = distance > 0 ? dx / distance : 0;
    const y = sampleFlowFestTerrainWorldY(terrain, point.x, point.z) + 0.12;
    positions.push(
      point.x + normalX * halfWidth,
      y,
      point.z + normalZ * halfWidth,
      point.x - normalX * halfWidth,
      y,
      point.z - normalZ * halfWidth
    );
    if (index > 0) {
      const previousLeft = (index - 1) * 2;
      const previousRight = previousLeft + 1;
      const left = index * 2;
      const right = left + 1;
      indices.push(
        previousLeft,
        previousRight,
        left,
        left,
        previousRight,
        right
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();
  return geometry;
}

function routeCarvesProxy(
  x: number,
  z: number,
  footprint: number,
  routes: FlowFestRuntimeSegment[]
): boolean {
  for (const route of routes) {
    const clearance = route.widthMeters / 2 + footprint * 0.78;
    for (let index = 1; index < route.points.length; index += 1) {
      const start = route.points[index - 1]!;
      const end = route.points[index]!;
      if (
        distanceToSegment(x, z, start.x, start.z, end.x, end.z) <= clearance
      ) {
        return true;
      }
    }
  }
  return false;
}

function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(px - ax, pz - az);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared)
  );
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function appendCanopyMass(
  positions: number[],
  indices: number[],
  centerX: number,
  baseY: number,
  centerZ: number,
  footprint: number,
  height: number
): void {
  const base = positions.length / 3;
  const sides = 8;
  const rotation =
    ((((Math.round(centerX) * 73856093) ^ (Math.round(centerZ) * 19349663)) >>>
      0) %
      360) *
    (Math.PI / 180);
  const rings = [
    { y: baseY, radius: footprint * 0.32 },
    { y: baseY + height * 0.32, radius: footprint * 0.58 },
    { y: baseY + height * 0.78, radius: footprint * 0.52 },
  ];

  // Ground centre, three octagonal rings, crown point: 26 vertices. The broad
  // middle keeps collision honest while the silhouette reads as measured
  // above-ground mass instead of an invented building.
  positions.push(centerX, baseY, centerZ);
  for (const ring of rings) {
    for (let side = 0; side < sides; side += 1) {
      const angle = rotation + (side / sides) * Math.PI * 2;
      positions.push(
        centerX + Math.cos(angle) * ring.radius,
        ring.y,
        centerZ + Math.sin(angle) * ring.radius
      );
    }
  }
  const crown = base + 25;
  positions.push(centerX, baseY + height, centerZ);

  const lower = base + 1;
  const middle = lower + sides;
  const upper = middle + sides;
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(base, lower + next, lower + side);
    indices.push(
      lower + side,
      lower + next,
      middle + side,
      lower + next,
      middle + next,
      middle + side
    );
    indices.push(
      middle + side,
      middle + next,
      upper + side,
      middle + next,
      upper + next,
      upper + side
    );
    indices.push(upper + side, upper + next, crown);
  }
}
