import { Scene, type Texture } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { QualityTier } from "../../effects/types";
import { createDefaultForestFireflyConfig } from "../../environments/domain/models/scene-configs";
import {
  createForestEnvironmentWorld,
  FOREST_ENVIRONMENT_ASSET_URLS,
} from "../../environments/worlds/forest/forest-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";
import { disposeWorkerWorldTree } from "./worker-environment-world";
import { loadWorkerTexture } from "./worker-texture-loader";

export type ForestPrototypeWorld = Omit<
  WorkerEnvironmentWorld,
  "environment"
> & {
  environment: "forest";
};

function absoluteAssetUrl(path: string): string {
  return new URL(path, globalThis.location.href).href;
}

function loadGltf(
  loader: GLTFLoader,
  path: string,
  progress: (loaded: number, total: number) => void
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(
      absoluteAssetUrl(path),
      resolve,
      (event) => progress(event.loaded, event.total),
      reject
    );
  });
}

/** Worker adapter for the exact production Moonlit Forest Clearing. */
export async function createForestPrototypeWorld(
  context: WorkerWorldContext
): Promise<ForestPrototypeWorld> {
  const scene = new Scene();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader().setDecoderPath(absoluteAssetUrl("/draco/"));
  loader.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader()
    .setTranscoderPath(absoluteAssetUrl("/basis/"))
    .detectSupport(context.renderer);
  loader.setKTX2Loader(ktx2);
  const paths = [
    FOREST_ENVIRONMENT_ASSET_URLS.environment,
    FOREST_ENVIRONMENT_ASSET_URLS.nearFrame,
    FOREST_ENVIRONMENT_ASSET_URLS.campsite,
    FOREST_ENVIRONMENT_ASSET_URLS.stage,
  ] as const;
  const loaded = paths.map(() => 0);
  const totals = paths.map(() => 0);
  const report = (index: number, value: number, total: number) => {
    loaded[index] = value;
    totals[index] = total;
    const knownTotal = totals.reduce((sum, size) => sum + size, 0);
    const knownLoaded = loaded.reduce((sum, size) => sum + size, 0);
    context.reportProgress(
      "assets",
      knownTotal > 0 ? Math.min(0.94, knownLoaded / knownTotal) : 0
    );
  };

  let gltfs: GLTF[];
  let moonTexture: Texture;
  try {
    [gltfs, moonTexture] = await Promise.all([
      Promise.all(
        paths.map((path, index) =>
          loadGltf(loader, path, (loadedBytes, totalBytes) =>
            report(index, loadedBytes, totalBytes)
          )
        )
      ),
      loadWorkerTexture(absoluteAssetUrl(FOREST_ENVIRONMENT_ASSET_URLS.moon)),
    ]);
  } finally {
    draco.dispose();
    ktx2.dispose();
  }
  context.reportProgress("assets", 1);

  const [environment, nearFrame, campsite, stage] = gltfs;
  if (!environment || !nearFrame || !campsite || !stage) {
    throw new Error("Forest worker did not receive every production GLB");
  }
  const world = createForestEnvironmentWorld({
    assets: {
      environmentRoot: environment.scene,
      nearFrameRoot: nearFrame.scene,
      campsiteRoot: campsite.scene,
      stageRoot: stage.scene,
      moonTexture,
    },
    renderer: context.renderer,
    config: createDefaultForestFireflyConfig(),
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageWidth: 6,
    stageDepth: 4.5,
    stageZOffset: 0,
    showStage: true,
    showTents: true,
    showCampfire: true,
    shadowsEnabled: true,
    qualityTier: QualityTier.MEDIUM,
    assetUrl: absoluteAssetUrl,
    loadTexture: loadWorkerTexture,
  });
  scene.add(world.root);
  scene.fog = world.fog;
  await world.ready;
  context.reportProgress("construct", 1);

  return {
    environment: "forest",
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds) {
      world.update(deltaSeconds, context.camera);
    },
    setPerformers(performers) {
      world.setGroundY(performers[0]?.groundY ?? -1.5);
    },
    dispose() {
      scene.remove(world.root);
      scene.fog = null;
      world.dispose();
      for (const gltf of gltfs) disposeWorkerWorldTree(gltf.scene);
      moonTexture.dispose();
      scene.clear();
    },
  };
}

export const FOREST_PROTOTYPE_CAMERA = {
  position: [0, 4.6, 19] as const,
  target: [0, 1.3, -1.5] as const,
  fov: 46,
};
