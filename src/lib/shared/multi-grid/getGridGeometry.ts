import type { IGridGeometry } from './services/contracts/IGridGeometry';
import { GridGeometry } from './services/implementations/GridGeometry';

let instance: IGridGeometry | null = null;
export function getGridGeometry(): IGridGeometry {
  return instance ??= new GridGeometry();
}
