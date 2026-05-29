import { SequenceAnimationOrchestrator } from '$lib/shared/animation-engine/services/sequence-animation-orchestrator';
import { getAnimationStateManager } from '$lib/shared/animation-engine/getAnimationStateManager';
import { getPropInterpolator } from '$lib/shared/animation-engine/getPropInterpolator';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getPropInterpolator()
  );
}
