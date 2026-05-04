import { CompositeVideoRenderer } from './services/implementations/CompositeVideoRenderer';
import { getImageComposer } from '$lib/shared/render/getImageComposer';

let instance: CompositeVideoRenderer | null = null;
export function getCompositeVideoRenderer(): CompositeVideoRenderer {
  return instance ??= new CompositeVideoRenderer(
    getImageComposer()
  );
}
