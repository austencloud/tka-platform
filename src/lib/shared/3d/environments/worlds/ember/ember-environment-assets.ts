import {
  ImageBitmapLoader,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  type Object3D,
  type WebGLRenderer,
} from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  EMBER_GROUND_DETAIL_MASK,
  EMBER_GROUND_DETAIL_TEXTURES,
  EMBER_GROUND_SURFACE_TEXTURES,
  type EmberGroundDetailFamily,
  type EmberGroundSurfaceDetailMaps,
} from "../../scenes/ember/ember-ground-detail";

export const EMBER_PRODUCTION_SLICE_URL =
  "/models/ember/ember-production-slice.glb" as const;
export const EMBER_LOG_URL = "/models/camping/tree-log.glb" as const;
export const EMBER_SMALL_LOG_URL =
  "/models/camping/tree-log-small.glb" as const;
export const EMBER_CAMPFIRE_URL = "/models/camping/campfire-pit.glb" as const;
export const EMBER_SKY_MOON_TEXTURE_URL = "/textures/moon.png" as const;

export const EMBER_AUTHORED_RESOURCE_URLS = [
  EMBER_PRODUCTION_SLICE_URL,
  EMBER_LOG_URL,
  EMBER_SMALL_LOG_URL,
  EMBER_CAMPFIRE_URL,
  EMBER_SKY_MOON_TEXTURE_URL,
  ...Object.values(EMBER_GROUND_DETAIL_TEXTURES),
  ...Object.values(EMBER_GROUND_SURFACE_TEXTURES),
  EMBER_GROUND_DETAIL_MASK,
] as const;

export interface EmberEnvironmentAssets {
  productionSlice: Object3D;
  largeLog: Object3D;
  smallLog: Object3D;
  campfire: Object3D;
  skyMoonTexture: Texture;
  detailMaps: Record<EmberGroundDetailFamily, Texture>;
  surfaceMaps: EmberGroundSurfaceDetailMaps;
  familyMask: Texture;
}

export interface LoadEmberEnvironmentAssetsOptions {
  renderer: WebGLRenderer;
  resolveAssetUrl?: (path: string) => string;
  onProgress?: (fraction: number) => void;
}

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

/** Load the exact GLBs and support maps requested by the production adapter. */
export async function loadEmberEnvironmentAssets(
  options: LoadEmberEnvironmentAssetsOptions
): Promise<EmberEnvironmentAssets> {
  const resolveAssetUrl = options.resolveAssetUrl ?? defaultAssetUrl;
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const dracoLoader = new DRACOLoader().setDecoderPath(
    resolveAssetUrl("/draco/")
  );
  const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(resolveAssetUrl("/basis/"))
    .detectSupport(options.renderer);
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);
  const bitmapLoader = new ImageBitmapLoader();
  bitmapLoader.setOptions({ imageOrientation: "flipY" });
  const loadedTextures = new Set<Texture>();
  let completed = 0;
  const finish = <T>(value: T): T => {
    if (value instanceof Texture) loadedTextures.add(value);
    completed += 1;
    options.onProgress?.(completed / EMBER_AUTHORED_RESOURCE_URLS.length);
    return value;
  };

  try {
    const [
      productionSlice,
      largeLog,
      smallLog,
      campfire,
      skyMoonTexture,
      youngLava,
      ironContact,
      fracturedBasalt,
      shelteredAsh,
      height,
      familyMask,
    ] = await Promise.all([
      loadGltf(gltfLoader, resolveAssetUrl(EMBER_PRODUCTION_SLICE_URL)).then(
        finish
      ),
      loadGltf(gltfLoader, resolveAssetUrl(EMBER_LOG_URL)).then(finish),
      loadGltf(gltfLoader, resolveAssetUrl(EMBER_SMALL_LOG_URL)).then(finish),
      loadGltf(gltfLoader, resolveAssetUrl(EMBER_CAMPFIRE_URL)).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_SKY_MOON_TEXTURE_URL)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_DETAIL_TEXTURES.youngLava)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_DETAIL_TEXTURES.ironContact)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_DETAIL_TEXTURES.fracturedBasalt)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_DETAIL_TEXTURES.shelteredAsh)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_SURFACE_TEXTURES.height)
      ).then(finish),
      loadBitmapTexture(
        bitmapLoader,
        resolveAssetUrl(EMBER_GROUND_DETAIL_MASK)
      ).then(finish),
    ]);

    skyMoonTexture.colorSpace = SRGBColorSpace;
    const detailMaps = {
      youngLava,
      ironContact,
      fracturedBasalt,
      shelteredAsh,
    } satisfies Record<EmberGroundDetailFamily, Texture>;
    for (const texture of Object.values(detailMaps)) {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = Math.min(
        8,
        options.renderer.capabilities.getMaxAnisotropy()
      );
      texture.needsUpdate = true;
    }
    height.colorSpace = NoColorSpace;
    height.wrapS = RepeatWrapping;
    height.wrapT = RepeatWrapping;
    height.anisotropy = Math.min(
      8,
      options.renderer.capabilities.getMaxAnisotropy()
    );
    height.needsUpdate = true;
    familyMask.colorSpace = NoColorSpace;
    familyMask.needsUpdate = true;

    return {
      productionSlice: productionSlice.scene,
      largeLog: largeLog.scene,
      smallLog: smallLog.scene,
      campfire: campfire.scene,
      skyMoonTexture,
      detailMaps,
      surfaceMaps: { height },
      familyMask,
    };
  } catch (error) {
    for (const texture of loadedTextures) texture.dispose();
    throw error;
  } finally {
    dracoLoader.dispose();
    ktx2Loader.dispose();
  }
}
