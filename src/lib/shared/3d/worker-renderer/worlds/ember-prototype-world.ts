import { Scene } from "three";
import { QualityTier } from "../../effects/types";
import { createLoadedEmberEnvironmentWorld } from "../../environments/worlds/ember/ember-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

export type EmberPrototypeWorld = Omit<
  WorkerEnvironmentWorld,
  "environment"
> & { environment: "ember" };

/** Worker lifecycle adapter around the exact production Ember world owner. */
export async function createEmberPrototypeWorld(
  context: WorkerWorldContext
): Promise<EmberPrototypeWorld> {
  context.reportProgress("construct", 0.02);
  const scene = new Scene();
  const environment = await createLoadedEmberEnvironmentWorld({
    renderer: context.renderer,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
    qualityTier: QualityTier.HIGH,
    shadows: true,
    reducedMotion: false,
    onProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  scene.add(environment.root);
  scene.fog = environment.fog;
  scene.background = environment.background;
  context.reportProgress("construct", 1);

  return {
    environment: "ember" as EmberPrototypeWorld["environment"],
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds, elapsedSeconds) {
      environment.update(deltaSeconds, elapsedSeconds, context.camera);
    },
    setPerformers(performers) {
      environment.setGroundY(performers[0]?.groundY ?? -1.5);
    },
    dispose() {
      scene.remove(environment.root);
      if (scene.fog === environment.fog) scene.fog = null;
      if (scene.background === environment.background) scene.background = null;
      environment.dispose();
      scene.clear();
    },
  };
}
