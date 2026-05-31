import { TipPositionBridge3D } from './tip-position-bridge-3d';

let instance: TipPositionBridge3D | null = null;
export function getTipPositionBridge3D(): TipPositionBridge3D {
  return instance ??= new TipPositionBridge3D();
}
