import type { ICoordinateUpdater } from './services/contracts/ICoordinateUpdater';
import { CoordinateUpdater } from './services/implementations/CoordinateUpdater';

let instance: ICoordinateUpdater | null = null;
export function getCoordinateUpdater(): ICoordinateUpdater {
  return instance ??= new CoordinateUpdater();
}
