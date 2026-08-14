import {
  Color,
  Frustum,
  Matrix4,
  Sphere,
  type Camera,
  type InstancedMesh,
  type Object3D,
} from "three";

export interface FloraCullingOptions {
  /** Leave genuinely cheap batches whole so culling does not add buffer churn. */
  minRenderedVerticesPerBatch?: number;
  /** Extra world-space radius for vertex sway and edge-of-frame stability. */
  boundsPadding?: number;
}

export interface FloraCullingStats {
  sourceBatches: number;
  culledBatches: number;
  instances: number;
  estimatedVerticesCovered: number;
  visibleInstances: number;
  estimatedSubmittedVertices: number;
}

export interface AuthoredFloraCuller {
  readonly stats: FloraCullingStats;
  update(camera: Camera): FloraCullingStats;
  restore(): void;
}

interface CulledBatch {
  mesh: InstancedMesh;
  matrices: Matrix4[];
  colors: Color[] | null;
  localSphere: Sphere;
  visibleIndices: number[];
  visibleScratch: number[];
  verticesPerInstance: number;
  originalFrustumCulled: boolean;
}

const DEFAULT_MIN_RENDERED_VERTICES_PER_BATCH = 50_000;
const DEFAULT_BOUNDS_PADDING = 0.3;

function renderedVerticesPerInstance(mesh: InstancedMesh): number {
  return mesh.geometry.index?.count
    ?? mesh.geometry.getAttribute("position")?.count
    ?? 0;
}

function sameIndices(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Keep each authored geometry/material batch intact while compacting its draw
 * range to the instances that intersect the camera frustum. Three.js normally
 * culls an InstancedMesh as one reef-wide object; this adds the missing
 * instance-level visibility pass without increasing draw calls.
 */
export function createAuthoredFloraCuller(
  scene: Object3D,
  options: FloraCullingOptions = {}
): AuthoredFloraCuller {
  const minRenderedVerticesPerBatch = options.minRenderedVerticesPerBatch
    ?? DEFAULT_MIN_RENDERED_VERTICES_PER_BATCH;
  const boundsPadding = options.boundsPadding ?? DEFAULT_BOUNDS_PADDING;
  const batches: CulledBatch[] = [];
  let sourceBatches = 0;

  scene.updateWorldMatrix(true, true);
  scene.traverse((object) => {
    const mesh = object as InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    sourceBatches += 1;

    const verticesPerInstance = renderedVerticesPerInstance(mesh);
    const renderedVerticesPerBatch = verticesPerInstance * mesh.count;
    if (
      mesh.count < 2
      || mesh.morphTexture
      || renderedVerticesPerBatch < minRenderedVerticesPerBatch
    ) {
      return;
    }

    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const geometrySphere = mesh.geometry.boundingSphere;
    if (!geometrySphere) return;

    const matrix = new Matrix4();
    const color = new Color();
    const matrices: Matrix4[] = [];
    const colors = mesh.instanceColor ? [] as Color[] : null;
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrices.push(matrix.clone());
      if (colors) {
        mesh.getColorAt(index, color);
        colors.push(color.clone());
      }
    }

    batches.push({
      mesh,
      matrices,
      colors,
      localSphere: geometrySphere.clone(),
      visibleIndices: matrices.map((_, index) => index),
      visibleScratch: [],
      verticesPerInstance,
      originalFrustumCulled: mesh.frustumCulled,
    });
    // Visibility is handled per instance below. A second whole-batch cull can
    // use a stale InstancedMesh sphere after compaction and hide valid members.
    mesh.frustumCulled = false;
  });

  const stats: FloraCullingStats = {
    sourceBatches,
    culledBatches: batches.length,
    instances: batches.reduce((total, batch) => total + batch.matrices.length, 0),
    estimatedVerticesCovered: batches.reduce(
      (total, batch) => total + batch.verticesPerInstance * batch.matrices.length,
      0
    ),
    visibleInstances: batches.reduce((total, batch) => total + batch.matrices.length, 0),
    estimatedSubmittedVertices: batches.reduce(
      (total, batch) => total + batch.verticesPerInstance * batch.matrices.length,
      0
    ),
  };
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const worldMatrix = new Matrix4();
  const worldSphere = new Sphere();
  const lastViewProjection = new Float32Array(16);
  let hasViewProjection = false;

  function update(camera: Camera): FloraCullingStats {
    camera.updateWorldMatrix(true, false);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const viewProjectionElements = viewProjection.elements;
    if (
      hasViewProjection
      && viewProjectionElements.every((value, index) => value === lastViewProjection[index])
    ) {
      return stats;
    }
    lastViewProjection.set(viewProjectionElements);
    hasViewProjection = true;
    frustum.setFromProjectionMatrix(viewProjection);

    let visibleInstances = 0;
    let submittedVertices = 0;

    for (const batch of batches) {
      const visible = batch.visibleScratch;
      visible.length = 0;
      batch.matrices.forEach((instanceMatrix, index) => {
        worldMatrix.multiplyMatrices(batch.mesh.matrixWorld, instanceMatrix);
        worldSphere.copy(batch.localSphere).applyMatrix4(worldMatrix);
        worldSphere.radius += boundsPadding;
        if (frustum.intersectsSphere(worldSphere)) visible.push(index);
      });

      visibleInstances += visible.length;
      submittedVertices += visible.length * batch.verticesPerInstance;
      if (sameIndices(visible, batch.visibleIndices)) continue;

      visible.forEach((sourceIndex, targetIndex) => {
        batch.mesh.setMatrixAt(targetIndex, batch.matrices[sourceIndex]!);
        if (batch.colors) {
          batch.mesh.setColorAt(targetIndex, batch.colors[sourceIndex]!);
        }
      });
      batch.mesh.count = visible.length;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.visibleIndices = visible.slice();
    }

    stats.visibleInstances = visibleInstances;
    stats.estimatedSubmittedVertices = submittedVertices;
    return stats;
  }

  function restore(): void {
    hasViewProjection = false;
    for (const batch of batches) {
      batch.matrices.forEach((matrix, index) => {
        batch.mesh.setMatrixAt(index, matrix);
        if (batch.colors) batch.mesh.setColorAt(index, batch.colors[index]!);
      });
      batch.mesh.count = batch.matrices.length;
      batch.mesh.frustumCulled = batch.originalFrustumCulled;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.visibleIndices = batch.matrices.map((_, index) => index);
    }
  }

  return { stats, update, restore };
}
