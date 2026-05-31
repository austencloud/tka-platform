import { SequenceAnimationOrchestrator } from '$lib/shared/animation-engine/services/sequence-animation-orchestrator';
import { getAnimationStateManager } from '$lib/shared/animation-engine/get-animation-state-manager';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager()
  );
}
