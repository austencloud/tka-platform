import { CompositeVideoRenderer } from '$lib/shared/animation-engine/services/composite-video-renderer';
import { getImageComposer } from '$lib/shared/render/get-image-composer';

let instance: CompositeVideoRenderer | null = null;
export function getCompositeVideoRenderer(): CompositeVideoRenderer {
  return instance ??= new CompositeVideoRenderer(
    getImageComposer()
  );
}
