import { SequenceAnimationOrchestrator } from './services/implementations/SequenceAnimationOrchestrator';
import { getAnimationStateManager } from './getAnimationStateManager';
import { getPropInterpolator } from './getPropInterpolator';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getPropInterpolator()
  );
}
