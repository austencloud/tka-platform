import { SequenceAnimationOrchestrator } from './services/implementations/SequenceAnimationOrchestrator';
import { getAnimationStateManager } from './getAnimationStateManager';
import { getStepCalculator } from './getStepCalculator';
import { getPropInterpolator } from './getPropInterpolator';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getStepCalculator(),
    getPropInterpolator()
  );
}
