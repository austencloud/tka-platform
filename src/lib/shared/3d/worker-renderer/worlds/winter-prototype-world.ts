import { Scene } from "three";
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

  let gltf: GLTF;
  try {
    gltf = await loadWinterGltf(loader, (loaded, total) => {
      context.reportProgress(
        "assets",
        total > 0 ? Math.min(0.95, loaded / total) : 0
      );
    });
  } finally {
    ktx2Loader.dispose();
  }
  context.reportProgress("assets", 1);

  const environment = createWinterEnvironmentWorld({
    environmentRoot: gltf.scene,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
    deviceTier: detectWinterQuality(context.renderer),
    outputColorSpace: context.renderer.outputColorSpace,
    assetUrl: absoluteAssetUrl,
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

export const WINTER_PROTOTYPE_CAMERA = {
  position: [0, 4.2, 17] as const,
  target: [0, 1.1, -1] as const,
  fov: 48,
};
