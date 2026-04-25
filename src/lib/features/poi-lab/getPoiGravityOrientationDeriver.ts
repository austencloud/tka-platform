import type { IPoiGravityOrientationDeriver } from './services/contracts/IPoiGravityOrientationDeriver';
import { PoiGravityOrientationDeriver } from './services/implementations/PoiGravityOrientationDeriver';

let instance: IPoiGravityOrientationDeriver | null = null;
export function getPoiGravityOrientationDeriver(): IPoiGravityOrientationDeriver {
  return instance ??= new PoiGravityOrientationDeriver();
}
