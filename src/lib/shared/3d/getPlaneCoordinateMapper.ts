import type { IPlaneCoordinateMapper } from './services/contracts/IPlaneCoordinateMapper';
import { PlaneCoordinateMapper } from './services/implementations/PlaneCoordinateMapper';

let instance: IPlaneCoordinateMapper | null = null;
export function getPlaneCoordinateMapper(): IPlaneCoordinateMapper {
  return instance ??= new PlaneCoordinateMapper();
}
