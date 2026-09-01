import type { BufferGeometry, InstancedMesh, Material, Object3D } from "three";
import type { AutumnQualityTier } from "./autumn-quality";

interface InstanceBudget {
  materialPrefix: string;
  medium: number;
  low: number;
}

// The Blender placement order is part of this contract: hero trees precede
// saplings, near-belt trees precede middle-depth trees, and every habitat is
// authored in cluster order. Trimming the tail therefore removes secondary
// density without scrambling the approved high-tier composition.
export const AUTUMN_INSTANCE_BUDGETS: readonly InstanceBudget[] = [
  { materialPrefix: "Autumn Hero B PBR", medium: 5, low: 3 },
  { materialPrefix: "Autumn Birch PBR", medium: 9, low: 5 },
  { materialPrefix: "Autumn Larch PBR", medium: 7, low: 4 },
  { materialPrefix: "Autumn Snag PBR", medium: 7, low: 4 },
  { materialPrefix: "Autumn Willow PBR", medium: 5, low: 3 },
  { materialPrefix: "Autumn Fern PBR", medium: 34, low: 18 },
  { materialPrefix: "Autumn Rounded Rock PBR", medium: 6, low: 4 },
  { materialPrefix: "Autumn Boulder PBR", medium: 3, low: 2 },
];

const FULL_COUNT_KEY = "autumnGeometryFullInstanceCount";

export interface AutumnGeometryTierReport {
  tier: AutumnQualityTier;
  authoredTriangles: number;
  visibleTriangles: number;
  trimmedInstances: number;
}

function materialNames(material: Material | Material[]): string[] {
  const materials = Array.isArray(material) ? material : [material];
  return materials.map((candidate) => candidate.name);
}

function findBudget(mesh: InstancedMesh): InstanceBudget | undefined {
  const names = materialNames(mesh.material);
  return AUTUMN_INSTANCE_BUDGETS.find((budget) =>
    names.some((name) => name.startsWith(budget.materialPrefix))
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

export function applyAutumnGeometryTier(
  scene: Object3D,
  tier: AutumnQualityTier
): AutumnGeometryTierReport {
  let authoredTriangles = 0;
  let visibleTriangles = 0;
  let trimmedInstances = 0;

  scene.traverse((child) => {
    const mesh = child as InstancedMesh;
    if (!mesh.isMesh) return;

    const triangles = triangleCount(mesh.geometry);
    if (!mesh.isInstancedMesh) {
      authoredTriangles += triangles;
      visibleTriangles += triangles;
      return;
    }

    const storedFullCount = mesh.userData[FULL_COUNT_KEY] as number | undefined;
    const fullCount = storedFullCount ?? mesh.count;
    mesh.userData[FULL_COUNT_KEY] = fullCount;
    const budget = findBudget(mesh);
    const requestedCount =
      tier === "high" || !budget ? fullCount : budget[tier];
    const visibleCount = Math.min(fullCount, requestedCount);
    mesh.count = visibleCount;

    authoredTriangles += triangles * fullCount;
    visibleTriangles += triangles * visibleCount;
    trimmedInstances += fullCount - visibleCount;
  });

  return { tier, authoredTriangles, visibleTriangles, trimmedInstances };
}

export function restoreAutumnGeometryTier(scene: Object3D): void {
  scene.traverse((child) => {
    const mesh = child as InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    const fullCount = mesh.userData[FULL_COUNT_KEY] as number | undefined;
    if (fullCount === undefined) return;
    mesh.count = fullCount;
    delete mesh.userData[FULL_COUNT_KEY];
  });
}
