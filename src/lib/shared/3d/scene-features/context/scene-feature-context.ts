import { getContext, setContext } from "svelte";
import type { SceneFeatureState } from "../state/scene-feature-state.svelte";

const KEY = Symbol("scene-features");

export function setSceneFeatureContext(state: SceneFeatureState) {
  setContext(KEY, state);
}

export function getSceneFeatureContext(): SceneFeatureState {
  return getContext<SceneFeatureState>(KEY);
}

export function tryGetSceneFeatureContext(): SceneFeatureState | undefined {
  return getContext<SceneFeatureState | undefined>(KEY);
}
