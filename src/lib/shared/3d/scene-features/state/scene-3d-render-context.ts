import { getContext, setContext } from "svelte";
import type { Scene3DRenderState } from "./scene-3d-render-state.svelte";

const SCENE_3D_RENDER_CONTEXT_KEY = Symbol("scene-3d-render-state");

export function setScene3DRenderContext(state: Scene3DRenderState): Scene3DRenderState {
  setContext(SCENE_3D_RENDER_CONTEXT_KEY, state);
  return state;
}

export function getScene3DRenderContext(): Scene3DRenderState | null {
  return getContext<Scene3DRenderState | null>(SCENE_3D_RENDER_CONTEXT_KEY) ?? null;
}
