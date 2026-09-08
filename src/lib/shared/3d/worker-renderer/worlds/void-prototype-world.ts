import { Scene } from "three";
import { createVoidEnvironmentWorld } from "../../environments/worlds/void/void-environment-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldContext,
} from "./worker-environment-world";

/** Worker adapter for the exact production Void environment. */
export async function createVoidPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  context.reportProgress("construct", 0.05);
  const scene = new Scene();
  const environment = createVoidEnvironmentWorld({
    groundY: context.performers[0]?.groundY ?? -1.5,
    stageRadius: 3,
  });
  scene.add(environment.root);
  context.reportProgress("construct", 1);
  await Promise.resolve();

  return {
    environment: "void",
    scene,
    useViewerBaseLighting: false,
    update(deltaSeconds) {
      environment.update(deltaSeconds);
    },
    dispose() {
      scene.remove(environment.root);
      environment.dispose();
      scene.clear();
    },
  };
}

export const VOID_PROTOTYPE_CAMERA = {
  position: [0, 4.2, 17] as const,
  target: [0, 1.1, -1] as const,
  fov: 48,
};
