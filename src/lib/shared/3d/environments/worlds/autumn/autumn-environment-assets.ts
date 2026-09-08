import {
  DefaultLoadingManager,
  ImageBitmapLoader,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import type {
  AutumnBootAsset,
  AutumnBootStatus,
} from "../../scenes/autumn/runtime/autumn-boot-state";
import { createAutumnEnvironmentTransport } from "../../scenes/autumn/runtime/autumn-environment-transport";
import {
  startAutumnEnvironmentRequest,
  type AutumnEnvironmentFailure,
} from "../../scenes/autumn/runtime/autumn-environment-request";
import { AUTUMN_MOON_TEXTURE_URL } from "../../scenes/autumn/runtime/lighting/autumn-moon";
import { disposeSceneGraph } from "../../utils/dispose-scene";

export const AUTUMN_ENVIRONMENT_URL =
  "/models/autumn/autumn-environment.glb" as const;
export const AUTUMN_GROUND_DETAIL_URL =
  "/textures/autumn-floor/ground-detail-modulation.ktx2" as const;

export interface AutumnEnvironmentAssets {
  environment: Object3D;
  groundDetailMap: Texture | null;
  moonTexture: Texture | null;
}

export function disposeAutumnEnvironmentAssets(
  assets: AutumnEnvironmentAssets
): void {
  disposeSceneGraph(assets.environment);
  assets.groundDetailMap?.dispose();
  assets.moonTexture?.dispose();
}

export interface LoadAutumnEnvironmentAssetsOptions {
  renderer: WebGLRenderer;
  retryRequest?: number;
  signal?: AbortSignal;
  resolveAssetUrl?: (path: string) => string;
  onEnvironmentProgress?: (fraction: number) => void;
  onAssetStatus?: (
    asset: Exclude<AutumnBootAsset, "pondNormals">,
    status: AutumnBootStatus
  ) => void;
  onNonfatalAssetError?: (
    asset: "groundDetail" | "moon",
    error: unknown
  ) => void;
}

export class AutumnEnvironmentLoadError extends Error {
  readonly failure: AutumnEnvironmentFailure;

  constructor(failure: AutumnEnvironmentFailure) {
    super(failure.message);
    this.name = "AutumnEnvironmentLoadError";
    this.failure = failure;
  }
}

function defaultAssetUrl(path: string): string {
  if (typeof globalThis.location === "undefined") return path;
  return new URL(path, globalThis.location.href).href;
}

function loadBitmapTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    new ImageBitmapLoader().setOptions({ imageOrientation: "flipY" }).load(
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

function loadRequestedEnvironment(options: {
  retryRequest: number;
  signal?: AbortSignal;
  load: ReturnType<typeof createAutumnEnvironmentTransport>;
  resolveAssetUrl(path: string): string;
  onProgress?: (fraction: number) => void;
}): Promise<Object3D> {
  return new Promise((resolve, reject) => {
    let completed = false;
    const externalSignal = options.signal;
    const cancel = startAutumnEnvironmentRequest({
      retryRequest: options.retryRequest,
      load: (url, onProgress, signal) =>
        options.load(
          options.resolveAssetUrl(url),
          (progress) => {
            onProgress(progress);
            if (progress.total && progress.total > 0) {
              options.onProgress?.(
                Math.min(0.99, progress.loaded / progress.total)
              );
            }
          },
          signal
        ),
      onReady: (loaded) => {
        completed = true;
        externalSignal?.removeEventListener("abort", abort);
        options.onProgress?.(1);
        resolve(loaded.scene);
      },
      onDiscard: (loaded) => disposeSceneGraph(loaded.scene),
      onFailure: (failure) => {
        completed = true;
        externalSignal?.removeEventListener("abort", abort);
        reject(new AutumnEnvironmentLoadError(failure));
      },
    });

    function abort(): void {
      if (completed) return;
      completed = true;
      cancel();
      reject(
        externalSignal?.reason ?? new DOMException("Aborted", "AbortError")
      );
    }

    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Loads the exact authored Autumn GLB and its two auxiliary textures for either
 * renderer. The GLB retains Autumn's dedicated abortable LoadingManager while
 * sharing Meshopt and KTX2 decoder configuration across both adapters.
 */
export async function loadAutumnEnvironmentAssets(
  options: LoadAutumnEnvironmentAssetsOptions
): Promise<AutumnEnvironmentAssets> {
  const resolveAssetUrl = options.resolveAssetUrl ?? defaultAssetUrl;
  const retryRequest = options.retryRequest ?? 0;
  const ktx2 = new KTX2Loader(DefaultLoadingManager)
    .setTranscoderPath(resolveAssetUrl("/basis/"))
    .detectSupport(options.renderer);
  const loadAutumnEnvironment = createAutumnEnvironmentTransport((loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.setKTX2Loader(ktx2);
  });

  options.onAssetStatus?.("environment", "pending");
  options.onAssetStatus?.("groundDetail", "pending");

  const environmentPromise = loadRequestedEnvironment({
    retryRequest,
    signal: options.signal,
    load: loadAutumnEnvironment,
    resolveAssetUrl,
    onProgress: options.onEnvironmentProgress,
  }).then((environment) => {
    options.onAssetStatus?.("environment", "ready");
    return environment;
  });

  const retrySuffix = retryRequest > 0 ? `?retry=${retryRequest}` : "";
  const groundPromise = ktx2
    .loadAsync(resolveAssetUrl(`${AUTUMN_GROUND_DETAIL_URL}${retrySuffix}`))
    .then((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = Math.min(
        8,
        options.renderer.capabilities.getMaxAnisotropy()
      );
      texture.needsUpdate = true;
      options.onAssetStatus?.("groundDetail", "ready");
      return texture;
    })
    .catch((error: unknown) => {
      options.onAssetStatus?.("groundDetail", "failed");
      options.onNonfatalAssetError?.("groundDetail", error);
      return null;
    });

  const moonPromise = loadBitmapTexture(
    resolveAssetUrl(AUTUMN_MOON_TEXTURE_URL)
  ).catch((error: unknown) => {
    options.onNonfatalAssetError?.("moon", error);
    return null;
  });

  const [environmentResult, groundResult, moonResult] =
    await Promise.allSettled([environmentPromise, groundPromise, moonPromise]);
  ktx2.dispose();

  if (environmentResult.status === "rejected") {
    options.onAssetStatus?.("environment", "failed");
    if (groundResult.status === "fulfilled") groundResult.value?.dispose();
    if (moonResult.status === "fulfilled") moonResult.value?.dispose();
    throw environmentResult.reason;
  }

  return {
    environment: environmentResult.value,
    groundDetailMap:
      groundResult.status === "fulfilled" ? groundResult.value : null,
    moonTexture: moonResult.status === "fulfilled" ? moonResult.value : null,
  };
}
