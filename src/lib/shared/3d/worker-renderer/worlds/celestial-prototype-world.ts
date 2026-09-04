import { Scene } from "three";

import { CLOUDBREAK_LAYOUT } from "../../environments/scenes/celestial/cloudbreak-layout";
import {
  attachCelestialEnvironmentWorld,
  createLoadedCelestialEnvironmentWorld,
} from "../../environments/worlds/celestial/celestial-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

/** Worker shell around the exact production Olive Cloudbreak world. */
export async function createCelestialPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  const scene = new Scene();
  const world = await createLoadedCelestialEnvironmentWorld({
    renderer: context.renderer,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
    stageRadiusGrowth: 0,
    worldYOffset: 0,
    contentTier: "standard",
    motionScale: 1,
    onProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  const detach = attachCelestialEnvironmentWorld(scene, world);
  scene.fog = world.fog;
  scene.background = world.background;
  context.reportProgress("construct", 1);

  return {
    // The parent catalog integration widens WorkerEnvironmentKey in its owned
    // protocol file. Keep this isolated scene commit independent of that edit.
    environment: "celestial" as WorkerEnvironmentWorld["environment"],
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds, elapsedSeconds) {
      world.update(deltaSeconds, elapsedSeconds, context.camera);
    },
    setPerformers(performers) {
      world.setGroundY(performers[0]?.groundY ?? -1.5);
    },
    pointerDown() {
      world.pulse();
      return null;
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

export const CELESTIAL_PROTOTYPE_CAMERA = {
  position: CLOUDBREAK_LAYOUT.cameraPresets.desktop.position,
  target: CLOUDBREAK_LAYOUT.cameraPresets.desktop.target,
  fov: CLOUDBREAK_LAYOUT.cameraPresets.desktop.fovDegrees,
};
