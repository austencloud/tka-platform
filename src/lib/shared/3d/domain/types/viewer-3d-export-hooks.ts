import type { WebGLRenderer, Scene } from "three";
import type { CameraStateSnapshot } from "@austencloud/scene-3d";

export interface Viewer3DExportHooks {
  getRenderer(): WebGLRenderer | null;
  getCameraState(): CameraStateSnapshot;
  onCameraStateChange(callback: (state: CameraStateSnapshot) => void): () => void;
  renderAtStep(step: number): void;
  getScene(): Scene | null;
}
