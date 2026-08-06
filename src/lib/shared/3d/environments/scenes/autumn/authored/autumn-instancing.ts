import {
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  StaticDrawUsage,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

import type { Placement } from "./placements";

interface AutumnInstanceOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Turns several copies of a GLB scene into one draw batch per source mesh.
 * Autumn's kit files can contain multiple meshes and material groups, so this
 * preserves the complete source scene instead of taking only its first mesh.
 */
export function createAutumnInstanceBatches(
  sourceScene: Object3D,
  placements: readonly Placement[],
  options: AutumnInstanceOptions = {}
): InstancedMesh[] {
  if (placements.length === 0) return [];

  sourceScene.updateMatrixWorld(true);
  const batches: InstancedMesh[] = [];
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const rotation = new Euler();
  const matrix = new Matrix4();

  sourceScene.traverse((child) => {
    const sourceMesh = child as Mesh;
    if (!sourceMesh.isMesh || !sourceMesh.geometry || !sourceMesh.material)
      return;

    const geometry = sourceMesh.geometry.clone();
    geometry.applyMatrix4(sourceMesh.matrixWorld);

    const material = Array.isArray(sourceMesh.material)
      ? sourceMesh.material.map((item) => item.clone())
      : sourceMesh.material.clone();
    const batch = new InstancedMesh(geometry, material, placements.length);
    batch.instanceMatrix.setUsage(StaticDrawUsage);
    batch.castShadow = options.castShadow ?? false;
    batch.receiveShadow = options.receiveShadow ?? true;

    for (let index = 0; index < placements.length; index += 1) {
      const placement = placements[index]!;
      position.set(placement.x, 0, placement.z);
      rotation.set(0, placement.rotationY, 0);
      quaternion.setFromEuler(rotation);
      scale.setScalar(placement.scale);
      matrix.compose(position, quaternion, scale);
      batch.setMatrixAt(index, matrix);
    }

    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    batches.push(batch);
  });

  return batches;
}

export function createAutumnVariantBatches(
  sourceScenes: readonly Object3D[],
  placements: readonly Placement[],
  options: AutumnInstanceOptions = {}
): InstancedMesh[] {
  return sourceScenes.flatMap((sourceScene, variantIndex) => {
    const variantPlacements = placements.filter(
      (_, placementIndex) =>
        placementIndex % sourceScenes.length === variantIndex
    );
    return createAutumnInstanceBatches(sourceScene, variantPlacements, options);
  });
}

export function disposeAutumnInstanceBatches(
  batches: readonly InstancedMesh[]
): void {
  for (const batch of batches) {
    batch.geometry.dispose();
    const materials: Material[] = Array.isArray(batch.material)
      ? batch.material
      : [batch.material];
    for (const material of materials) material.dispose();
    batch.dispose();
  }
}
