import {
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";
import {
  FOREST_GROUND_DETAIL_TEXTURES,
  getForestGroundDetailFamily,
  isForestGroundMaterial,
  patchForestGroundDetailMaterial,
  type ForestGroundDetailFamily,
  type ForestGroundDetailPatch,
} from "../../scenes/forest/forest-ground-detail";

export interface ForestGroundDetailRuntime {
  ready: Promise<void>;
  dispose(): void;
}

interface ForestGroundDetailRuntimeOptions {
  root: Object3D;
  strength?: number;
  normalResponse?: number;
  roughnessFloor?: number;
  anisotropy?: number;
  assetUrl?: (path: string) => string;
  loadTexture?: (url: string) => Promise<Texture>;
}

function loadWith(loader: TextureLoader, url: string): Promise<Texture> {
  return new Promise((resolve, reject) =>
    loader.load(url, resolve, undefined, reject)
  );
}

/** Loads and applies the exact production Forest floor detail stack. */
export function createForestGroundDetailRuntime(
  options: ForestGroundDetailRuntimeOptions
): ForestGroundDetailRuntime {
  const assetUrl = options.assetUrl ?? ((path: string) => path);
  const loader = new TextureLoader();
  const textures = new Set<Texture>();
  const patches = new Set<ForestGroundDetailPatch>();
  let disposed = false;
  const load = options.loadTexture
    ? options.loadTexture
    : (url: string) => loadWith(loader, url);

  const ready = Promise.all([
    ...(
      Object.entries(FOREST_GROUND_DETAIL_TEXTURES) as [
        ForestGroundDetailFamily,
        string,
      ][]
    ).map(async ([family, path]) => {
      const texture = await load(assetUrl(path));
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = Math.min(8, options.anisotropy ?? 1);
      texture.needsUpdate = true;
      textures.add(texture);
      return [family, texture] as const;
    }),
    load(assetUrl("/textures/forest-floor/forest-floor-family-mask.png")).then(
      (texture) => {
        texture.colorSpace = NoColorSpace;
        texture.needsUpdate = true;
        textures.add(texture);
        return ["mask", texture] as const;
      }
    ),
  ])
    .then((entries) => {
      if (disposed) return;
      const detailMaps = Object.fromEntries(
        entries.filter(([family]) => family !== "mask")
      ) as Record<ForestGroundDetailFamily, Texture>;
      const familyMask = entries.find(([family]) => family === "mask")?.[1];
      if (!familyMask) return;
      options.root.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const candidate of materials) {
          const material = candidate as MeshStandardMaterial;
          if (
            !material.isMeshStandardMaterial ||
            !isForestGroundMaterial(material) ||
            !getForestGroundDetailFamily(material)
          ) {
            continue;
          }
          patches.add(
            patchForestGroundDetailMaterial(
              material,
              detailMaps,
              familyMask,
              options.strength ?? 0.9,
              {
                preserveColor: material.color,
                normalResponse: options.normalResponse ?? 0.3,
                roughnessFloor: options.roughnessFloor ?? 0.98,
                absoluteColorStrength: 0,
                primaryScale: 2.8,
                secondaryScale: 7.4,
                maskOrigin: new Vector2(-200, -200),
                maskSize: new Vector2(400, 400),
                worldAxisSign: new Vector2(1, -1),
              }
            )
          );
        }
      });
    })
    .catch((error) => {
      console.warn(
        "[ForestGroundDetail] detail textures failed to load",
        error
      );
    });

  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const patch of patches) patch.dispose();
      for (const texture of textures) texture.dispose();
      patches.clear();
      textures.clear();
    },
  };
}
