import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  StaticDrawUsage,
  Vector3,
  type Material,
  type Object3D,
} from "three";

export {
  FLOW_FEST_PARKED_CAR_MODELS,
  flowFestParkedCarModel,
  flowFestParkedCarPaintCount,
  type FlowFestParkedCarAttribution,
  type FlowFestParkedCarModel,
  type FlowFestParkedCarPaint,
  type FlowFestParkedCarWheelContacts,
} from "./flow-fest-parked-car-catalog";
import {
  type FlowFestParkedCarModel,
  type FlowFestParkedCarPaint,
} from "./flow-fest-parked-car-catalog";


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

/** How far the tyres press into the field, so no car floats on a grass tip. */
const TYRE_SINK_METERS = 0.03;

/**
 * Settle a body on the ground: sample the terrain under all four wheels, then
 * pitch and roll the body so every wheel touches instead of the whole car
 * hovering over the highest one.
 */
export function settleFlowFestParkedCarOnGround(
  model: Pick<FlowFestParkedCarModel, "wheels">,
  placement: { x: number; z: number; rotation: number },
  sampleGroundY: (x: number, z: number) => number
): { y: number; pitch: number; roll: number } {
  // The axle line is not centred on the body, so the pitch pivot is the
  // midpoint of the real contact patches rather than the body origin.
  const halfWheelbase =
    (model.wheels.frontAlongMeters - model.wheels.rearAlongMeters) / 2;
  const alongOffset =
    (model.wheels.frontAlongMeters + model.wheels.rearAlongMeters) / 2;
  const halfTrack = model.wheels.halfTrackMeters;
  const nose = {
    x: Math.cos(placement.rotation),
    z: -Math.sin(placement.rotation),
  };
  const right = {
    x: Math.sin(placement.rotation),
    z: Math.cos(placement.rotation),
  };
  const wheel = (along: number, rightSign: number) =>
    sampleGroundY(
      placement.x + nose.x * along + right.x * rightSign * halfTrack,
      placement.z + nose.z * along + right.z * rightSign * halfTrack
    );
  const { frontAlongMeters: frontAlong, rearAlongMeters: rearAlong } =
    model.wheels;
  const frontLeft = wheel(frontAlong, -1);
  const frontRight = wheel(frontAlong, 1);
  const rearLeft = wheel(rearAlong, -1);
  const rearRight = wheel(rearAlong, 1);
  const front = (frontLeft + frontRight) / 2;
  const rear = (rearLeft + rearRight) / 2;
  const left = (frontLeft + rearLeft) / 2;
  const rightSide = (frontRight + rearRight) / 2;
  const pitch = Math.atan2(front - rear, 2 * halfWheelbase);
  return {
    // `(front + rear) / 2` is the ground under the axle midpoint, which the
    // pitch rotates about; the body origin sits `alongOffset` ahead of it.
    y: (front + rear) / 2 - alongOffset * Math.sin(pitch) - TYRE_SINK_METERS,
    pitch,
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
 * A single body's paint, resolved to one variant. The lot recolours per
 * instance through `instanceColor`; the driven car is one mesh per panel,
 * so its clone carries the colour itself: a recolour replaces the texture,
 * a tint multiplies into the base colour exactly as an instance colour would.
 */
function paintSingleBodyMaterial(
  material: Material | Material[],
  paint: FlowFestParkedCarPaint,
  variant: Color,
  cache: Map<Material, Material>,
  owned: Material[]
): Material | Material[] {
  const convert = (entry: Material): Material => {
    if (!paint.materialNames.includes(entry.name)) return entry;
    const cached = cache.get(entry);
    if (cached) return cached;
    const clone = entry.clone() as MeshStandardMaterial;
    if (paint.mode === "recolor") {
      if ("map" in clone) clone.map = null;
      clone.color = variant.clone();
    } else {
      clone.color = clone.color.clone().multiply(variant);
    }
    cache.set(entry, clone);
    owned.push(clone);
    return clone;
  };
  return Array.isArray(material) ? material.map(convert) : convert(material);
}

const WHEEL_MESH_NAME = /wheel|tire|tyre/i;

/**
 * The height the tyres actually rest on, in source units.
 *
 * These bodies are modelled with an underbody pan and bumper valances hanging
 * below the contact patch, so the scene's lowest point is not the road. The
 * wagon sat 19 cm and the SUV 14 cm clear of the field because both were
 * grounded on that pan. Where the source names its wheels, they own the datum;
 * a single merged body (the camper) falls back to the full bounds.
 */
function sourceRoadLevel(source: Object3D, fallbackY: number): number {
  const wheels = new Box3();
  wheels.makeEmpty();
  source.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!WHEEL_MESH_NAME.test(mesh.name)) return;
    wheels.union(new Box3().setFromObject(mesh));
  });
  return wheels.isEmpty() ? fallbackY : wheels.min.y;
}

export interface FlowFestCarNormalization {
  /** Source units to metres. */
  scale: number;
  /**
   * Source root space to body space: the nose along +X, the footprint centred
   * on the origin, the tyres resting on y = 0, one unit per metre.
   */
  matrix: Matrix4;
  /** Inverse of the source root's world matrix. */
  sourceInverse: Matrix4;
}

/**
 * Measure a loaded body rather than trust it: re-centre it on its footprint,
 * ground it on its tyres, yaw the nose onto +X and scale it to the catalogue
 * length. Every mesh of the body, instanced or driven, goes through this.
 */
export function computeFlowFestCarNormalization(
  source: Object3D,
  model: FlowFestParkedCarModel
): FlowFestCarNormalization {
  source.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const yawQuarterTurns = Math.round(model.sourceYawRadians / (Math.PI / 2));
  const sourceLength = yawQuarterTurns % 2 === 0 ? size.x : size.z;
  const scale = model.lengthMeters / Math.max(sourceLength, 0.001);
  const roadY = sourceRoadLevel(source, bounds.min.y);
  const matrix = new Matrix4()
    .makeTranslation(0, -roadY * scale, 0)
    .multiply(new Matrix4().makeRotationY(model.sourceYawRadians))
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-center.x, 0, -center.z));
  return {
    scale,
    matrix,
    sourceInverse: new Matrix4().copy(source.matrixWorld).invert(),
  };
}

/** One source mesh's transform into body space. */
export function flowFestCarMeshBodyMatrix(
  normalization: FlowFestCarNormalization,
  mesh: Object3D,
  target = new Matrix4()
): Matrix4 {
  return target
    .copy(normalization.sourceInverse)
    .multiply(mesh.matrixWorld)
    .premultiply(normalization.matrix);
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
  const normalization = computeFlowFestCarNormalization(source, model);
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
    flowFestCarMeshBodyMatrix(normalization, sourceMesh, localMatrix);
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

export type FlowFestCarWheelCorner = "FL" | "FR" | "RL" | "RR";

export interface FlowFestCarWheelPart {
  /** Body-space triangles of one source mesh, re-centred on the axle. */
  geometry: BufferGeometry;
  material: Material;
}

export interface FlowFestCarWheel {
  corner: FlowFestCarWheelCorner;
  /** Front wheels yaw with the steering. */
  steers: boolean;
  /** Axle centre in body metres. */
  center: Vector3;
  radiusMeters: number;
  /** A tyre and, on some bodies, a separate hubcap. */
  parts: FlowFestCarWheelPart[];
}

export interface FlowFestCarBody {
  /** Every non-wheel mesh, in body space. */
  root: Group;
  wheels: FlowFestCarWheel[];
  /** Geometry this body built and must dispose; body panels are shared. */
  ownedGeometries: BufferGeometry[];
  /** Painted material clones this body owns. */
  ownedMaterials: Material[];
}

const WHEEL_CORNERS: readonly {
  corner: FlowFestCarWheelCorner;
  front: boolean;
  right: boolean;
}[] = [
  { corner: "FL", front: true, right: false },
  { corner: "FR", front: true, right: true },
  { corner: "RL", front: false, right: false },
  { corner: "RR", front: false, right: true },
];

interface WheelTriangleBucket {
  positions: number[];
  normals: number[];
  uvs: number[];
  bounds: Box3;
}

function createWheelTriangleBucket(): WheelTriangleBucket {
  const bounds = new Box3();
  bounds.makeEmpty();
  return { positions: [], normals: [], uvs: [], bounds };
}

/**
 * These bodies carry all four wheels in one mesh, so a spinning wheel has to
 * be cut out of it: every triangle goes to the corner its centroid sits in,
 * front or rear of the axle midpoint and left or right of the centreline.
 * Positions read through the attribute accessors so quantized sources
 * dequantize; normals follow the body matrix's normal matrix.
 */
export function splitFlowFestCarWheelTriangles(
  geometry: BufferGeometry,
  bodyMatrix: Matrix4,
  axleMidpointX: number
): Map<FlowFestCarWheelCorner, WheelTriangleBucket> {
  const buckets = new Map<FlowFestCarWheelCorner, WheelTriangleBucket>();
  const position = geometry.getAttribute("position") as
    | BufferAttribute
    | undefined;
  if (!position) return buckets;
  const normal = geometry.getAttribute("normal") as BufferAttribute | undefined;
  const uv = geometry.getAttribute("uv") as BufferAttribute | undefined;
  const index = geometry.index;
  const normalMatrix = new Matrix3().getNormalMatrix(bodyMatrix);
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  const normals = [new Vector3(), new Vector3(), new Vector3()];
  const centroid = new Vector3();
  const triangleCount = Math.floor(
    (index ? index.count : position.count) / 3
  );
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const corners = [0, 1, 2].map((offset) =>
      index ? index.getX(triangle * 3 + offset) : triangle * 3 + offset
    );
    centroid.set(0, 0, 0);
    corners.forEach((vertexIndex, slot) => {
      vertices[slot]!
        .fromBufferAttribute(position, vertexIndex)
        .applyMatrix4(bodyMatrix);
      centroid.add(vertices[slot]!);
      if (normal) {
        normals[slot]!
          .fromBufferAttribute(normal, vertexIndex)
          .applyNormalMatrix(normalMatrix);
      }
    });
    centroid.multiplyScalar(1 / 3);
    const front = centroid.x >= axleMidpointX;
    const right = centroid.z >= 0;
    const corner = WHEEL_CORNERS.find(
      (entry) => entry.front === front && entry.right === right
    )!.corner;
    let bucket = buckets.get(corner);
    if (!bucket) {
      bucket = createWheelTriangleBucket();
      buckets.set(corner, bucket);
    }
    corners.forEach((vertexIndex, slot) => {
      const vertex = vertices[slot]!;
      bucket.positions.push(vertex.x, vertex.y, vertex.z);
      bucket.bounds.expandByPoint(vertex);
      if (normal) {
        const unit = normals[slot]!;
        bucket.normals.push(unit.x, unit.y, unit.z);
      }
      if (uv) {
        bucket.uvs.push(uv.getX(vertexIndex), uv.getY(vertexIndex));
      }
    });
  }
  return buckets;
}

/**
 * The player's own body as one articulated object: the panels as meshes in
 * body space, the wheels cut out per corner so the front pair can steer and
 * all four can spin. The source is shared with the lot instances and is not
 * touched; every panel mesh shares the loader's geometry and materials.
 */
export function buildFlowFestCarBody(
  source: Object3D,
  model: FlowFestParkedCarModel,
  paintIndex: number
): FlowFestCarBody {
  const root = new Group();
  root.name = `FFS_DrivenCarBody_${model.id}`;
  const normalization = computeFlowFestCarNormalization(source, model);
  const bodyMatrix = new Matrix4();
  const ownedGeometries: BufferGeometry[] = [];
  const ownedMaterials: Material[] = [];
  const paintCache = new Map<Material, Material>();
  const variants = model.paint?.variants ?? [];
  const variant =
    variants.length > 0
      ? new Color(variants[paintIndex % variants.length]!)
      : null;
  const axleMidpointX =
    (model.wheels.frontAlongMeters + model.wheels.rearAlongMeters) / 2;
  const wheelBuckets = new Map<
    FlowFestCarWheelCorner,
    { material: Material; bucket: WheelTriangleBucket }[]
  >();

  source.traverse((child) => {
    const sourceMesh = child as Mesh;
    if (!sourceMesh.isMesh || !sourceMesh.geometry) return;
    flowFestCarMeshBodyMatrix(normalization, sourceMesh, bodyMatrix);
    if (WHEEL_MESH_NAME.test(sourceMesh.name)) {
      const material = Array.isArray(sourceMesh.material)
        ? sourceMesh.material[0]!
        : sourceMesh.material;
      splitFlowFestCarWheelTriangles(
        sourceMesh.geometry,
        bodyMatrix,
        axleMidpointX
      ).forEach((bucket, corner) => {
        const entries = wheelBuckets.get(corner) ?? [];
        entries.push({ material, bucket });
        wheelBuckets.set(corner, entries);
      });
      return;
    }
    const painted = isPaintMaterial(sourceMesh.material, model.paint);
    const panel = new Mesh(
      sourceMesh.geometry,
      painted && model.paint && variant
        ? paintSingleBodyMaterial(
            sourceMesh.material,
            model.paint,
            variant,
            paintCache,
            ownedMaterials
          )
        : sourceMesh.material
    );
    panel.name = `FFS_DrivenCar_${model.id}_${sourceMesh.name || "body"}`;
    panel.matrix.copy(bodyMatrix);
    panel.matrixAutoUpdate = false;
    panel.castShadow = true;
    panel.receiveShadow = true;
    // Never a camera collider: the chase camera looks out from inside this
    // body, and a hit on its own panels would pull the boom to zero.
    panel.userData.flowFestParkedCarModel = model.id;
    panel.userData.flowFestPainted = painted;
    root.add(panel);
  });

  const wheels: FlowFestCarWheel[] = [];
  for (const { corner, front } of WHEEL_CORNERS) {
    const entries = wheelBuckets.get(corner);
    if (!entries || entries.length === 0) continue;
    const bounds = new Box3();
    bounds.makeEmpty();
    entries.forEach((entry) => bounds.union(entry.bucket.bounds));
    const center = bounds.getCenter(new Vector3());
    const radiusMeters = (bounds.max.y - bounds.min.y) / 2;
    const parts: FlowFestCarWheelPart[] = entries.map((entry) => {
      const { positions, normals, uvs } = entry.bucket;
      for (let offset = 0; offset < positions.length; offset += 3) {
        positions[offset] = positions[offset]! - center.x;
        positions[offset + 1] = positions[offset + 1]! - center.y;
        positions[offset + 2] = positions[offset + 2]! - center.z;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      if (normals.length === positions.length) {
        geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      } else {
        geometry.computeVertexNormals();
      }
      if (uvs.length === (positions.length / 3) * 2) {
        geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      }
      geometry.computeBoundingSphere();
      ownedGeometries.push(geometry);
      return { geometry, material: entry.material };
    });
    wheels.push({ corner, steers: front, center, radiusMeters, parts });
  }

  return { root, wheels, ownedGeometries, ownedMaterials };
}

export function disposeFlowFestCarBody(body: FlowFestCarBody): void {
  body.ownedGeometries.forEach((geometry) => geometry.dispose());
  body.ownedMaterials.forEach((material) => material.dispose());
  body.root.removeFromParent();
}
