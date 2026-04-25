import type { IHandPathSaveOrchestrator } from './services/contracts/IHandPathSaveOrchestrator';
import { HandPathSaveOrchestrator } from './services/implementations/HandPathSaveOrchestrator';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';

let instance: IHandPathSaveOrchestrator | null = null;
export function getHandPathSaveOrchestrator(): IHandPathSaveOrchestrator {
  return instance ??= new HandPathSaveOrchestrator(handPathRepository);
}
