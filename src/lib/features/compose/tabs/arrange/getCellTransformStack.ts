import { CellTransformStack } from './services/implementations/CellTransformStack';
import { getArrangeLayerTransformer } from './getArrangeLayerTransformer';

let instance: CellTransformStack | null = null;
export function getCellTransformStack(): CellTransformStack {
  return instance ??= new CellTransformStack(getArrangeLayerTransformer());
}
