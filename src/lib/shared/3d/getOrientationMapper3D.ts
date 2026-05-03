import { OrientationMapper } from '$lib/shared/3d/services/implementations/OrientationMapper';

let instance: OrientationMapper | null = null;

export function getOrientationMapper3D(): OrientationMapper {
  return instance ??= new OrientationMapper();
}
