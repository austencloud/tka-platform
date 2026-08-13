export type CloudbreakMaterialGrade = "olive" | "limestone";

export interface CloudbreakRenderableAsset {
  id: string;
  path: string;
  targetHeight: number;
  materialGrade: CloudbreakMaterialGrade;
}

export const CLOUDBREAK_RUNTIME_ASSETS = [
  {
    id: "olive-west-ancient",
    path: "/models/celestial/cloudbreak/source/olive-west-ancient.glb",
    targetHeight: 7,
    materialGrade: "olive",
  },
  {
    id: "olive-east-windswept",
    path: "/models/celestial/cloudbreak/source/olive-east-windswept.glb",
    targetHeight: 6,
    materialGrade: "olive",
  },
  {
    id: "coast-rocks-05",
    path: "/models/celestial/cloudbreak/rocks/coast-rocks-05.glb",
    targetHeight: 0.85,
    materialGrade: "limestone",
  },
  {
    id: "sand-rocks-small-01",
    path: "/models/celestial/cloudbreak/rocks/sand-rocks-small-01.glb",
    targetHeight: 0.65,
    materialGrade: "limestone",
  },
] as const satisfies ReadonlyArray<CloudbreakRenderableAsset>;

export function getCloudbreakRuntimeAsset(
  id: (typeof CLOUDBREAK_RUNTIME_ASSETS)[number]["id"]
): CloudbreakRenderableAsset {
  const asset = CLOUDBREAK_RUNTIME_ASSETS.find(
    (candidate) => candidate.id === id
  );
  if (!asset) throw new Error(`Missing Cloudbreak runtime asset: ${id}`);
  return asset;
}
