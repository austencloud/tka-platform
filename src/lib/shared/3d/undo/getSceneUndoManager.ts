import { SceneUndoManager } from "./SceneUndoManager";

let instance: SceneUndoManager | null = null;

export function getSceneUndoManager(): SceneUndoManager {
  return (instance ??= new SceneUndoManager());
}
