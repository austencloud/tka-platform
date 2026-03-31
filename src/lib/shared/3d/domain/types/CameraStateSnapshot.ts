export interface CameraStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  target: { x: number; y: number; z: number };
  timestamp: number;
}
