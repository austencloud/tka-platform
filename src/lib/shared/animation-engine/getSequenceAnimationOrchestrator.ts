import { SequenceAnimationOrchestrator } from '$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator';
import { getAnimationStateManager } from '$lib/shared/animation-engine/getAnimationStateManager';
import { getPropInterpolator } from '$lib/shared/animation-engine/getPropInterpolator';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getPropInterpolator()
  );
}
