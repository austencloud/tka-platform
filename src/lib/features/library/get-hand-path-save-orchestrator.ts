import { HandPathSaveOrchestrator } from './services/hand-path-save-orchestrator';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';

let instance: HandPathSaveOrchestrator | null = null;
export function getHandPathSaveOrchestrator(): HandPathSaveOrchestrator {
  return instance ??= new HandPathSaveOrchestrator(handPathRepository);
}
