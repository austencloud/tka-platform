import {
  Color,
  Frustum,
  Matrix4,
  Quaternion,
  Sphere,
  Vector3,
  type Camera,
  type InstancedMesh,
  type Object3D,
} from "three";

export interface InstanceFrustumCullingOptions {
  minRenderedVerticesPerBatch?: number;
  boundsPadding?: number;
  minimumDistanceMeters?: number;
  maximumDistanceMeters?: number;
  cameraPositionThresholdMeters?: number;
  cameraRotationThresholdRadians?: number;
}

export interface InstanceFrustumCullingStats {
  sourceBatches: number;
  culledBatches: number;
  instances: number;
  estimatedVerticesCovered: number;
  visibleInstances: number;
  estimatedSubmittedVertices: number;
  distanceRejectedInstances: number;
  frustumRejectedInstances: number;
  updates: number;
  skippedUpdates: number;
}

export interface InstanceFrustumCuller {
  readonly stats: InstanceFrustumCullingStats;
  update(camera: Camera): InstanceFrustumCullingStats;
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
  originalVisible: boolean;
}

const DEFAULT_MIN_RENDERED_VERTICES_PER_BATCH = 50_000;
const DEFAULT_BOUNDS_PADDING = 0.3;

function renderedVerticesPerInstance(mesh: InstancedMesh): number {
  return (
    mesh.geometry.index?.count ??
    mesh.geometry.getAttribute("position")?.count ??
    0
  );
}

function sameIndices(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function createInstanceFrustumCuller(
  scene: Object3D,
  options: InstanceFrustumCullingOptions = {}
): InstanceFrustumCuller {
  const minRenderedVerticesPerBatch =
    options.minRenderedVerticesPerBatch ??
    DEFAULT_MIN_RENDERED_VERTICES_PER_BATCH;
  const boundsPadding = options.boundsPadding ?? DEFAULT_BOUNDS_PADDING;
  const minimumDistanceMeters = Math.max(0, options.minimumDistanceMeters ?? 0);
  const maximumDistanceMeters = Math.max(
    minimumDistanceMeters,
    options.maximumDistanceMeters ?? Number.POSITIVE_INFINITY
  );
  const cameraPositionThresholdMeters = Math.max(
    0,
    options.cameraPositionThresholdMeters ?? 0
  );
  const cameraRotationThresholdRadians = Math.max(
    0,
    options.cameraRotationThresholdRadians ?? 0
  );
  const batches: CulledBatch[] = [];
  let sourceBatches = 0;

  scene.updateWorldMatrix(true, true);
  scene.traverse((object) => {
    const mesh = object as InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    sourceBatches += 1;
    const verticesPerInstance = renderedVerticesPerInstance(mesh);
    if (
      mesh.count < 2 ||
      mesh.morphTexture ||
      verticesPerInstance * mesh.count < minRenderedVerticesPerBatch
    )
      return;

    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const geometrySphere = mesh.geometry.boundingSphere;
    if (!geometrySphere) return;
    const matrix = new Matrix4();
    const color = new Color();
    const matrices: Matrix4[] = [];
    const colors = mesh.instanceColor ? ([] as Color[]) : null;
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
      originalVisible: mesh.visible,
    });
    mesh.frustumCulled = false;
  });

  const stats: InstanceFrustumCullingStats = {
    sourceBatches,
    culledBatches: batches.length,
    instances: batches.reduce(
      (total, batch) => total + batch.matrices.length,
      0
    ),
    estimatedVerticesCovered: batches.reduce(
      (total, batch) =>
        total + batch.verticesPerInstance * batch.matrices.length,
      0
    ),
    visibleInstances: batches.reduce(
      (total, batch) => total + batch.matrices.length,
      0
    ),
    estimatedSubmittedVertices: batches.reduce(
      (total, batch) =>
        total + batch.verticesPerInstance * batch.matrices.length,
      0
    ),
    distanceRejectedInstances: 0,
    frustumRejectedInstances: 0,
    updates: 0,
    skippedUpdates: 0,
  };
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const worldMatrix = new Matrix4();
  const worldSphere = new Sphere();
  const cameraWorldPosition = new Vector3();
  const lastCameraWorldPosition = new Vector3();
  const cameraWorldQuaternion = new Quaternion();
  const lastCameraWorldQuaternion = new Quaternion();
  const lastViewProjection = new Matrix4();
  const lastProjection = new Matrix4();
  let hasViewProjection = false;

  function update(camera: Camera): InstanceFrustumCullingStats {
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraWorldPosition);
    camera.getWorldQuaternion(cameraWorldQuaternion);
    const projectionChanged =
      !hasViewProjection || !camera.projectionMatrix.equals(lastProjection);
    if (
      hasViewProjection &&
      !projectionChanged &&
      cameraWorldPosition.distanceTo(lastCameraWorldPosition) <
        cameraPositionThresholdMeters &&
      cameraWorldQuaternion.angleTo(lastCameraWorldQuaternion) <
        cameraRotationThresholdRadians
    ) {
      stats.skippedUpdates += 1;
      return stats;
    }
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    if (hasViewProjection && viewProjection.equals(lastViewProjection)) {
      stats.skippedUpdates += 1;
      return stats;
    }
    lastViewProjection.copy(viewProjection);
    lastProjection.copy(camera.projectionMatrix);
    lastCameraWorldPosition.copy(cameraWorldPosition);
    lastCameraWorldQuaternion.copy(cameraWorldQuaternion);
    hasViewProjection = true;
    frustum.setFromProjectionMatrix(viewProjection);
    let visibleInstances = 0;
    let submittedVertices = 0;
    let distanceRejectedInstances = 0;
    let frustumRejectedInstances = 0;
    const minimumDistanceSquared = minimumDistanceMeters ** 2;
    const maximumDistanceSquared = maximumDistanceMeters ** 2;
    for (const batch of batches) {
      const visible = batch.visibleScratch;
      visible.length = 0;
      batch.matrices.forEach((instanceMatrix, index) => {
        worldMatrix.multiplyMatrices(batch.mesh.matrixWorld, instanceMatrix);
        worldSphere.copy(batch.localSphere).applyMatrix4(worldMatrix);
        worldSphere.radius += boundsPadding;
        const distanceSquared = cameraWorldPosition.distanceToSquared(
          worldSphere.center
        );
        if (
          distanceSquared < minimumDistanceSquared ||
          distanceSquared >= maximumDistanceSquared
        ) {
          distanceRejectedInstances += 1;
          return;
        }
        if (frustum.intersectsSphere(worldSphere)) {
          visible.push(index);
        } else {
          frustumRejectedInstances += 1;
        }
      });
      visibleInstances += visible.length;
      submittedVertices += visible.length * batch.verticesPerInstance;
      if (sameIndices(visible, batch.visibleIndices)) continue;
      visible.forEach((sourceIndex, targetIndex) => {
        batch.mesh.setMatrixAt(targetIndex, batch.matrices[sourceIndex]!);
        if (batch.colors)
          batch.mesh.setColorAt(targetIndex, batch.colors[sourceIndex]!);
      });
      batch.mesh.count = visible.length;
      batch.mesh.visible = visible.length > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.visibleIndices = visible.slice();
    }
    stats.visibleInstances = visibleInstances;
    stats.estimatedSubmittedVertices = submittedVertices;
    stats.distanceRejectedInstances = distanceRejectedInstances;
    stats.frustumRejectedInstances = frustumRejectedInstances;
    stats.updates += 1;
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
      batch.mesh.visible = batch.originalVisible;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.visibleIndices = batch.matrices.map((_, index) => index);
    }
  }

  return { stats, update, restore };
}
