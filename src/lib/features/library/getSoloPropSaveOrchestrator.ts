import type { ISoloPropSaveOrchestrator } from './services/contracts/ISoloPropSaveOrchestrator';
import { SoloPropSaveOrchestrator } from './services/implementations/SoloPropSaveOrchestrator';
import { soloPropRepository } from '$lib/shared/foundation/services/implementations/SoloPropRepository';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';

let instance: ISoloPropSaveOrchestrator | null = null;
export function getSoloPropSaveOrchestrator(): ISoloPropSaveOrchestrator {
  return instance ??= new SoloPropSaveOrchestrator(soloPropRepository, handPathRepository);
}
