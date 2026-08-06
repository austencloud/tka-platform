import { getContext, setContext } from "svelte";
import type { SceneEffectsManager3D } from "./scene-effects-manager-3d";

const SCENE_EFFECTS_CONTEXT_KEY = Symbol("scene-effects-manager-3d");

export function setSceneEffectsContext(
  manager: SceneEffectsManager3D
): SceneEffectsManager3D {
  setContext(SCENE_EFFECTS_CONTEXT_KEY, manager);
  return manager;
}

export function getSceneEffectsContext(): SceneEffectsManager3D | null {
  return (
    getContext<SceneEffectsManager3D | null>(SCENE_EFFECTS_CONTEXT_KEY) ?? null
  );
}
