import type { IArrangeLayerTransformer } from './services/contracts/IArrangeLayerTransformer';
import { ArrangeLayerTransformer } from './services/implementations/ArrangeLayerTransformer';

let instance: IArrangeLayerTransformer | null = null;
export function getArrangeLayerTransformer(): IArrangeLayerTransformer {
  return instance ??= new ArrangeLayerTransformer();
}
