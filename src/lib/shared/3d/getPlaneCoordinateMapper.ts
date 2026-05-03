import { PlaneCoordinateMapper } from './services/implementations/PlaneCoordinateMapper';

let instance: PlaneCoordinateMapper | null = null;
export function getPlaneCoordinateMapper(): PlaneCoordinateMapper {
  return instance ??= new PlaneCoordinateMapper();
}
