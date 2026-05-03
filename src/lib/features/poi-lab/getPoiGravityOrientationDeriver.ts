import { PoiGravityOrientationDeriver } from './services/implementations/PoiGravityOrientationDeriver';

let instance: PoiGravityOrientationDeriver | null = null;
export function getPoiGravityOrientationDeriver(): PoiGravityOrientationDeriver {
  return instance ??= new PoiGravityOrientationDeriver();
}
