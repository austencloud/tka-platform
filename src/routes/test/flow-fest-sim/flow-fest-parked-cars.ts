import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  StaticDrawUsage,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

/**
 * The parked-car lineup for the lower campground. Each catalogue body is
 * instanced across every stall it was assigned, so the field reads as one
 * fleet rather than a handful of identical cars.
 *
 * The footprint drives the walk-up collider and the stall arithmetic; the
 * rendered body is normalised to `lengthMeters` when its GLB loads, so an
 * export at an arbitrary unit scale still parks inside its stall.
 * `sourceYawRadians` turns the export so its nose points along local +X, the
 * convention every placement rotation assumes.
 *
 * `paint` lets one body wear several colours across the lot. The named
 * materials are the painted panels; every other material (glass, chrome,
 * tyres, interior) is left alone. In `recolor` mode the panel albedo map is
 * dropped and the per-instance colour becomes the paint, which keeps the
 * normal, roughness and metalness maps so the panel still reads as painted
 * steel. `tint` mode keeps the albedo and multiplies it, which only works
 * when the source paint is pale.
 */
export interface FlowFestParkedCarPaint {
  materialNames: readonly string[];
  variants: readonly string[];
  mode: "recolor" | "tint";
}

export interface FlowFestParkedCarAttribution {
  title: string;
  author: string;
  url: string;
  license: string;
}

export interface FlowFestParkedCarModel {
  id: string;
  label: string;
  url: string;
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  sourceYawRadians: number;
  paint?: FlowFestParkedCarPaint;
  attribution?: FlowFestParkedCarAttribution;
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

/** How many paint variants a body offers; a body without a paint seam has one. */
export function flowFestParkedCarPaintCount(
  model: Pick<FlowFestParkedCarModel, "paint">
): number {
  return Math.max(1, model.paint?.variants.length ?? 1);
}

export interface FlowFestParkedCarPlacement {
  x: number;
  y: number;
  z: number;
  /** Yaw; local +X (the nose) maps to world (cos, 0, -sin). */
  rotation: number;
  /** Nose-up angle after the wheels settle on the ground. */
  pitch: number;
  /** Right-side-down angle after the wheels settle on the ground. */
  roll: number;
  modelId: string;
  /** Index into the body's `paint.variants`; ignored when it has no seam. */
  paintIndex: number;
}

/**
 * Wheel contact points relative to the body centre, in the body's own frame
 * (nose along +X, right side along +Z). Catalogue bodies do not expose their
 * axles, so the contact patch is taken as a share of the footprint, which is
 * what a real wheelbase and track work out to within a few centimetres.
 */
const WHEELBASE_SHARE = 0.62;
const TRACK_SHARE = 0.84;
/** How far the tyres press into the field, so no car floats on a grass tip. */
const TYRE_SINK_METERS = 0.03;

/**
 * Settle a body on the ground: sample the terrain under all four wheels, then
 * pitch and roll the body so every wheel touches instead of the whole car
 * hovering over the highest one.
 */
export function settleFlowFestParkedCarOnGround(
  model: Pick<FlowFestParkedCarModel, "lengthMeters" | "widthMeters">,
  placement: { x: number; z: number; rotation: number },
  sampleGroundY: (x: number, z: number) => number
): { y: number; pitch: number; roll: number } {
  const halfWheelbase = (model.lengthMeters * WHEELBASE_SHARE) / 2;
  const halfTrack = (model.widthMeters * TRACK_SHARE) / 2;
  const nose = {
    x: Math.cos(placement.rotation),
    z: -Math.sin(placement.rotation),
  };
  const right = {
    x: Math.sin(placement.rotation),
    z: Math.cos(placement.rotation),
  };
  const wheel = (alongSign: number, rightSign: number) =>
    sampleGroundY(
      placement.x +
        nose.x * alongSign * halfWheelbase +
        right.x * rightSign * halfTrack,
      placement.z +
        nose.z * alongSign * halfWheelbase +
        right.z * rightSign * halfTrack
    );
  const frontLeft = wheel(1, -1);
  const frontRight = wheel(1, 1);
  const rearLeft = wheel(-1, -1);
  const rearRight = wheel(-1, 1);
  const front = (frontLeft + frontRight) / 2;
  const rear = (rearLeft + rearRight) / 2;
  const left = (frontLeft + rearLeft) / 2;
  const rightSide = (frontRight + rearRight) / 2;
  return {
    y: (front + rear) / 2 - TYRE_SINK_METERS,
    pitch: Math.atan2(front - rear, 2 * halfWheelbase),
    // A positive rotation about local X drops the right side, so a higher
    // right-hand pair rolls the body the other way.
    roll: -Math.atan2(rightSide - left, 2 * halfTrack),
  };
}

/** World matrix of a settled placement: yaw, then pitch, then roll. */
export function flowFestParkedCarPlacementMatrix(
  placement: Pick<
    FlowFestParkedCarPlacement,
    "x" | "y" | "z" | "rotation" | "pitch" | "roll"
  >,
  target = new Matrix4()
): Matrix4 {
  target
    .makeRotationY(placement.rotation)
    .multiply(new Matrix4().makeRotationZ(placement.pitch))
    .multiply(new Matrix4().makeRotationX(placement.roll));
  target.setPosition(placement.x, placement.y, placement.z);
  return target;
}

function isPaintMaterial(
  material: Material | Material[],
  paint: FlowFestParkedCarPaint | undefined
): boolean {
  if (!paint) return false;
  const materials = Array.isArray(material) ? material : [material];
  return materials.some((entry) => paint.materialNames.includes(entry.name));
}

function paintMaterial(
  material: Material | Material[],
  paint: FlowFestParkedCarPaint,
  cache: Map<Material, Material>
): Material | Material[] {
  const convert = (entry: Material): Material => {
    if (!paint.materialNames.includes(entry.name) || paint.mode === "tint") {
      return entry;
    }
    const cached = cache.get(entry);
    if (cached) return cached;
    const clone = entry.clone() as MeshStandardMaterial;
    if ("map" in clone) {
      clone.map = null;
      clone.color = new Color("#ffffff");
    }
    cache.set(entry, clone);
    return clone;
  };
  return Array.isArray(material) ? material.map(convert) : convert(material);
}

/**
 * Build GPU instances of one loaded car body over its stalls. The source is
 * measured, not trusted: it is re-centred on its footprint, grounded at y=0,
 * yawed so the nose points along +X, and scaled to the catalogue length.
 * Painted panels take the placement's paint variant per instance.
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
  const paintCache = new Map<Material, Material>();
  const paintColors = (model.paint?.variants ?? []).map(
    (variant) => new Color(variant)
  );

  source.traverse((child) => {
    const sourceMesh = child as Mesh;
    if (!sourceMesh.isMesh || !sourceMesh.geometry) return;
    localMatrix
      .copy(sourceInverse)
      .multiply(sourceMesh.matrixWorld)
      .premultiply(normalize);
    const painted = isPaintMaterial(sourceMesh.material, model.paint);
    const instances = new InstancedMesh(
      sourceMesh.geometry,
      painted && model.paint
        ? paintMaterial(sourceMesh.material, model.paint, paintCache)
        : sourceMesh.material,
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
    instances.userData.flowFestPainted = painted;
    placements.forEach((placement, index) => {
      flowFestParkedCarPlacementMatrix(placement, placementMatrix);
      instanceMatrix.multiplyMatrices(placementMatrix, localMatrix);
      instances.setMatrixAt(index, instanceMatrix);
      if (painted && paintColors.length > 0) {
        instances.setColorAt(
          index,
          paintColors[placement.paintIndex % paintColors.length]!
        );
      }
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
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
