import { Scene } from "three";
import { BackgroundType } from "@austencloud/backgrounds";
import { getStageCoordinateFrame } from "../../environments/domain/stage-coordinate-frame";
import {
  getPerformerStageBounds,
  getCanonicalPerformerStageBounds,
  getAddedPerformerStageGrowth,
} from "../../environments/domain/performer-stage-bounds";

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
    worldYOffset: getStageCoordinateFrame(BackgroundType.CELESTIAL, true)
      .environmentYOffset,
    contentTier: "standard",
    motionScale: context.reducedMotion ? 0 : 1,
    onProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  function setPerformers(performers: WorkerWorldContext["performers"]) {
    const bounds = getPerformerStageBounds(
      performers.map(({ position }) => ({ x: position[0], z: position[2] }))
    );
    const canonical = getCanonicalPerformerStageBounds(performers.length);
    world.setGroundY(performers[0]?.groundY ?? -1.5);
    world.setStageBounds(
      Math.max(bounds.radius, canonical.radius),
      getAddedPerformerStageGrowth(performers.length)
    );
  }
  setPerformers(context.performers);
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
    setPerformers,
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
