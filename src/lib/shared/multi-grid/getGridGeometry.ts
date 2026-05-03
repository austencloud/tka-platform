import { GridGeometry } from './services/implementations/GridGeometry';

let instance: GridGeometry | null = null;
export function getGridGeometry(): GridGeometry {
  return instance ??= new GridGeometry();
}
