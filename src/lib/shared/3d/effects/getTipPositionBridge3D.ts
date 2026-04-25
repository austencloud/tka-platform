import type { ITipPositionBridge3D } from './contracts/ITipPositionBridge3D';
import { TipPositionBridge3D } from './TipPositionBridge3D';

let instance: ITipPositionBridge3D | null = null;
export function getTipPositionBridge3D(): ITipPositionBridge3D {
  return instance ??= new TipPositionBridge3D();
}
