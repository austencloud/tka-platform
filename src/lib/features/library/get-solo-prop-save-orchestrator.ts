import { SoloPropSaveOrchestrator } from './services/solo-prop-save-orchestrator';
import { soloPropRepository } from '$lib/shared/foundation/services/implementations/SoloPropRepository';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';

let instance: SoloPropSaveOrchestrator | null = null;
export function getSoloPropSaveOrchestrator(): SoloPropSaveOrchestrator {
  return instance ??= new SoloPropSaveOrchestrator(soloPropRepository, handPathRepository);
}
