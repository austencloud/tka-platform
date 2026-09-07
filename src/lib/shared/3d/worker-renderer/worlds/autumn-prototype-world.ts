import { Scene } from "three";

import {
  disposeAutumnEnvironmentAssets,
  loadAutumnEnvironmentAssets,
} from "../../environments/worlds/autumn/autumn-environment-assets";
import { createAutumnEnvironmentWorld } from "../../environments/worlds/autumn/autumn-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

function absoluteAssetUrl(path: string): string {
  return new URL(path, globalThis.location.href).href;
}

function performerPositions(context: WorkerWorldContext) {
  return context.performers.map(({ position }) => ({
    x: position[0],
    z: position[2],
  }));
}

/** Worker lifecycle adapter around the exact shared Autumn production world. */
export async function createAutumnPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  const scene = new Scene();
  const tier = "medium" as const;
  const assets = await loadAutumnEnvironmentAssets({
    renderer: context.renderer,
    resolveAssetUrl: absoluteAssetUrl,
    onEnvironmentProgress: (fraction) =>
      context.reportProgress("assets", fraction),
    onNonfatalAssetError(asset, error) {
      console.warn(`[AutumnWorker] ${asset} failed to load`, error);
    },
  });
  context.reportProgress("assets", 1);

  const world = createAutumnEnvironmentWorld(
    {
      tier,
      groundY: context.performers[0]?.groundY ?? -1.5,
      stageWidth: 6,
      stageDepth: 6,
      stageZOffset: 0,
      showDirectionCues: true,
      performerPositions: performerPositions(context),
      motionScale: 1,
      active: true,
    },
    assets
  );
  scene.add(world.root);
  scene.fog = world.fog;
  scene.background = world.background;
  context.reportProgress("construct", 1);

  return {
    // The catalog owner widens WorkerEnvironmentKey in its own commit.
    environment: "autumn" as WorkerEnvironmentWorld["environment"],
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds, elapsedSeconds) {
      world.update(deltaSeconds, elapsedSeconds, context.camera);
    },
    setPerformers(performers) {
      world.setGroundY(performers[0]?.groundY ?? -1.5);
      world.setPerformers(
        performers.map(({ position }) => ({
          x: position[0],
          z: position[2],
        }))
      );
    },
    pointerMove(ndcX, ndcY) {
      return world.pointerMove(ndcX, ndcY);
    },
    pointerLeave() {
      world.pointerLeave();
    },
    dispose() {
      scene.remove(world.root);
      scene.fog = null;
      scene.background = null;
      world.dispose();
      disposeAutumnEnvironmentAssets(assets);
      scene.clear();
    },
  };
}
