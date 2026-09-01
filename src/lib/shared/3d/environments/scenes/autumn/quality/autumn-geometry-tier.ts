import {
  Color,
  InstancedMesh,
  Matrix4,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import type { AutumnQualityTier } from "./autumn-quality";

const SPATIAL_CELL_METERS = 48;
const MINIMUM_SPATIAL_INSTANCES = 8;

/** Repeated families broad enough for one global bound to defeat culling. */
export const AUTUMN_SPATIAL_BATCH_MATERIAL_PREFIXES = [
  "Autumn Hero B PBR",
  "Autumn Birch PBR",
  "Autumn Larch PBR",
  "Autumn Snag PBR",
  "Autumn Willow PBR",
  "Autumn Fern PBR",
  "Autumn Rounded Rock PBR",
  "Autumn Boulder PBR",
] as const;

export interface AutumnGeometryTierReport {
  tier: AutumnQualityTier;
  authoredTriangles: number;
  visibleTriangles: number;
  trimmedInstances: number;
  sourceBatches: number;
  spatialBatches: number;
}

interface SpatialBatchRecord {
  parent: Object3D;
  original: InstancedMesh;
  originalIndex: number;
  buckets: InstancedMesh[];
}

interface SpatialBatchState {
  authoredTriangles: number;
  records: SpatialBatchRecord[];
  frozenObjects: Array<{ object: Object3D; matrixAutoUpdate: boolean }>;
}

const spatialBatchStates = new WeakMap<Object3D, SpatialBatchState>();

function materialNames(material: Material | Material[]): string[] {
  const materials = Array.isArray(material) ? material : [material];
  return materials.map((candidate) => candidate.name);
}

function isSpatialBatchCandidate(mesh: InstancedMesh): boolean {
  if (mesh.count < MINIMUM_SPATIAL_INSTANCES || mesh.morphTexture) return false;
  const names = materialNames(mesh.material);
  return AUTUMN_SPATIAL_BATCH_MATERIAL_PREFIXES.some((prefix) =>
    names.some((name) => name.startsWith(prefix))
  );
}

function triangleCount(geometry: BufferGeometry): number {
  const elements = geometry.index?.count ?? geometry.attributes.position?.count;
  return elements ? elements / 3 : 0;
}

export function getAutumnRenderedTriangleCount(scene: Object3D): number {
  let total = 0;
  scene.traverse((child) => {
    const candidate = child as InstancedMesh;
    if (!candidate.isMesh) return;
    total +=
      triangleCount(candidate.geometry) *
      (candidate.isInstancedMesh ? candidate.count : 1);
  });
  return total;
}

function copyInstanceAppearance(
  source: InstancedMesh,
  sourceIndex: number,
  target: InstancedMesh,
  targetIndex: number,
  matrix: Matrix4,
  color: Color
): void {
  source.getMatrixAt(sourceIndex, matrix);
  target.setMatrixAt(targetIndex, matrix);
  if (source.instanceColor) {
    source.getColorAt(sourceIndex, color);
    target.setColorAt(targetIndex, color);
  }
}

function createSpatialBucket(
  source: InstancedMesh,
  indices: readonly number[],
  key: string
): InstancedMesh {
  const bucket = new InstancedMesh(
    source.geometry,
    source.material,
    indices.length
  );
  bucket.name = source.name;
  bucket.position.copy(source.position);
  bucket.quaternion.copy(source.quaternion);
  bucket.scale.copy(source.scale);
  bucket.matrix.copy(source.matrix);
  bucket.matrixAutoUpdate = source.matrixAutoUpdate;
  bucket.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
  bucket.visible = source.visible;
  bucket.castShadow = source.castShadow;
  bucket.receiveShadow = source.receiveShadow;
  bucket.renderOrder = source.renderOrder;
  bucket.layers.mask = source.layers.mask;
  bucket.frustumCulled = true;
  bucket.onBeforeRender = source.onBeforeRender;
  bucket.onAfterRender = source.onAfterRender;
  bucket.customDepthMaterial = source.customDepthMaterial;
  bucket.customDistanceMaterial = source.customDistanceMaterial;
  bucket.userData = {
    ...source.userData,
    autumnSpatialSource: source.uuid,
    autumnSpatialCell: key,
  };

  const matrix = new Matrix4();
  const color = new Color();
  indices.forEach((sourceIndex, targetIndex) =>
    copyInstanceAppearance(
      source,
      sourceIndex,
      bucket,
      targetIndex,
      matrix,
      color
    )
  );
  bucket.instanceMatrix.needsUpdate = true;
  if (bucket.instanceColor) bucket.instanceColor.needsUpdate = true;
  bucket.computeBoundingBox();
  bucket.computeBoundingSphere();
  return bucket;
}

function partitionSpatially(mesh: InstancedMesh): SpatialBatchRecord | null {
  const parent = mesh.parent;
  if (!parent) return null;

  const cells = new Map<string, number[]>();
  const matrix = new Matrix4();
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    const cellX = Math.floor(matrix.elements[12]! / SPATIAL_CELL_METERS);
    const cellZ = Math.floor(matrix.elements[14]! / SPATIAL_CELL_METERS);
    const key = `${cellX}_${cellZ}`;
    const indices = cells.get(key) ?? [];
    indices.push(index);
    cells.set(key, indices);
  }
  if (cells.size < 2) return null;

  const buckets = [...cells.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, indices]) => createSpatialBucket(mesh, indices, key));
  const originalIndex = parent.children.indexOf(mesh);
  parent.remove(mesh);
  buckets.forEach((bucket, offset) => {
    parent.add(bucket);
    const appendedIndex = parent.children.indexOf(bucket);
    parent.children.splice(appendedIndex, 1);
    parent.children.splice(originalIndex + offset, 0, bucket);
  });

  return { parent, original: mesh, originalIndex, buckets };
}

/**
 * Keeps every authored instance while replacing broad global instance bounds
 * with exact 48-metre culling cells. Quality tiers now choose no ecology by
 * deletion; the camera decides which unchanged spatial cells reach the GPU.
 */
export function applyAutumnGeometryTier(
  scene: Object3D,
  tier: AutumnQualityTier
): AutumnGeometryTierReport {
  let state = spatialBatchStates.get(scene);
  if (!state) {
    const authoredTriangles = getAutumnRenderedTriangleCount(scene);
    const candidates: InstancedMesh[] = [];
    const frozenObjects: Array<{
      object: Object3D;
      matrixAutoUpdate: boolean;
    }> = [];
    scene.traverse((child) => {
      if (child !== scene) {
        frozenObjects.push({
          object: child,
          matrixAutoUpdate: child.matrixAutoUpdate,
        });
        child.updateMatrix();
        child.matrixAutoUpdate = false;
      }
      const mesh = child as InstancedMesh;
      if (mesh.isInstancedMesh && isSpatialBatchCandidate(mesh)) {
        candidates.push(mesh);
      }
    });
    const records = candidates
      .map(partitionSpatially)
      .filter((record): record is SpatialBatchRecord => record !== null);
    state = { authoredTriangles, records, frozenObjects };
    spatialBatchStates.set(scene, state);
  }

  return {
    tier,
    authoredTriangles: state.authoredTriangles,
    visibleTriangles: state.authoredTriangles,
    trimmedInstances: 0,
    sourceBatches: state.records.length,
    spatialBatches: state.records.reduce(
      (total, record) => total + record.buckets.length,
      0
    ),
  };
}

export function restoreAutumnGeometryTier(scene: Object3D): void {
  const state = spatialBatchStates.get(scene);
  if (!state) return;
  for (const record of [...state.records].reverse()) {
    for (const bucket of record.buckets) {
      record.parent.remove(bucket);
      bucket.dispose();
    }
    record.parent.add(record.original);
    const appendedIndex = record.parent.children.indexOf(record.original);
    record.parent.children.splice(appendedIndex, 1);
    record.parent.children.splice(record.originalIndex, 0, record.original);
  }
  for (const { object, matrixAutoUpdate } of state.frozenObjects) {
    object.matrixAutoUpdate = matrixAutoUpdate;
  }
  spatialBatchStates.delete(scene);
}
