import { CompositeVideoRenderer } from './services/implementations/CompositeVideoRenderer';
import { getImageComposer } from '$lib/shared/render/getImageComposer';
import { getDimensionCalculator as getRenderDimensionCalculator } from '$lib/shared/render/getDimensionCalculator';
import { getLayoutCalculator as getRenderLayoutCalculator } from '$lib/shared/render/getLayoutCalculator';

let instance: CompositeVideoRenderer | null = null;
export function getCompositeVideoRenderer(): CompositeVideoRenderer {
  return instance ??= new CompositeVideoRenderer(
    getImageComposer(),
    getRenderDimensionCalculator(),
    getRenderLayoutCalculator()
  );
}
