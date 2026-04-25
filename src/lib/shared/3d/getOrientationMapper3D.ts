import type { IOrientationMapper } from '$lib/shared/3d/services/contracts/IOrientationMapper';
import { OrientationMapper } from '$lib/shared/3d/services/implementations/OrientationMapper';

let instance: IOrientationMapper | null = null;

export function getOrientationMapper3D(): IOrientationMapper {
  return instance ??= new OrientationMapper();
}
