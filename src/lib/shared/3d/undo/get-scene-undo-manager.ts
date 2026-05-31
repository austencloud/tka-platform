import { SceneUndoManager } from "./scene-undo-manager";

let instance: SceneUndoManager | null = null;

export function getSceneUndoManager(): SceneUndoManager {
  return (instance ??= new SceneUndoManager());
}
