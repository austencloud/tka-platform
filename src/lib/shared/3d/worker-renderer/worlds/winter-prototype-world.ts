import { Scene, type ColorSpace } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { detectWinterQuality } from "../../environments/scenes/winter/quality/winter-quality";
import { createWinterEnvironmentWorld } from "../../environments/worlds/winter/winter-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";
import { disposeWorkerWorldTree } from "./worker-environment-world";
import {
  createWorkerFlatNormalTexture,
  loadWorkerTexture,
} from "./worker-texture-loader";

export type WinterPrototypeWorld = Omit<
  WorkerEnvironmentWorld,
  "environment"
> & {
  environment: "winter";
};

function absoluteAssetUrl(path: string): string {
  return new URL(path, globalThis.location.href).href;
}

function loadWinterGltf(
  loader: GLTFLoader,
  reportProgress: (loaded: number, total: number) => void
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(
      absoluteAssetUrl("/models/winter/winter-environment.glb"),
      resolve,
      (event) => reportProgress(event.loaded, event.total),
      reject
    );
  });
}

/** Worker adapter for the exact production Moonlit Winter Hollow. */
export async function createWinterPrototypeWorld(
  context: WorkerWorldContext
): Promise<WinterPrototypeWorld> {
  const scene = new Scene();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(absoluteAssetUrl("/basis/"))
    .detectSupport(context.renderer);
  loader.setKTX2Loader(ktx2Loader);

  const texturePaths = [
    "/textures/moon.png",
    "/textures/winter/ice-surface.webp",
    "/textures/winter/ice-roughness.webp",
  ] as const;
  let gltf: GLTF;
  let textureEntries: Array<
    readonly [string, Awaited<ReturnType<typeof loadWorkerTexture>>]
  >;
  try {
    [gltf, textureEntries] = await Promise.all([
      loadWinterGltf(loader, (loaded, total) => {
        context.reportProgress(
          "assets",
          total > 0 ? Math.min(0.9, (loaded / total) * 0.9) : 0
        );
      }),
      Promise.all(
        texturePaths.map(async (path) => {
          const texture = await loadWorkerTexture(absoluteAssetUrl(path));
          return [absoluteAssetUrl(path), texture] as const;
        })
      ).then((entries) => {
        context.reportProgress("assets", 0.95);
        return entries;
      }),
    ]);
  } finally {
    ktx2Loader.dispose();
  }
  context.reportProgress("assets", 1);

  const textures = new Map(textureEntries);
  // These two legacy pond URLs have never shipped in static/. TextureLoader
  // merely logged their failed HTML-image decodes on the main-thread scene;
  // a worker surfaces that as a fatal exception. Neutral normals preserve the
  // material contract without inventing detail or reaching for a missing file.
  textures.set(
    absoluteAssetUrl("/textures/water/Water_1_M_Normal.jpg"),
    createWorkerFlatNormalTexture()
  );
  textures.set(
    absoluteAssetUrl("/textures/water/Water_2_M_Normal.jpg"),
    createWorkerFlatNormalTexture()
  );

  const environment = createWinterEnvironmentWorld({
    environmentRoot: gltf.scene,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
    deviceTier: detectWinterQuality(context.renderer),
    outputColorSpace: context.renderer.outputColorSpace as ColorSpace,
    assetUrl: absoluteAssetUrl,
    loadTexture(url) {
      const texture = textures.get(url);
      if (!texture) {
        throw new Error(`Winter worker texture was not preloaded: ${url}`);
      }
      return texture;
    },
  });
  scene.add(environment.root);
  scene.fog = environment.fog;
  scene.background = environment.background;
  context.reportProgress("construct", 1);
  await Promise.resolve();

  return {
    environment: "winter",
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds) {
      environment.update(deltaSeconds, context.camera);
    },
    setPerformers(performers) {
      environment.setGroundY(performers[0]?.groundY ?? -1.5);
    },
    dispose() {
      scene.remove(environment.root);
      scene.fog = null;
      scene.background = null;
      environment.dispose();
      disposeWorkerWorldTree(gltf.scene);
      scene.clear();
    },
  };
}
