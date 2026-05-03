
import { ArrangeLayerTransformer } from './services/implementations/ArrangeLayerTransformer';

let instance: ArrangeLayerTransformer | null = null;
export function getArrangeLayerTransformer(): ArrangeLayerTransformer {
  return instance ??= new ArrangeLayerTransformer();
}
