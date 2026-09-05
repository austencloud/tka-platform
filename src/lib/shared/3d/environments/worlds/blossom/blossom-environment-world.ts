import {
  Color,
  FogExp2,
  Group,
  ImageBitmapLoader,
  NoColorSpace,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Texture,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
  type WebGLRenderer,
} from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  createDefaultBlossomConfig,
  type BlossomSceneConfig,
} from "../../domain/models/scene-configs";
import type { MaskedGroundDetailMaps } from "../../primitives/masked-ground-detail-material";
import {
  createBlossomRuntimeConfig,
  type BlossomQualityTier,
} from "../../scenes/cherry-blossom/blossom-runtime";
import { getBlossomActiveProductionPhase } from "../../scenes/cherry-blossom/blossom-site";
import {
  createBlossomAtmosphere,
  type BlossomAtmosphere,
} from "./blossom-atmosphere";
import {
  createBlossomGroundRuntime,
  type BlossomGroundAssets,
  type BlossomGroundRuntime,
} from "./blossom-ground-runtime";
import {
  createBlossomLightingRig,
  type BlossomLightingRig,
} from "./blossom-lighting-rig";
import { createBlossomRiver, type BlossomRiver } from "./blossom-river";
import { createBlossomStage, type BlossomStage } from "./blossom-stage";

export const BLOSSOM_ENVIRONMENT_URL =
  "/models/blossom/blossom_environment.glb";
export const BLOSSOM_MOON_TEXTURE_URL = "/textures/moon.png";
export const BLOSSOM_GROUND_TEXTURE_URLS = {
  red: "/textures/forest-floor/forest-ground-detail-neutral.jpg",
  green: "/textures/forest-floor/forest-ground-detail-meadow.jpg",
  blue: "/textures/forest-floor/forest-ground-detail-litter.jpg",
  fourth: "/textures/forest-floor/forest-ground-detail-damp.jpg",
  mask: "/textures/blossom-floor/blossom-ground-family-mask.png",
} as const;
export const BLOSSOM_AUTHORED_RESOURCE_URLS = [
  BLOSSOM_ENVIRONMENT_URL,
  BLOSSOM_MOON_TEXTURE_URL,
  BLOSSOM_GROUND_TEXTURE_URLS.red,
  BLOSSOM_GROUND_TEXTURE_URLS.green,
  BLOSSOM_GROUND_TEXTURE_URLS.blue,
  BLOSSOM_GROUND_TEXTURE_URLS.fourth,
  BLOSSOM_GROUND_TEXTURE_URLS.mask,
] as const;

export interface BlossomEnvironmentAssets extends BlossomGroundAssets {
  environmentRoot: Object3D;
  moonTexture: Texture;
}

export interface BlossomEnvironmentWorldOptions {
  renderer: WebGLRenderer;
  config?: BlossomSceneConfig;
  groundY: number;
  stageWidth?: number;
  stageDepth?: number;
  stageZOffset?: number;
  showDirectionCues?: boolean;
  qualityTier: BlossomQualityTier;
  reducedMotion?: boolean;
  random?: () => number;
}

export interface LoadBlossomAssetsOptions {
  renderer: WebGLRenderer;
  resolveAssetUrl?: (path: string) => string;
  onProgress?: (fraction: number) => void;
}

export interface BlossomEnvironmentWorld {
  root: Group;
  reflector: BlossomRiver["object"] | null;
  fog: FogExp2;
  background: Color;
  authoredResourceUrls: readonly string[];
  qualityTier: BlossomQualityTier;
  maxPixelRatio: number;
  update(deltaSeconds: number, camera: Camera): void;
  setGroundY(groundY: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

const HIDDEN_RUNTIME_OWNERS = new Set([
  "Twilight_Backdrop",
  "Moon_Disc",
  "Stage_Base",
  "Stage_Rim",
  "Stage_Planks",
  "Stage_Feet",
]);

function defaultAssetUrl(path: string): string {
  if (typeof globalThis.location === "undefined") return path;
  return new URL(path, globalThis.location.href).href;
}

function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function loadBitmapTexture(
  loader: ImageBitmapLoader,
  url: string
): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (bitmap) => {
        const texture = new Texture(bitmap);
        texture.flipY = false;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

function disposeMaterial(material: Material): void {
  material.dispose();
}

function disposeAuthoredTree(root: Object3D): void {
  const disposedTextures = new Set<Texture>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
          value.dispose();
        }
      }
      disposeMaterial(material);
    }
  });
  root.clear();
}

/** Load the one authored GLB and six exact support textures used in production. */
export async function loadBlossomEnvironmentAssets(
  options: LoadBlossomAssetsOptions
): Promise<BlossomEnvironmentAssets> {
  const resolveAssetUrl = options.resolveAssetUrl ?? defaultAssetUrl;
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(resolveAssetUrl("/basis/"))
    .detectSupport(options.renderer);
  gltfLoader.setKTX2Loader(ktx2Loader);
  const bitmapLoader = new ImageBitmapLoader();
  bitmapLoader.setOptions({ imageOrientation: "flipY" });
  const loadedTextures = new Set<Texture>();
  let completed = 0;
  const finish = <T>(value: T): T => {
    if (value instanceof Texture) loadedTextures.add(value);
    completed += 1;
    options.onProgress?.(completed / BLOSSOM_AUTHORED_RESOURCE_URLS.length);
    return value;
  };

  try {
    const [gltf, moonTexture, red, green, blue, fourth, familyMask] =
      await Promise.all([
        loadGltf(gltfLoader, resolveAssetUrl(BLOSSOM_ENVIRONMENT_URL)).then(
          finish
        ),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_MOON_TEXTURE_URL)
        ).then(finish),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_GROUND_TEXTURE_URLS.red)
        ).then(finish),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_GROUND_TEXTURE_URLS.green)
        ).then(finish),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_GROUND_TEXTURE_URLS.blue)
        ).then(finish),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_GROUND_TEXTURE_URLS.fourth)
        ).then(finish),
        loadBitmapTexture(
          bitmapLoader,
          resolveAssetUrl(BLOSSOM_GROUND_TEXTURE_URLS.mask)
        ).then(finish),
      ]);
    moonTexture.colorSpace = SRGBColorSpace;
    for (const texture of [red, green, blue, fourth]) {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = Math.min(
        8,
        options.renderer.capabilities.getMaxAnisotropy()
      );
      texture.needsUpdate = true;
    }
    familyMask.colorSpace = NoColorSpace;
    familyMask.needsUpdate = true;
    return {
      environmentRoot: gltf.scene,
      moonTexture,
      detailMaps: { red, green, blue, fourth } satisfies MaskedGroundDetailMaps,
      familyMask,
    };
  } catch (error) {
    for (const texture of loadedTextures) texture.dispose();
    throw error;
  } finally {
    ktx2Loader.dispose();
  }
}

function configureAuthoredEnvironment(
  root: Object3D,
  reflectiveWater: boolean,
  shadows: boolean
): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    const identity = `${child.name} ${mesh.geometry?.name ?? ""}`;
    if (HIDDEN_RUNTIME_OWNERS.has(child.name)) child.visible = false;
    if (
      identity.includes("Moonlit River Mesh") ||
      identity.includes("River_Water")
    ) {
      child.visible = !reflectiveWater;
    }
    if (!mesh.isMesh) return;
    mesh.receiveShadow =
      identity.includes("Garden Ground") ||
      identity.includes("Gravel") ||
      identity.includes("GardenEcology") ||
      identity.includes("Audience_") ||
      identity.includes("Path_") ||
      identity.includes("Operations_") ||
      identity.includes("Bridge") ||
      identity.includes("Stone") ||
      identity.includes("Boulder");
    mesh.castShadow =
      shadows &&
      (identity.includes("Sakura") ||
        identity.includes("GardenEcology") ||
        identity.includes("Torii") ||
        identity.includes("Bridge") ||
        identity.includes("Lantern") ||
        identity.includes("Stone") ||
        identity.includes("Boulder"));
  });
}

/** Build the exact production Blossom graph from already-loaded assets. */
export function createBlossomEnvironmentWorld(
  options: BlossomEnvironmentWorldOptions,
  assets: BlossomEnvironmentAssets
): BlossomEnvironmentWorld {
  const config = options.config ?? createDefaultBlossomConfig();
  const stageWidth = options.stageWidth ?? 6;
  const stageDepth = options.stageDepth ?? 6;
  const stageZOffset = options.stageZOffset ?? 0;
  const reducedMotion = options.reducedMotion ?? false;
  const motionScale = reducedMotion ? 0 : 1;
  const runtime = createBlossomRuntimeConfig({
    tier: options.qualityTier,
    prefersReducedMotion: reducedMotion,
    stageWidth,
    stageDepth,
    stageZOffset,
    groundY: options.groundY,
    particleCounts: {
      petals: config.petals.count,
      distantPetals: config.distantPetals?.count ?? 0,
      fireflies: config.fireflies?.count ?? 0,
    },
    lightIntensities: {
      hemisphere: config.hemisphereLight.intensity,
      key: config.moonLight?.enabled ? config.moonLight.intensity : 0,
    },
  });

  const root = new Group();
  root.name = "blossom-environment-world";
  const authored = new Group();
  authored.name = "BlossomEnvironment";
  authored.position.set(...runtime.stage.position);
  authored.scale.set(...runtime.stage.scale);
  authored.rotation.y = Math.PI;
  assets.environmentRoot.name ||= "blossom-authored-environment";
  configureAuthoredEnvironment(
    assets.environmentRoot,
    runtime.effects.reflectiveWater,
    runtime.effects.shadows
  );
  authored.add(assets.environmentRoot);

  const ground: BlossomGroundRuntime = createBlossomGroundRuntime({
    environmentRoot: assets.environmentRoot,
    assets,
    stageWidth,
    stageDepth,
    stageZOffset,
    qualityTier: options.qualityTier === "low" ? "base" : options.qualityTier,
    motionScale,
  });
  const atmosphere: BlossomAtmosphere = createBlossomAtmosphere({
    config,
    runtime,
    moonTexture: assets.moonTexture,
    decorativeAtmosphereEnabled: getBlossomActiveProductionPhase() >= 5,
    motionScale,
    random: options.random,
  });
  const stage: BlossomStage = createBlossomStage({
    width: stageWidth,
    depth: stageDepth,
    groundY: options.groundY,
    showDirectionCues: options.showDirectionCues ?? true,
  });
  const river = runtime.effects.reflectiveWater
    ? createBlossomRiver(options.groundY, stageZOffset)
    : null;
  const lighting: BlossomLightingRig = createBlossomLightingRig(
    config,
    runtime,
    options.groundY,
    stageZOffset
  );
  root.add(authored, atmosphere.object, stage.object, lighting.object);

  const fog = new FogExp2(config.fog.color, config.fog.density);
  const background = new Color(config.sky.topColor);
  const textures = new Set<Texture>([
    assets.moonTexture,
    ...Object.values(assets.detailMaps),
    assets.familyMask,
  ]);
  let disposed = false;

  function setGroundY(groundY: number): void {
    authored.position.y = groundY;
    stage.setGroundY(groundY);
    river?.setGroundY(groundY);
    lighting.setGroundY(groundY);
  }

  return {
    root,
    reflector: river?.object ?? null,
    fog,
    background,
    authoredResourceUrls: BLOSSOM_AUTHORED_RESOURCE_URLS,
    qualityTier: options.qualityTier,
    maxPixelRatio: runtime.maxPixelRatio,
    update(deltaSeconds, camera) {
      if (disposed) return;
      atmosphere.update(deltaSeconds, camera);
      ground.update(deltaSeconds);
      river?.update(deltaSeconds);
    },
    setGroundY,
    setActive(active) {
      root.visible = active;
      river?.setActive(active);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ground.dispose();
      atmosphere.dispose();
      stage.dispose();
      river?.dispose();
      lighting.dispose();
      disposeAuthoredTree(assets.environmentRoot);
      for (const texture of textures) texture.dispose();
      root.clear();
    },
  };
}

export async function createLoadedBlossomEnvironmentWorld(
  options: BlossomEnvironmentWorldOptions & LoadBlossomAssetsOptions
): Promise<BlossomEnvironmentWorld> {
  const assets = await loadBlossomEnvironmentAssets(options);
  return createBlossomEnvironmentWorld(options, assets);
}

export function attachBlossomEnvironmentWorld(
  scene: Scene,
  world: BlossomEnvironmentWorld
): () => void {
  scene.add(world.root);
  if (world.reflector) scene.add(world.reflector);
  return () => {
    scene.remove(world.root);
    if (world.reflector) scene.remove(world.reflector);
  };
}
