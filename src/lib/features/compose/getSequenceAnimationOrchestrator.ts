import type { ISequenceAnimationOrchestrator } from './services/contracts/ISequenceAnimationOrchestrator';
import { SequenceAnimationOrchestrator } from './services/implementations/SequenceAnimationOrchestrator';
import { getAnimationStateManager } from './getAnimationStateManager';
import { getStepCalculator } from './getStepCalculator';
import { getPropInterpolator } from './getPropInterpolator';

let instance: ISequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): ISequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getStepCalculator(),
    getPropInterpolator()
  );
}
