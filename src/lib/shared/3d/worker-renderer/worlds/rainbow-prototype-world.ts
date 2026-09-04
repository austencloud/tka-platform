import { Scene } from "three";
import { createRainbowEnvironmentWorld } from "../../environments/worlds/rainbow/rainbow-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

/**
 * Worker adapter for the production Rainbow world.
 *
 * The scene graph, shaders, particle behavior, lighting, fog, and disposal all
 * come from the same factory used by RainbowScene.svelte. This adapter owns only
 * worker-specific camera and lifecycle wiring.
 */
export async function createRainbowPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  context.reportProgress("construct", 0.05);
  const scene = new Scene();
  const environment = createRainbowEnvironmentWorld({
    groundY: -1.5,
    stageRadius: 3,
  });
  scene.add(environment.root);
  scene.fog = environment.fog;
  context.reportProgress("construct", 1);
  await Promise.resolve();

  return {
    environment: "rainbow",
    scene,
    update(deltaSeconds, elapsedSeconds) {
      environment.update(deltaSeconds, elapsedSeconds, context.camera);
    },
    dispose() {
      scene.remove(environment.root);
      scene.fog = null;
      environment.dispose();
      scene.clear();
    },
  };
}

export const RAINBOW_PROTOTYPE_CAMERA = {
  position: [0, 4.2, 17] as const,
  target: [0, 1.1, -1] as const,
  fov: 48,
};
