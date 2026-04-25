import type { IOrientationMapper } from './services/contracts/IOrientationMapper';
import { OrientationMapper } from './services/implementations/OrientationMapper';

let instance: IOrientationMapper | null = null;
export function getOrientationMapper(): IOrientationMapper {
  return instance ??= new OrientationMapper();
}
