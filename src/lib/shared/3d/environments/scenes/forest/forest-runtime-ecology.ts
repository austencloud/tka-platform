import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  StaticDrawUsage,
  Vector3,
  type Material,
  type Mesh,
} from "three";

export interface ForestRuntimeTreePlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  renderedHeightMeters: number;
}

export interface ForestRuntimeGrassPlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  widthMeters: number;
  heightMeters: number;
  species: "summer-sward" | "woodland-grass";
  tier: "base" | "medium" | "high";
  colorIndex: number;
}

const GRASS_COLORS = ["#6d7a5c", "#7e8768", "#5d6b50", "#74805d"];

/** Build GPU instances from an accepted Forest tree family without copying it. */
export function createForestRuntimeTreeInstances(
  source: Object3D,
  placements: ForestRuntimeTreePlacement[],
  familyId: string
): Group {
  const root = new Group();
  root.name = `Forest_RuntimeTreeFamily_${familyId}`;
  source.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source);
  const sourceHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const placementMatrix = new Matrix4();
  const combinedMatrix = new Matrix4();
  const quaternion = new Quaternion();
  const upAxis = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const position = new Vector3();

  source.traverse((child) => {
    const sourceMesh = child as Mesh;
    if (!sourceMesh.isMesh || !sourceMesh.geometry) return;
    const materials = cloneMaterials(sourceMesh.material);
    const instances = new InstancedMesh(
      sourceMesh.geometry,
      materials,
      Math.max(placements.length, 1)
    );
    instances.name = `Forest_RuntimeTree_${familyId}_${sourceMesh.name}`;
    instances.count = placements.length;
    instances.instanceMatrix.setUsage(StaticDrawUsage);
    instances.castShadow = false;
    instances.receiveShadow = true;
    instances.frustumCulled = true;
    instances.userData.forestRuntimeEcology = true;
    instances.userData.forestTreeFamily = familyId;
    instances.userData.ownedMaterials = true;

    placements.forEach((placement, index) => {
      const uniformScale = placement.renderedHeightMeters / sourceHeight;
      quaternion.setFromAxisAngle(upAxis, placement.rotation);
      scale.setScalar(uniformScale);
      position.set(
        placement.x,
        placement.y - bounds.min.y * uniformScale,
        placement.z
      );
      placementMatrix.compose(position, quaternion, scale);
      combinedMatrix.multiplyMatrices(placementMatrix, sourceMesh.matrixWorld);
      instances.setMatrixAt(index, combinedMatrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    // Matrices are static after construction. Compute the aggregate sphere now
    // so cheap batches that remain on Three.js native culling cannot inherit a
    // stale or source-only bound.
    instances.computeBoundingSphere();
    root.add(instances);
  });
  return root;
}

/** Create the same tiered, rooted-wind-ready grass contract used by Forest. */
export function createForestRuntimeGrassField(
  placements: ForestRuntimeGrassPlacement[],
  sources: ReadonlyMap<ForestRuntimeGrassPlacement["species"], Mesh>
): Group {
  const root = new Group();
  root.name = "Forest_RuntimeGroundEcosystem";
  for (const tier of ["base", "medium", "high"] as const) {
    for (const species of ["summer-sward", "woodland-grass"] as const) {
      const selected = placements.filter(
        (placement) => placement.tier === tier && placement.species === species
      );
      if (selected.length === 0) continue;
      const source = sources.get(species);
      if (!source) continue;
      const geometry = source.geometry;
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds) continue;
      const sourceHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
      const sourceWidth = Math.max(
        0.001,
        bounds.max.x - bounds.min.x,
        bounds.max.z - bounds.min.z
      );
      const material = cloneMaterials(source.material);
      const mesh = new InstancedMesh(
        geometry,
        material,
        Math.max(selected.length, 1)
      );
      const tierName = `${tier[0]!.toUpperCase()}${tier.slice(1)}`;
      mesh.name = `Forest_Ecosystem_${tierName}_FlowFest_${species}`;
      mesh.count = selected.length;
      mesh.instanceMatrix.setUsage(StaticDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.userData.tka_role = "near-frame-ground-ecosystem";
      mesh.userData.tka_ground_family = "grass";
      mesh.userData.tka_ground_species = species;
      mesh.userData.tka_ground_stratum = tier === "base" ? "carpet" : "meadow";
      mesh.userData.tka_wind_response = tier === "high" ? 1.15 : 1;
      mesh.userData.forestRuntimeEcology = true;
      mesh.userData.ownedMaterials = true;
      const object = new Object3D();
      selected.forEach((placement, index) => {
        const heightScale = placement.heightMeters / sourceHeight;
        const widthScale = (placement.widthMeters * 2.8) / sourceWidth;
        object.position.set(
          placement.x,
          placement.y - bounds.min.y * heightScale,
          placement.z
        );
        object.rotation.set(0, placement.rotation, 0);
        object.scale.set(widthScale, heightScale, widthScale);
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);
        mesh.setColorAt(index, new Color(GRASS_COLORS[placement.colorIndex]!));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
  return root;
}

export function disposeForestRuntimeEcology(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.ownsGeometry) mesh.geometry.dispose();
    if (!mesh.userData.ownedMaterials) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
  root.removeFromParent();
}

function cloneMaterials(
  material: Material | Material[]
): Material | Material[] {
  return Array.isArray(material)
    ? material.map((candidate) => candidate.clone())
    : material.clone();
}
