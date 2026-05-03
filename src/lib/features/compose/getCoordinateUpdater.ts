import { CoordinateUpdater } from './services/implementations/CoordinateUpdater';

let instance: CoordinateUpdater | null = null;
export function getCoordinateUpdater(): CoordinateUpdater {
  return instance ??= new CoordinateUpdater();
}
