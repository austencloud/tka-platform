import type { WebGLRenderer, Scene } from "three";
import type { CameraStateSnapshot } from "./CameraStateSnapshot";

export interface Viewer3DExportHooks {
  getRenderer(): WebGLRenderer | null;
  getCameraState(): CameraStateSnapshot;
  onCameraStateChange(callback: (state: CameraStateSnapshot) => void): () => void;
  renderAtStep(step: number): void;
  getScene(): Scene | null;
}
