import type { Vector3 } from "three";

export interface CursorRay {
  origin: Vector3;
  dir: Vector3;
  active: boolean;
}
