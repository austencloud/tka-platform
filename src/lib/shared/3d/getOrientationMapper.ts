import { OrientationMapper } from './services/implementations/OrientationMapper';

let instance: OrientationMapper | null = null;
export function getOrientationMapper(): OrientationMapper {
  return instance ??= new OrientationMapper();
}
