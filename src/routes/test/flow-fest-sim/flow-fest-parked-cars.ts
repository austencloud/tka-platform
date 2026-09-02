import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  StaticDrawUsage,
  Vector3,
  type Mesh,
  type Object3D,
} from "three";

/**
 * The parked-car lineup for the lower campground. Six Meshy-generated bodies
 * (`scripts/flow-fest-cars-meshy-assets.json`) are instanced across the
 * thirty-two stalls, so no two neighbours in a row share a body.
 *
 * The footprint drives the walk-up collider and the stall arithmetic; the
 * rendered body is normalised to `lengthMeters` when its GLB loads, so a
 * Meshy export at an arbitrary unit scale still parks inside its stall.
 * `sourceYawRadians` turns the export so its nose points along local +X, the
 * convention every placement rotation assumes.
 */
export interface FlowFestParkedCarModel {
  id: string;
  label: string;
  url: string;
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  sourceYawRadians: number;
}

export const FLOW_FEST_PARKED_CAR_MODELS: readonly FlowFestParkedCarModel[] =
  Object.freeze([
    {
      id: "sedan-silver",
      label: "silver sedan",
      url: "/models/flow-fest/cars/sedan-silver.glb",
      lengthMeters: 4.75,
      widthMeters: 2.05,
      heightMeters: 1.57,
      sourceYawRadians: Math.PI,
    },
    {
      id: "crossover-white",
      label: "white crossover",
      url: "/models/flow-fest/cars/crossover-white.glb",
      lengthMeters: 4.45,
      widthMeters: 2.05,
      heightMeters: 1.62,
      sourceYawRadians: Math.PI,
    },
    {
      id: "wagon-green",
      label: "green outdoor wagon",
      url: "/models/flow-fest/cars/wagon-green.glb",
      lengthMeters: 4.7,
      widthMeters: 2.15,
      heightMeters: 1.85,
      sourceYawRadians: Math.PI,
    },
    {
      id: "pickup-grey",
      label: "grey crew-cab pickup",
      url: "/models/flow-fest/cars/pickup-grey.glb",
      lengthMeters: 5.85,
      widthMeters: 2.4,
      heightMeters: 1.9,
      sourceYawRadians: Math.PI,
    },
    {
      id: "camper-van-white",
      label: "white camper van",
      url: "/models/flow-fest/cars/camper-van-white.glb",
      lengthMeters: 5.95,
      widthMeters: 2.5,
      heightMeters: 3.25,
      sourceYawRadians: Math.PI,
    },
    {
      id: "hatchback-blue",
      label: "blue hatchback",
      url: "/models/flow-fest/cars/hatchback-blue.glb",
      lengthMeters: 3.7,
      widthMeters: 1.85,
      heightMeters: 1.76,
      sourceYawRadians: Math.PI,
    },
  ]);

export function flowFestParkedCarModel(id: string): FlowFestParkedCarModel {
  const model = FLOW_FEST_PARKED_CAR_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Unknown Flow Fest parked-car model "${id}"`);
  return model;
}

export interface FlowFestParkedCarPlacement {
  x: number;
  y: number;
  z: number;
  /** Yaw; local +X (the nose) maps to world (cos, 0, -sin). */
  rotation: number;
  modelId: string;
}

/**
 * Build GPU instances of one loaded car body over its stalls. The source is
 * measured, not trusted: it is re-centred on its footprint, grounded at y=0,
 * yawed so the nose points along +X, and scaled to the catalogue length.
 */
export function createFlowFestParkedCarInstances(
  source: Object3D,
  model: FlowFestParkedCarModel,
  placements: readonly FlowFestParkedCarPlacement[]
): Group {
  const root = new Group();
  root.name = `FFS_CarsFamily_${model.id}`;
  source.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const yawQuarterTurns = Math.round(model.sourceYawRadians / (Math.PI / 2));
  const sourceLength = yawQuarterTurns % 2 === 0 ? size.x : size.z;
  const scale = model.lengthMeters / Math.max(sourceLength, 0.001);
  const normalize = new Matrix4()
    .makeTranslation(0, -bounds.min.y * scale, 0)
    .multiply(new Matrix4().makeRotationY(model.sourceYawRadians))
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-center.x, 0, -center.z));
  const sourceInverse = new Matrix4().copy(source.matrixWorld).invert();
  const placementMatrix = new Matrix4();
  const localMatrix = new Matrix4();
  const instanceMatrix = new Matrix4();

  source.traverse((child) => {
    const sourceMesh = child as Mesh;
    if (!sourceMesh.isMesh || !sourceMesh.geometry) return;
    localMatrix
      .copy(sourceInverse)
      .multiply(sourceMesh.matrixWorld)
      .premultiply(normalize);
    const instances = new InstancedMesh(
      sourceMesh.geometry,
      sourceMesh.material,
      Math.max(placements.length, 1)
    );
    instances.name = `FFS_Cars_${model.id}_${sourceMesh.name || "body"}`;
    instances.count = placements.length;
    instances.instanceMatrix.setUsage(StaticDrawUsage);
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.frustumCulled = true;
    // Camera collision raycasts child meshes and reads the flag on the hit
    // object, so it goes on every body mesh rather than the family group.
    instances.userData.cameraCollider = true;
    instances.userData.flowFestParkedCarModel = model.id;
    placements.forEach((placement, index) => {
      placementMatrix.makeRotationY(placement.rotation);
      placementMatrix.setPosition(placement.x, placement.y, placement.z);
      instanceMatrix.multiplyMatrices(placementMatrix, localMatrix);
      instances.setMatrixAt(index, instanceMatrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    root.add(instances);
  });
  return root;
}

/** Instances share the loader-cached geometry and materials; only the group goes. */
export function disposeFlowFestParkedCarInstances(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as InstancedMesh;
    if (mesh.isInstancedMesh) mesh.dispose();
  });
  root.removeFromParent();
}
