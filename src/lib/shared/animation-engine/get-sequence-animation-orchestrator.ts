import { SequenceAnimationOrchestrator } from '$lib/shared/animation-engine/services/sequence-animation-orchestrator';
import { getAnimationStateManager } from '$lib/shared/animation-engine/get-animation-state-manager';
import { getViewerAnimationPropConfig } from '$lib/shared/animation-engine/get-viewer-animation-prop-config';

let instance: SequenceAnimationOrchestrator | null = null;
export function getSequenceAnimationOrchestrator(): SequenceAnimationOrchestrator {
  return instance ??= new SequenceAnimationOrchestrator(
    getAnimationStateManager(),
    getViewerAnimationPropConfig
  );
}
