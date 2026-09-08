import { Scene } from "three";

import { detectBlossomQuality } from "../../environments/scenes/cherry-blossom/blossom-runtime";
import {
  attachBlossomEnvironmentWorld,
  createLoadedBlossomEnvironmentWorld,
} from "../../environments/worlds/blossom/blossom-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

function absoluteAssetUrl(path: string): string {
  return new URL(path, globalThis.location.href).href;
}

function getGpuRendererName(context: WorkerWorldContext): string {
  const gl = context.renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : "";
}

/** Worker shell around the exact production Moonlit Hanami Garden. */
export async function createBlossomPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  const scene = new Scene();
  const world = await createLoadedBlossomEnvironmentWorld({
    renderer: context.renderer,
    resolveAssetUrl: absoluteAssetUrl,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageWidth: 6,
    stageDepth: 6,
    stageZOffset: 0,
    showDirectionCues: true,
    qualityTier: detectBlossomQuality({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      hardwareConcurrency:
        typeof navigator === "undefined"
          ? 8
          : (navigator.hardwareConcurrency ?? 4),
      gpuRenderer: getGpuRendererName(context),
    }),
    reducedMotion: false,
    onProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  const detach = attachBlossomEnvironmentWorld(scene, world);
  scene.fog = world.fog;
  scene.background = world.background;
  context.reportProgress("construct", 1);

  return {
    // The parent catalog integration widens WorkerEnvironmentKey in its owned
    // protocol file. Keep this isolated scene commit independent of that edit.
    environment: "blossom" as WorkerEnvironmentWorld["environment"],
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds) {
      world.update(deltaSeconds, context.camera);
    },
    setPerformers(performers) {
      world.setGroundY(performers[0]?.groundY ?? -1.5);
    },
    dispose() {
      detach();
      scene.fog = null;
      scene.background = null;
      world.dispose();
      scene.clear();
    },
  };
}
