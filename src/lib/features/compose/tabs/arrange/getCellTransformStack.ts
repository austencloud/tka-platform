import { CellTransformStack } from './services/implementations/CellTransformStack';

let instance: CellTransformStack | null = null;
export function getCellTransformStack(): CellTransformStack {
  return instance ??= new CellTransformStack();
}
