import { Scene } from "three";
import { createCosmicEnvironmentWorld } from "../../environments/worlds/cosmic/cosmic-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

export type CosmicPrototypeWorld = Omit<
  WorkerEnvironmentWorld,
  "environment"
> & { environment: "cosmic" };

/** Worker lifecycle adapter around the exact production Cosmic world owner. */
export async function createCosmicPrototypeWorld(
  context: WorkerWorldContext
): Promise<CosmicPrototypeWorld> {
  context.reportProgress("construct", 0.02);
  const scene = new Scene();
  const environment = await createCosmicEnvironmentWorld({
    renderer: context.renderer,
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
    onAssetProgress: (fraction) => context.reportProgress("assets", fraction),
  });
  scene.add(environment.root);
  scene.fog = environment.fog;
  await environment.audienceReady.catch(() => undefined);
  context.reportProgress("construct", 1);

  return {
    environment: "cosmic",
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
      environment.dispose();
      scene.clear();
    },
  };
}

export const COSMIC_PROTOTYPE_CAMERA = {
  position: [0, 4.2, 17] as const,
  target: [0, 1.1, -1] as const,
  fov: 48,
};
