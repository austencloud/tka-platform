import { Scene } from "three";
import { createLoadedRainbowEnvironmentWorld } from "../../environments/worlds/rainbow/rainbow-environment-world";
import {
  getCanonicalPerformerStageBounds,
  getPerformerStageBounds,
  getAddedPerformerStageGrowth,
} from "../../environments/domain/performer-stage-bounds";
import { getStageCoordinateFrame } from "../../environments/domain/stage-coordinate-frame";
import { BackgroundType } from "@austencloud/backgrounds";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

export async function createRainbowPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  const scene = new Scene();
  const environment = await createLoadedRainbowEnvironmentWorld({
    groundY: context.performers[0]?.groundY ?? -1.5,
    motionScale: context.reducedMotion ? 0 : 1,
    onProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  function setPerformers(performers: WorkerWorldContext["performers"]) {
    const bounds = getPerformerStageBounds(
      performers.map(({ position }) => ({ x: position[0], z: position[2] }))
    );
    const canonical = getCanonicalPerformerStageBounds(performers.length);
    environment.setLayout(
      performers[0]?.groundY ?? -1.5,
      Math.max(bounds.radius, canonical.radius),
      getAddedPerformerStageGrowth(performers.length),
      getStageCoordinateFrame(BackgroundType.PRIDE, true).environmentYOffset
    );
  }
  setPerformers(context.performers);
  scene.add(environment.root);
  scene.fog = environment.fog;
  scene.background = environment.background;
  context.reportProgress("construct", 1);
  return {
    environment: "rainbow",
    scene,
    setPerformers,
    update(deltaSeconds, elapsedSeconds) {
      environment.update(deltaSeconds, elapsedSeconds, context.camera);
    },
    dispose() {
      scene.remove(environment.root);
      scene.fog = null;
      scene.background = null;
      environment.dispose();
      scene.clear();
    },
  };
}

export const RAINBOW_PROTOTYPE_CAMERA = {
  position: [0, 3.8, 19] as const,
  target: [0, 1.8, -1] as const,
  fov: 52,
};
