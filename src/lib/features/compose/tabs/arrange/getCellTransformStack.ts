import type { ICellTransformStack } from './services/contracts/ICellTransformStack';
import { CellTransformStack } from './services/implementations/CellTransformStack';
import { getArrangeLayerTransformer } from './getArrangeLayerTransformer';

let instance: ICellTransformStack | null = null;
export function getCellTransformStack(): ICellTransformStack {
  return instance ??= new CellTransformStack(getArrangeLayerTransformer());
}
